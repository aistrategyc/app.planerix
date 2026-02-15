from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional, Tuple, Union
from uuid import UUID, uuid4

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, ExpiredSignatureError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.config.settings import settings
from liderix_api.db import get_async_session
from liderix_api.models.users import User

logger = logging.getLogger(__name__)

TokenType = Literal["access", "refresh"]

# ------------------------------------------------------------------------------
# Password hashing
# ------------------------------------------------------------------------------
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Хэширует пароль с использованием bcrypt."""
    return _pwd.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет совпадение plain пароля с хэшем."""
    return _pwd.verify(plain_password, hashed_password)


# ------------------------------------------------------------------------------
# OAuth2 (Bearer) — используется на эндпоинте логина
# ------------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login", auto_error=False)


# ------------------------------------------------------------------------------
# JWT internals
# ------------------------------------------------------------------------------
def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _key_for(typ: TokenType) -> str:
    """
    Канон:
    - access подписываем ACCESS_TOKEN_SECRET (если задан), иначе SECRET_KEY
    - refresh подписываем SECRET_KEY
    """
    if typ == "access":
        return settings.ACCESS_TOKEN_SECRET or settings.SECRET_KEY or "temporary_secret"
    return settings.SECRET_KEY or "temporary_secret"


def _base_claims(ttl_sec: int, typ: TokenType) -> Dict[str, Any]:
    now = _now_ts()
    claims: Dict[str, Any] = {
        "iat": now,
        "nbf": now,
        "exp": now + ttl_sec,
        "jti": str(uuid4()),
        "typ": typ,
    }
    # добавляем только если реально заданы (не None/пусто)
    if getattr(settings, "JWT_ISSUER", None):
        claims["iss"] = settings.JWT_ISSUER
    if getattr(settings, "JWT_AUDIENCE", None):
        claims["aud"] = settings.JWT_AUDIENCE
    return claims


def _unauth(type_: str, title: str, detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"type": type_, "title": title, "detail": detail, "status": 401},
        headers={"WWW-Authenticate": "Bearer"},
    )


def _create_token(*, typ: TokenType, sub: str, extra: Optional[Dict[str, Any]] = None) -> Tuple[str, str, int]:
    """
    Внутренний генератор: возвращает (token, jti, ttl)
    """
    ttl = settings.ACCESS_TTL_SEC if typ == "access" else settings.REFRESH_TTL_SEC
    claims = _base_claims(ttl, typ)
    claims["sub"] = sub
    if extra:
        claims.update(extra)
    token = jwt.encode(claims, _key_for(typ), algorithm=settings.JWT_ALGORITHM)
    return token, str(claims["jti"]), ttl


# ------------------------------------------------------------------------------
# Public JWT API (двухрежимное: legacy dict и новый sub/extra)
# ------------------------------------------------------------------------------
def create_access_token(
    payload: Optional[Dict[str, Any]] = None,
    *,
    sub: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Union[str, Tuple[str, int]]:
    """
    ✅ Новый канон:
        create_access_token(sub="uuid", extra={...}) -> (token, ttl)

    ✅ Legacy режим (чтобы не ломать старый код):
        create_access_token({"sub": "...", ...}) -> token (str)
    """
    # legacy: create_access_token(payload_dict)
    if payload is not None:
        if "sub" not in payload:
            raise ValueError("Payload must include 'sub'")
        token, _jti, _ttl = _create_token(typ="access", sub=str(payload["sub"]), extra={k: v for k, v in payload.items() if k != "sub"})
        return token

    if not sub:
        raise ValueError("sub is required")
    token, _jti, ttl = _create_token(typ="access", sub=sub, extra=extra)
    return token, ttl


def create_refresh_token(
    payload: Optional[Dict[str, Any]] = None,
    *,
    sub: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Union[str, Tuple[str, str, int]]:
    """
    ✅ Новый канон:
        create_refresh_token(sub="uuid") -> (token, jti, ttl)

    ✅ Legacy режим:
        create_refresh_token({"sub": "...", ...}) -> token (str)
    """
    if payload is not None:
        if "sub" not in payload:
            raise ValueError("Payload must include 'sub'")
        token, _jti, _ttl = _create_token(typ="refresh", sub=str(payload["sub"]), extra={k: v for k, v in payload.items() if k != "sub"})
        return token

    if not sub:
        raise ValueError("sub is required")
    token, jti, ttl = _create_token(typ="refresh", sub=sub, extra=extra)
    return token, jti, ttl


def decode_token(
    token: str,
    *,
    expect_typ: Optional[TokenType] = None,
    verify_exp: bool = True,
) -> Dict[str, Any]:
    """
    Декодирует и валидирует JWT.
    - если expect_typ указан — используем соответствующий ключ (access/refresh)
    - если не указан — пробуем сначала access-ключ, потом refresh-ключ
    """
    def _decode_with_key(key: str) -> Dict[str, Any]:
        return jwt.decode(
            token,
            key,
            algorithms=[settings.JWT_ALGORITHM],
            options={
                "verify_exp": verify_exp,
                "verify_aud": bool(getattr(settings, "JWT_AUDIENCE", None)),
                "verify_iss": bool(getattr(settings, "JWT_ISSUER", None)),
            },
            audience=settings.JWT_AUDIENCE if getattr(settings, "JWT_AUDIENCE", None) else None,
            issuer=settings.JWT_ISSUER if getattr(settings, "JWT_ISSUER", None) else None,
        )

    try:
        if expect_typ:
            claims = _decode_with_key(_key_for(expect_typ))
        else:
            # автоподбор ключа
            try:
                claims = _decode_with_key(_key_for("access"))
            except JWTError:
                claims = _decode_with_key(_key_for("refresh"))
    except ExpiredSignatureError:
        raise _unauth("urn:problem:token-expired", "Token expired", "The token has expired")
    except JWTError:
        raise _unauth("urn:problem:invalid-token", "Invalid token", "The token is invalid")

    if expect_typ and claims.get("typ") != expect_typ:
        raise _unauth("urn:problem:invalid-token-type", "Invalid token type", "Unexpected token type")

    return claims


def try_decode_token(
    token: str,
    *,
    expect_typ: Optional[TokenType] = None,
) -> Optional[Dict[str, Any]]:
    try:
        return decode_token(token, expect_typ=expect_typ)
    except HTTPException:
        return None


def generate_jwt_token(user_id: str) -> str:
    """Сокращённый хелпер на основе access-токена (legacy)."""
    tok = create_access_token({"sub": str(user_id)})
    assert isinstance(tok, str)
    return tok


# ------------------------------------------------------------------------------
# Current user dependency (только для access токена)
# ------------------------------------------------------------------------------
async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    access_token = token or request.cookies.get("access_token")
    if not access_token:
        raise _unauth("urn:problem:no-token", "Not authenticated", "Access token missing")

    claims = decode_token(access_token, expect_typ="access", verify_exp=True)

    sub = claims.get("sub")
    if not sub:
        raise _unauth("urn:problem:invalid-token", "Invalid token", "Invalid token (no sub)")

    try:
        from sqlalchemy.orm import lazyload

        user = (
            await session.execute(
                select(User)
                .options(lazyload("*"))
                .where(User.id == UUID(sub))
            )
        ).scalar_one()
    except NoResultFound:
        raise _unauth("urn:problem:user-not-found", "User not found", "User not found")

    # мягкое удаление
    if getattr(user, "deleted_at", None):
        raise _unauth("urn:problem:user-not-found", "User not found", "User not found")

    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"type": "urn:problem:account-disabled", "title": "Account Disabled", "status": 403},
        )
    if hasattr(user, "is_verified") and not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"type": "urn:problem:unverified", "title": "Email not verified", "status": 403},
        )

    try:
        from liderix_api.enums import MembershipStatus
        from liderix_api.models.memberships import Membership

        org_id = await session.scalar(
            select(Membership.org_id)
            .where(
                Membership.user_id == user.id,
                Membership.deleted_at.is_(None),
                Membership.status == MembershipStatus.ACTIVE,
            )
            .limit(1)
        )
        if org_id is None:
            org_id = await session.scalar(
                select(Membership.org_id)
                .where(
                    Membership.user_id == user.id,
                    Membership.deleted_at.is_(None),
                )
                .limit(1)
            )
        setattr(user, "_org_id", org_id)
    except Exception:
        setattr(user, "_org_id", None)

    return user


# ------------------------------------------------------------------------------
# Admin guard dependency
# ------------------------------------------------------------------------------
async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not getattr(current_user, "is_admin", False):
        logger.warning(f"Admin access denied for user {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"type": "urn:problem:access-denied", "title": "Admin access required", "status": 403},
        )
    return current_user
