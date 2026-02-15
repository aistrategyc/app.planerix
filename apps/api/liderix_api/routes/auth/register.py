from __future__ import annotations

import re
import secrets as _secrets
from datetime import timedelta
from typing import Optional
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import RedisError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

# --- безопасная инициализация resend ---
try:
    import resend  # type: ignore

    _RESEND_AVAILABLE = True
except Exception:
    resend = None  # type: ignore
    _RESEND_AVAILABLE = False

from liderix_api.config.settings import settings
from liderix_api.db import get_async_session
from liderix_api.models.memberships import Membership
from liderix_api.models.organization import Organization
from liderix_api.models.users import User
from liderix_api.schemas.auth import RegisterSchema, ResendSchema, VerifySchema
from liderix_api.services.auth import hash_password
from liderix_api.services.onboarding import OnboardingService
from liderix_api.services.redis_client import get_redis_client
from .utils import (
    AuditLogger,
    AuthError,
    RateLimiter,
    get_client_info,
    normalize_email,
    now_utc,
    sha256_hex,
    validate_password,
    validate_username,
)


class MessageResponse(BaseModel):
    message: str


router = APIRouter(prefix="/auth", tags=["Auth"])


# --- Redis (fail-soft) ---
class _NoopRateLimiter:
    async def check_registration_attempts(self, _ip: str) -> bool:
        return True


redis: Optional[Redis]
rate_limiter: RateLimiter | _NoopRateLimiter

redis = get_redis_client()
rate_limiter = RateLimiter(redis) if redis else _NoopRateLimiter()

def _disable_redis() -> None:
    global redis
    redis = None


def _make_org_slug(username: str, user_id: UUID | str) -> str:
    """
    Generate slug matching DB constraint:
      ^[a-z0-9]+(?:-[a-z0-9]+)*$
    and keep within varchar(80).
    """
    base = (username or "").strip().lower()
    base = re.sub(r"[^a-z0-9]+", "-", base)
    base = re.sub(r"-{2,}", "-", base).strip("-")
    if not base:
        base = "workspace"

    uid = str(user_id)
    slug = f"{base}-{uid[:8]}"
    return slug[:80]


async def send_verification_email_async(email: str, username: str, token: str) -> None:
    """Отправка письма подтверждения (с безопасным фолбэком, чтобы не падать при ошибках)."""
    import logging

    logger = logging.getLogger(__name__)

    frontend = (settings.FRONTEND_URL or "").rstrip("/")
    if not frontend:
        logger.warning("FRONTEND_URL is missing — skipping email to %s", email)
        return

    if not _RESEND_AVAILABLE or not settings.RESEND_API_KEY:
        logger.warning("Resend is not available or API key is missing — skipping email to %s", email)
        return

    from_email = settings.EMAIL_FROM
    if not isinstance(from_email, str) or not from_email.strip():
        logger.warning("EMAIL_FROM is missing/invalid — skipping email to %s", email)
        return

    link = f"{frontend}/verify-email/token?token={quote(token, safe='')}&email={quote(email, safe='')}"

    try:
        resend.api_key = settings.RESEND_API_KEY  # type: ignore[union-attr]
        resend.Emails.send(  # type: ignore[attr-defined]
            {
                "from": from_email,
                "to": email,
                "subject": "Verify your Liderix account",
                "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #333;">Welcome to Liderix, {username}!</h1>
                    <p>Thank you for creating an account. Please verify your email address to get started.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{link}"
                           style="background-color: #007bff; color: white; padding: 12px 24px;
                                  text-decoration: none; border-radius: 6px; display: inline-block;">
                            Verify Email Address
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                        If the button doesn't work, copy and paste this link: {link}
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        This link will expire in 48 hours.
                    </p>
                </div>
                """,
            }
        )
    except Exception as e:
        logger.error("Failed to send verification email to %s: %s", email, e)


@router.post("/register", response_model=MessageResponse, status_code=201)
async def register(
    data: RegisterSchema,
    request: Request,
    background: BackgroundTasks,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    ip, user_agent = get_client_info(request)

    # Rate limiting (fail-soft: если redis не настроен, limiter всегда пропускает)
    if not await rate_limiter.check_registration_attempts(ip):
        await AuditLogger.log_event(session, None, "auth.register.rate_limited", False, ip, user_agent)
        AuthError.problem(
            429,
            "urn:problem:registration-rate-limit",
            "Too Many Registrations",
            "Too many registration attempts. Please try again later.",
        )

    email = normalize_email(data.email)
    username = data.username.strip()

    ok, err = validate_password(data.password)
    if not ok:
        await AuditLogger.log_event(
            session, None, "auth.register.weak_password", False, ip, user_agent, {"email": email, "error": err}
        )
        AuthError.problem(400, "urn:problem:weak-password", "Weak Password", err)

    uok, uerr = validate_username(username)
    if not uok:
        await AuditLogger.log_event(
            session, None, "auth.register.invalid_username", False, ip, user_agent, {"username": username, "error": uerr}
        )
        AuthError.problem(400, "urn:problem:invalid-username", "Invalid Username", uerr)

    token = _secrets.token_urlsafe(32)
    token_hash = sha256_hex(token)
    expires_at = now_utc() + timedelta(hours=48)

    existing: Optional[User] = None
    user: Optional[User] = None

    try:
        async with session.begin():
            existing = await session.scalar(select(User).where(User.email == email))

            if existing and existing.is_verified:
                await AuditLogger.log_event(
                    session, existing.id, "auth.register.duplicate_email", False, ip, user_agent, {"email": email}
                )
                AuthError.duplicate_email()

            # Username unique среди верифицированных
            existing_username = await session.scalar(
                select(User).where(User.username == username, User.is_verified == True)  # noqa: E712
            )
            if existing_username:
                await AuditLogger.log_event(
                    session, None, "auth.register.duplicate_username", False, ip, user_agent, {"username": username}
                )
                AuthError.problem(
                    409,
                    "urn:problem:duplicate-username",
                    "Username Taken",
                    "This username is already taken",
                )

            if not existing:
                user = User(
                    id=uuid4(),
                    username=username,
                    email=email,
                    first_name=data.first_name,
                    last_name=data.last_name,
                    hashed_password=hash_password(data.password),
                    client_id=data.client_id,
                    is_verified=False,
                    is_active=True,
                    verification_token_hash=token_hash,
                    verification_token_expires_at=expires_at,
                    created_at=now_utc(),
                    updated_at=now_utc(),
                )
                session.add(user)
            else:
                await session.execute(
                    update(User)
                    .where(User.id == existing.id, User.is_verified == False)  # noqa: E712
                    .values(
                        username=username,
                        first_name=data.first_name,
                        last_name=data.last_name,
                        hashed_password=hash_password(data.password),
                        verification_token_hash=token_hash,
                        verification_token_expires_at=expires_at,
                        updated_at=now_utc(),
                    )
                )
                user = existing

    except IntegrityError as e:
        await AuditLogger.log_event(
            session, None, "auth.register.integrity_error", False, ip, user_agent, {"email": email, "error": str(e)}
        )
        low = str(e).lower()
        if "email" in low:
            AuthError.duplicate_email()
        if "username" in low:
            AuthError.problem(409, "urn:problem:duplicate-username", "Username Taken", "This username is already taken")
        AuthError.problem(500, "urn:problem:database-error", "Registration Failed", "Unable to create account")

    if not user:
        AuthError.problem(500, "urn:problem:registration-failed", "Registration Failed", "Unable to create account")

    response.headers["Location"] = f"/api/users/{user.id}"

    background.add_task(send_verification_email_async, email, (user.username or username), token)

    await AuditLogger.log_event(
        session, user.id, "auth.register.success", True, ip, user_agent, {"email": email, "username": username}
    )

    return MessageResponse(message="Account created successfully! Please check your email to verify your account.")


@router.get("/verify", response_model=MessageResponse)
async def verify_email(
    request: Request,
    token: str = Query(..., description="Verification token"),
    email: str = Query(..., description="Email address"),
    session: AsyncSession = Depends(get_async_session),
):
    return await _verify_email_logic(token, email, request, session)


@router.post("/verify", response_model=MessageResponse)
async def verify_email_post(
    data: VerifySchema,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    return await _verify_email_logic(data.token, data.email, request, session)


async def _verify_email_logic(
    token: str,
    email: str,
    request: Request,
    session: AsyncSession,
) -> MessageResponse:
    ip, user_agent = get_client_info(request)
    email = normalize_email(email)
    token_hash = sha256_hex(token)

    org_id: Optional[UUID] = None

    async with session.begin():
        user = await session.scalar(select(User).where(User.email == email))

        if not user or not user.verification_token_hash:
            await AuditLogger.log_event(session, None, "auth.verify.invalid_token", False, ip, user_agent, {"email": email})
            AuthError.invalid_token()

        if user.is_verified:
            await AuditLogger.log_event(session, user.id, "auth.verify.already_verified", True, ip, user_agent, {"email": email})
            return MessageResponse(message="Email already verified. You can now log in.")

        if not user.verification_token_expires_at:
            await AuditLogger.log_event(session, user.id, "auth.verify.no_token", False, ip, user_agent, {"email": email})
            AuthError.invalid_token()

        if not _secrets.compare_digest(user.verification_token_hash, token_hash):
            await AuditLogger.log_event(session, user.id, "auth.verify.wrong_token", False, ip, user_agent, {"email": email})
            AuthError.invalid_token()

        if user.verification_token_expires_at < now_utc():
            await AuditLogger.log_event(session, user.id, "auth.verify.expired_token", False, ip, user_agent, {"email": email})
            AuthError.token_expired()

        # отметим verified
        await session.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                is_verified=True,
                verification_token_hash=None,
                verification_token_expires_at=None,
                verified_at=now_utc(),
                updated_at=now_utc(),
            )
        )

        # Нужно ли создавать org+membership?
        user_with_memberships = await session.scalar(
            select(User).options(selectinload(User.memberships)).where(User.id == user.id)
        )

        if not user_with_memberships or not user_with_memberships.memberships:
            org_slug = _make_org_slug(user.username or "workspace", user.id)
            org_name = f"{user.username}'s Workspace" if user.username else "Workspace"
            ts = now_utc()

            organization = Organization(
                id=uuid4(),
                owner_id=user.id,
                name=org_name,
                slug=org_slug,
                description=None,
                address=None,
                custom_fields=None,
                preferences=None,
                is_deleted=False,
                deleted_at=None,
                created_at=ts,
                updated_at=ts,
            )
            session.add(organization)
            await session.flush()
            org_id = organization.id

            membership = Membership(
                id=uuid4(),
                user_id=user.id,
                org_id=organization.id,
                department_id=None,
                role="owner",
                status="active",
                invited_by_id=None,
                joined_at=ts,
                meta_data={},
                is_deleted=False,
                deleted_at=None,
                created_at=ts,
                updated_at=ts,
            )
            session.add(membership)
            await session.flush()

    # Onboarding — строго ПОСЛЕ коммита verify (и не валим verify, если onboarding упал)
    if org_id:
        try:
            import logging

            logger = logging.getLogger(__name__)
            auto_seed = getattr(settings, "AUTO_SEED_SAMPLE_DATA", True)

            if auto_seed:
                logger.info("Creating onboarding sample data for user %s", user.id)  # type: ignore[union-attr]
                await OnboardingService.create_sample_data_for_user(
                    user_id=user.id,  # type: ignore[union-attr]
                    org_id=org_id,
                    session=session,
                    template="business",
                )
                logger.info("Onboarding sample data created successfully for user %s", user.id)  # type: ignore[union-attr]
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.warning("Failed to create onboarding data for verified user: %s", e)

    await AuditLogger.log_event(session, user.id, "auth.verify.success", True, ip, user_agent, {"email": email})  # type: ignore[arg-type]
    return MessageResponse(message="Email verified successfully! You can now log in to your account.")


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    data: ResendSchema,
    request: Request,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
):
    ip, user_agent = get_client_info(request)
    email = normalize_email(data.email)

    # Rate limit (3/час) — если redis нет, пропускаем без лимита
    if redis is not None:
        try:
            resend_key = f"resend_verification:{email}"
            resend_count = await redis.incr(resend_key)
            if resend_count == 1:
                await redis.expire(resend_key, 3600)

            if resend_count > 3:
                await AuditLogger.log_event(session, None, "auth.resend.rate_limited", False, ip, user_agent, {"email": email})
                AuthError.problem(
                    429,
                    "urn:problem:resend-rate-limit",
                    "Too Many Requests",
                    "Too many resend attempts. Please try again later.",
                )
        except (RedisConnectionError, RedisError):
            _disable_redis()

    user = await session.scalar(select(User).where(User.email == email))

    generic = MessageResponse(message="If this email exists and is not verified, a new verification link has been sent.")

    if not user or user.is_verified:
        await AuditLogger.log_event(
            session,
            user.id if user else None,
            "auth.resend.no_action",
            True,
            ip,
            user_agent,
            {"email": email, "reason": "verified_or_not_found"},
        )
        return generic

    token = _secrets.token_urlsafe(32)
    token_hash = sha256_hex(token)
    expires_at = now_utc() + timedelta(hours=48)

    async with session.begin():
        await session.execute(
            update(User)
            .where(User.id == user.id, User.is_verified == False)  # noqa: E712
            .values(
                verification_token_hash=token_hash,
                verification_token_expires_at=expires_at,
                updated_at=now_utc(),
            )
        )

    background.add_task(send_verification_email_async, email, user.username, token)

    await AuditLogger.log_event(session, user.id, "auth.resend.success", True, ip, user_agent, {"email": email})
    return generic
