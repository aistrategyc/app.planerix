from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, status
from jose import jwt, JWTError, ExpiredSignatureError

from liderix_api.config.settings import settings

TokenType = Literal["access", "refresh"]


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


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
    if settings.JWT_ISSUER:
        claims["iss"] = settings.JWT_ISSUER
    if settings.JWT_AUDIENCE:
        claims["aud"] = settings.JWT_AUDIENCE
    return claims


def _unauth(type_: str, title: str, detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"type": type_, "title": title, "detail": detail, "status": 401},
        headers={"WWW-Authenticate": "Bearer"},
    )


def _key_for(typ: TokenType) -> str:
    # Канон:
    # - access подписываем ACCESS_TOKEN_SECRET
    # - refresh подписываем SECRET_KEY
    if typ == "access":
        return settings.ACCESS_TOKEN_SECRET or settings.SECRET_KEY or "temporary_secret"
    return settings.SECRET_KEY or "temporary_secret"


def create_access_token(*, sub: str, extra: Optional[Dict[str, Any]] = None) -> Tuple[str, int]:
    claims = _base_claims(settings.ACCESS_TTL_SEC, "access")
    claims["sub"] = sub
    if extra:
        claims.update(extra)
    token = jwt.encode(claims, _key_for("access"), algorithm=settings.JWT_ALGORITHM)
    return token, settings.ACCESS_TTL_SEC


def create_refresh_token(*, sub: str, extra: Optional[Dict[str, Any]] = None) -> Tuple[str, str, int]:
    claims = _base_claims(settings.REFRESH_TTL_SEC, "refresh")
    claims["sub"] = sub
    if extra:
        claims.update(extra)
    token = jwt.encode(claims, _key_for("refresh"), algorithm=settings.JWT_ALGORITHM)
    return token, claims["jti"], settings.REFRESH_TTL_SEC


def create_token_pair(
    *, sub: str, access_extra: Optional[Dict[str, Any]] = None, refresh_extra: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    access, access_ttl = create_access_token(sub=sub, extra=access_extra)
    refresh, refresh_jti, refresh_ttl = create_refresh_token(sub=sub, extra=refresh_extra)
    return {
        "access_token": access,
        "access_expires_in": access_ttl,
        "refresh_token": refresh,
        "refresh_jti": refresh_jti,
        "refresh_expires_in": refresh_ttl,
        "token_type": "bearer",
    }


def decode_token(token: str, *, expect_typ: Optional[TokenType] = None, verify_exp: bool = True) -> Dict[str, Any]:
    # если тип не указан — считаем, что это access (для Authorization Bearer)
    typ: TokenType = expect_typ or "access"

    try:
        claims = jwt.decode(
            token,
            _key_for(typ),
            algorithms=[settings.JWT_ALGORITHM],
            options={
                "verify_exp": verify_exp,
                "verify_aud": bool(settings.JWT_AUDIENCE),
                "verify_iss": bool(settings.JWT_ISSUER),
            },
            audience=settings.JWT_AUDIENCE if settings.JWT_AUDIENCE else None,
            issuer=settings.JWT_ISSUER if settings.JWT_ISSUER else None,
        )
    except ExpiredSignatureError:
        raise _unauth("urn:problem:token-expired", "Token expired", "The token has expired")
    except JWTError:
        raise _unauth("urn:problem:invalid-token", "Invalid token", "The token is invalid")

    # Жёсткая проверка типа токена
    if expect_typ and claims.get("typ") != expect_typ:
        raise _unauth("urn:problem:invalid-token-type", "Invalid token type", "Unexpected token type")

    return claims


def try_decode_token(token: str, *, expect_typ: Optional[TokenType] = None) -> Optional[Dict[str, Any]]:
    try:
        return decode_token(token, expect_typ=expect_typ)
    except HTTPException:
        return None