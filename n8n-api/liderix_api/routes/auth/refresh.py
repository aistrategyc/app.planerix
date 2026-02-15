from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from liderix_api.config.settings import settings
from liderix_api.db import get_async_session
from liderix_api.models.users import User
from liderix_api.schemas.auth import TokenResponse
from liderix_api.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from .utils import (
    AuthError,
    AuditLogger,
    TokenWhitelist,
    get_client_info,
    resolve_cookie_domain,
)
from liderix_api.services.redis_client import get_redis_client

router = APIRouter(prefix="/auth", tags=["Auth"])

redis = get_redis_client()
token_whitelist = TokenWhitelist(redis)

# Redis fail-soft toggle (avoid repeated slow failures)
def _disable_redis() -> None:
    global redis
    redis = None

# ------------------------------------------------------------------------------
# Soft security knobs (DEV/soft mode)
# ------------------------------------------------------------------------------
MAX_REFRESH_ATTEMPTS = 200
REFRESH_RATE_WINDOW = 3600  # 1 hour

# Grace window to tolerate parallel refresh requests (race condition)
REFRESH_GRACE_SEC = 30

SECURE_COOKIES = getattr(settings, "COOKIE_SECURE", False)
SAMESITE = getattr(settings, "COOKIE_SAMESITE", None) or ("none" if SECURE_COOKIES else "lax")


async def check_refresh_rate_limit(user_id: str, ip: str) -> bool:
    if not redis:
        return True
    rate_key = f"refresh_rate:{user_id}:{ip}"
    try:
        current_count = await redis.incr(rate_key)
        if current_count == 1:
            await redis.expire(rate_key, REFRESH_RATE_WINDOW)
        return current_count <= MAX_REFRESH_ATTEMPTS
    except (RedisConnectionError, RedisError):
        _disable_redis()
        return True


async def store_session_metadata(user_id: str, jti: str, ip: str, user_agent: str):
    if not redis:
        return
    session_key = f"session_meta:{user_id}:{jti}"
    now_iso = datetime.now(timezone.utc).isoformat()
    session_data = {
        "created_at": now_iso,
        "ip": ip,
        "user_agent": user_agent,
        "last_used": now_iso,
    }
    try:
        await redis.hset(session_key, mapping=session_data)
        await redis.expire(session_key, settings.REFRESH_TTL_SEC)
    except (RedisConnectionError, RedisError):
        _disable_redis()
        return


async def update_session_last_used(user_id: str, jti: str):
    if not redis:
        return
    session_key = f"session_meta:{user_id}:{jti}"
    try:
        await redis.hset(session_key, "last_used", datetime.now(timezone.utc).isoformat())
    except (RedisConnectionError, RedisError):
        _disable_redis()
        return


def set_refresh_cookie(response: Response, token: str, domain: Optional[str] = None):
    cookie_kwargs = {
        "key": settings.REFRESH_COOKIE_NAME,
        "value": token,
        "httponly": True,
        "secure": SECURE_COOKIES,  # DEV: False -> works on http://localhost
        "samesite": SAMESITE,      # DEV: lax
        "max_age": settings.REFRESH_TTL_SEC,
        "path": "/",
    }
    cookie_domain = domain or getattr(settings, "COOKIE_DOMAIN", None)
    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain
    response.set_cookie(**cookie_kwargs)


def set_access_cookie(response: Response, token: str, domain: Optional[str] = None):
    cookie_kwargs = {
        "key": "access_token",
        "value": token,
        "httponly": True,
        "secure": SECURE_COOKIES,
        "samesite": SAMESITE,
        "max_age": settings.ACCESS_TTL_SEC,
        "path": "/",
    }
    cookie_domain = domain or getattr(settings, "COOKIE_DOMAIN", None)
    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain
    response.set_cookie(**cookie_kwargs)


def clear_access_cookie(response: Response, domain: Optional[str] = None):
    cookie_kwargs = {
        "key": "access_token",
        "value": "",
        "httponly": True,
        "secure": SECURE_COOKIES,
        "samesite": SAMESITE,
        "max_age": 0,
        "path": "/",
    }
    cookie_domain = domain or getattr(settings, "COOKIE_DOMAIN", None)
    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain
    response.set_cookie(**cookie_kwargs)


def clear_refresh_cookie(response: Response, domain: Optional[str] = None):
    cookie_kwargs = {
        "key": settings.REFRESH_COOKIE_NAME,
        "value": "",
        "httponly": True,
        "secure": SECURE_COOKIES,
        "samesite": SAMESITE,
        "max_age": 0,
        "path": "/",
    }
    cookie_domain = domain or getattr(settings, "COOKIE_DOMAIN", None)
    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain
    response.set_cookie(**cookie_kwargs)
    clear_access_cookie(response, domain=cookie_domain)


def _grace_key(sub: str, old_jti: str) -> str:
    return f"refresh_grace:{sub}:{old_jti}"


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    response.headers["Cache-Control"] = "no-store"
    ip, user_agent = get_client_info(request)
    cookie_domain = resolve_cookie_domain(request)
    refresh_token_value = request.cookies.get(settings.REFRESH_COOKIE_NAME)

    if not refresh_token_value:
        await AuditLogger.log_event(session, None, "auth.refresh.no_token", False, ip, user_agent)
        AuthError.problem(
            401,
            "urn:problem:no-refresh",
            "Refresh Token Missing",
            "Refresh token not found in cookies",
        )

    # Decode strictly as refresh
    try:
        claims = decode_token(refresh_token_value, expect_typ="refresh", verify_exp=True)
    except Exception as e:
        await AuditLogger.log_event(
            session,
            None,
            "auth.refresh.invalid_token",
            False,
            ip,
            user_agent,
            {"error": str(e)},
        )
        clear_refresh_cookie(response, domain=cookie_domain)
        AuthError.problem(
            401,
            "urn:problem:invalid-refresh",
            "Invalid Refresh Token",
            "Refresh token is invalid or expired",
        )

    sub = claims.get("sub")
    jti = claims.get("jti")
    if not sub or not jti:
        await AuditLogger.log_event(
            session,
            None,
            "auth.refresh.missing_claims",
            False,
            ip,
            user_agent,
            {"sub": bool(sub), "jti": bool(jti)},
        )
        clear_refresh_cookie(response, domain=cookie_domain)
        AuthError.problem(
            401,
            "urn:problem:invalid-token",
            "Invalid Token",
            "Token missing required claims",
        )

    dev_mode = bool(getattr(settings, "DEBUG", False)) or (settings.ENVIRONMENT or "").lower() in {
        "local",
        "dev",
        "development",
    }

    # Rate limit (skip in local/dev)
    if not dev_mode and not await check_refresh_rate_limit(sub, ip):
        await AuditLogger.log_event(session, UUID(sub), "auth.refresh.rate_limited", False, ip, user_agent)
        AuthError.problem(
            429,
            "urn:problem:refresh-rate-limit",
            "Too Many Refresh Attempts",
            "Too many refresh attempts. Please try again later.",
        )

    # Whitelist check (skip in local/dev to avoid false revocations)
    if not dev_mode and not await token_whitelist.exists(sub, jti):
        # GRACE: if token was just rotated, allow a short window
        try:
            grace = await redis.get(_grace_key(sub, jti)) if redis else None
        except (RedisConnectionError, RedisError):
            _disable_redis()
            grace = None
        if grace:
            # idempotent-ish: issue a fresh access token, keep cookie as is (or set to latest)
            # (we can store latest refresh token in grace value; here it's enough to accept)
            user: Optional[User] = await session.scalar(
                select(User)
                .options(selectinload(User.organizations))
                .where(User.id == UUID(sub))
            )
            if not user:
                clear_refresh_cookie(response, domain=cookie_domain)
                AuthError.problem(401, "urn:problem:user-not-found", "User Not Found", "Please login again")

            access_extra = {"email": user.email, "username": user.username}
            if getattr(user, "organizations", None):
                access_extra["org_ids"] = [str(org.id) for org in user.organizations]

            new_access_token, _ = create_access_token(sub=sub, extra=access_extra)
            set_access_cookie(response, new_access_token, domain=cookie_domain)

            await AuditLogger.log_event(
                session,
                UUID(sub),
                "auth.refresh.grace_hit",
                True,
                ip,
                user_agent,
                {"old_jti": jti},
            )
            return TokenResponse(access_token=new_access_token, token_type="bearer", expires_in=settings.ACCESS_TTL_SEC)

        # SOFT mode: do NOT revoke all tokens. Just reject this one session.
        await AuditLogger.log_event(
            session,
            UUID(sub),
            "auth.refresh.not_whitelisted",
            False,
            ip,
            user_agent,
            {"jti": jti},
        )
        clear_refresh_cookie(response, domain=cookie_domain)
        AuthError.problem(
            401,
            "urn:problem:refresh-revoked",
            "Refresh Token Revoked",
            "Session expired. Please login again.",
        )

    # Validate user exists and is active
    user: Optional[User] = await session.scalar(
        select(User)
        .options(selectinload(User.organizations))
        .where(User.id == UUID(sub))
    )

    if not user:
        await token_whitelist.remove(sub, jti)
        await AuditLogger.log_event(session, UUID(sub), "auth.refresh.user_not_found", False, ip, user_agent)
        clear_refresh_cookie(response, domain=cookie_domain)
        AuthError.problem(401, "urn:problem:user-not-found", "User Not Found", "Please login again")

    if getattr(user, "deleted_at", None):
        await token_whitelist.remove(sub, jti)
        await AuditLogger.log_event(session, user.id, "auth.refresh.user_deleted", False, ip, user_agent)
        clear_refresh_cookie(response, domain=cookie_domain)
        AuthError.problem(401, "urn:problem:user-deleted", "Account Deleted", "Please login again")

    if hasattr(user, "is_active") and not user.is_active:
        await token_whitelist.remove(sub, jti)
        await AuditLogger.log_event(session, user.id, "auth.refresh.user_inactive", False, ip, user_agent)
        clear_refresh_cookie(response, domain=cookie_domain)
        AuthError.problem(403, "urn:problem:account-disabled", "Account Disabled", "Contact support")

    if hasattr(user, "is_verified") and not user.is_verified:
        await token_whitelist.remove(sub, jti)
        await AuditLogger.log_event(session, user.id, "auth.refresh.user_unverified", False, ip, user_agent)
        clear_refresh_cookie(response, domain=cookie_domain)
        AuthError.problem(403, "urn:problem:unverified", "Email Not Verified", "Please verify email")

    # Rotation:
    # 1) put old jti into grace for short time (to tolerate parallel refresh)
    if redis and not dev_mode:
        try:
            await redis.set(_grace_key(sub, jti), "1", ex=REFRESH_GRACE_SEC)
        except (RedisConnectionError, RedisError):
            _disable_redis()

    # 2) remove old refresh from whitelist
    if not dev_mode:
        await token_whitelist.remove(sub, jti)
        await update_session_last_used(sub, jti)

    # Issue new tokens
    access_extra = {"email": user.email, "username": user.username}
    if getattr(user, "organizations", None):
        access_extra["org_ids"] = [str(org.id) for org in user.organizations]

    new_access_token, _ = create_access_token(sub=sub, extra=access_extra)
    new_refresh_token, new_refresh_jti, _ = create_refresh_token(sub=sub)

    if not dev_mode:
        await token_whitelist.add(sub, new_refresh_jti)
        await store_session_metadata(sub, new_refresh_jti, ip, user_agent)

    set_refresh_cookie(response, new_refresh_token, domain=cookie_domain)
    set_access_cookie(response, new_access_token, domain=cookie_domain)

    await AuditLogger.log_event(
        session,
        user.id,
        "auth.refresh.success",
        True,
        ip,
        user_agent,
        {"old_jti": jti, "new_refresh_jti": new_refresh_jti, "username": user.username},
    )

    return TokenResponse(access_token=new_access_token, token_type="bearer", expires_in=settings.ACCESS_TTL_SEC)


@router.post("/revoke")
async def revoke_refresh_token(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    ip, user_agent = get_client_info(request)
    cookie_domain = resolve_cookie_domain(request)
    refresh_token_value = request.cookies.get(settings.REFRESH_COOKIE_NAME)

    if not refresh_token_value:
        await AuditLogger.log_event(session, None, "auth.revoke.no_token", False, ip, user_agent)
        AuthError.problem(401, "urn:problem:no-refresh", "No Active Session", "No refresh token found")

    try:
        claims = decode_token(refresh_token_value, expect_typ="refresh", verify_exp=False)
        user_id = claims.get("sub")
        jti = claims.get("jti")

        if user_id and jti:
            await token_whitelist.remove(user_id, jti)
            if redis:
                try:
                    await redis.delete(f"session_meta:{user_id}:{jti}")
                except (RedisConnectionError, RedisError):
                    _disable_redis()
            await AuditLogger.log_event(session, UUID(user_id), "auth.revoke.success", True, ip, user_agent, {"jti": jti})
        else:
            await AuditLogger.log_event(session, None, "auth.revoke.invalid_token", False, ip, user_agent)

    except Exception as e:
        await AuditLogger.log_event(session, None, "auth.revoke.error", False, ip, user_agent, {"error": str(e)})

    clear_refresh_cookie(response, domain=cookie_domain)
    return {"message": "Refresh token revoked successfully"}


@router.post("/revoke-all")
async def revoke_all_refresh_tokens(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    ip, user_agent = get_client_info(request)
    cookie_domain = resolve_cookie_domain(request)
    refresh_token_value = request.cookies.get(settings.REFRESH_COOKIE_NAME)

    if not refresh_token_value:
        AuthError.problem(401, "urn:problem:no-refresh", "No Active Session", "No refresh token found")

    try:
        claims = decode_token(refresh_token_value, expect_typ="refresh", verify_exp=False)
        user_id = claims.get("sub")
        if not user_id:
            AuthError.problem(401, "urn:problem:invalid-token", "Invalid Token", "Invalid refresh token")

        # delete session meta
        if redis:
            try:
                async for key in redis.scan_iter(match=f"session_meta:{user_id}:*", count=1000):
                    await redis.delete(key)
            except (RedisConnectionError, RedisError):
                _disable_redis()

        await token_whitelist.remove_all_user_tokens(user_id)

        await AuditLogger.log_event(
            session,
            UUID(user_id),
            "auth.revoke_all.success",
            True,
            ip,
            user_agent,
        )

    except Exception as e:
        await AuditLogger.log_event(session, None, "auth.revoke_all.error", False, ip, user_agent, {"error": str(e)})
        AuthError.problem(400, "urn:problem:revocation-failed", "Revocation Failed", "Unable to revoke all sessions")

    clear_refresh_cookie(response, domain=cookie_domain)
    return {"message": "All refresh tokens revoked successfully"}


@router.get("/validate")
async def validate_refresh_token(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    ip, user_agent = get_client_info(request)
    refresh_token_value = request.cookies.get(settings.REFRESH_COOKIE_NAME)

    if not refresh_token_value:
        await AuditLogger.log_event(session, None, "auth.validate.no_token", False, ip, user_agent)
        AuthError.problem(401, "urn:problem:no-refresh", "No Active Session", "No refresh token found")

    try:
        claims = decode_token(refresh_token_value, expect_typ="refresh", verify_exp=True)

        sub = claims.get("sub")
        jti = claims.get("jti")
        if not sub or not jti:
            AuthError.problem(401, "urn:problem:invalid-token", "Invalid Token", "Token missing required claims")

        if not await token_whitelist.exists(sub, jti):
            await AuditLogger.log_event(session, UUID(sub), "auth.validate.not_whitelisted", False, ip, user_agent)
            AuthError.problem(401, "urn:problem:token-revoked", "Token Revoked", "Refresh token has been revoked")

        user = await session.scalar(select(User).where(User.id == UUID(sub)))
        if not user or (hasattr(user, "is_verified") and not user.is_verified):
            await AuditLogger.log_event(session, UUID(sub), "auth.validate.user_invalid", False, ip, user_agent)
            AuthError.problem(401, "urn:problem:user-invalid", "Invalid User", "User not found or not verified")

        if hasattr(user, "is_active") and not user.is_active:
            await AuditLogger.log_event(session, user.id, "auth.validate.user_inactive", False, ip, user_agent)
            AuthError.problem(403, "urn:problem:account-disabled", "Account Disabled", "User account is disabled")

        await update_session_last_used(sub, jti)
        await AuditLogger.log_event(session, user.id, "auth.validate.success", True, ip, user_agent, {"jti": jti})

        return {
            "valid": True,
            "user_id": sub,
            "username": user.username,
            "email": user.email,
            "expires_at": claims.get("exp"),
            "issued_at": claims.get("iat"),
        }

    except Exception as e:
        await AuditLogger.log_event(session, None, "auth.validate.error", False, ip, user_agent, {"error": str(e)})
        AuthError.problem(401, "urn:problem:validation-failed", "Validation Failed", "Unable to validate refresh token")
        
