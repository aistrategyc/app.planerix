from __future__ import annotations

import os
import json
from typing import Optional, List, Union
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, ValidationInfo


def _parse_listish(value: Union[str, List[str], None]) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]

    s = str(value).strip()
    if s == "":
        return []
    if s == "*":
        return ["*"]

    # JSON list support
    try:
        arr = json.loads(s)
        if isinstance(arr, list):
            return [str(x).strip() for x in arr if str(x).strip()]
    except Exception:
        pass

    # CSV support
    return [p.strip() for p in s.split(",") if p.strip()]


def _normalize_asyncpg_ssl(url: str) -> str:
    """
    Make URL compatible with asyncpg:
    - remove sslmode
    - use ssl=true/false
    """
    p = urlparse(url)
    q = dict(parse_qsl(p.query, keep_blank_values=True))

    if "sslmode" in q:
        v = (q.get("sslmode") or "").strip().lower()
        q.pop("sslmode", None)

        if v in {"false", "0", "no", "off", "disable"}:
            q["ssl"] = "false"
        elif v in {"require", "verify-ca", "verify-full"}:
            q["ssl"] = "true"
        elif v in {"allow", "prefer"}:
            # ambiguous in asyncpg; default to false unless already set
            q.setdefault("ssl", "false")
        else:
            q["ssl"] = "false"

    # default (your desired behavior)
    q.setdefault("ssl", "false")

    return urlunparse(p._replace(query=urlencode(q)))


def _derive_cookie_domain(frontend_url: str | None) -> Optional[str]:
    if not frontend_url:
        return None
    try:
        host = urlparse(frontend_url).hostname or ""
    except Exception:
        return None

    host = host.strip().lower()
    if not host or host in {"localhost", "127.0.0.1", "0.0.0.0"}:
        return None
    # IP address → no domain cookie
    if all(part.isdigit() for part in host.split(".")):
        return None

    parts = [p for p in host.split(".") if p]
    if len(parts) < 2:
        return None

    base = ".".join(parts[-2:])
    return f".{base}"


def _derive_cookie_domain_from_origins(origins: List[str]) -> Optional[str]:
    if not origins:
        return None
    # Do not attempt to derive from wildcard origins.
    if "*" in origins:
        return None
    candidates = set()
    for origin in origins:
        if not origin:
            continue
        candidate = _derive_cookie_domain(origin)
        if candidate:
            candidates.add(candidate)
    if len(candidates) == 1:
        return candidates.pop()
    return None


class Settings(BaseSettings):
    # ---- App ----
    PROJECT_NAME: str = "Liderix API"
    PROJECT_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    DEBUG: bool = False
    LOG_LEVEL: str = "info"
    API_PREFIX: str = "/api"
    # Legacy/direct analytics endpoints (non-widget APIs). Keep disabled by default to reduce API surface.
    ENABLE_LEGACY_ANALYTICS_ROUTES: bool = False

    # ---- CORS ----
    # IMPORTANT: Cannot use "*" with credentials=True, must specify exact origins
    CORS_ALLOW_ORIGINS: Union[str, List[str]] = os.getenv(
        "CORS_ALLOW_ORIGINS",
        "https://n8n.itstep.org,https://n8n-api.itstep.org,https://n8n-web.itstep.org",
    )
    CORS_ALLOW_METHODS: Union[str, List[str]] = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    CORS_ALLOW_HEADERS: Union[str, List[str]] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://n8n-web.itstep.org")
    UPLOADS_DIR: str = os.getenv("UPLOADS_DIR", "uploads")

    # ---- Redis ----
    REDIS_URL: Optional[str] = None
    QDRANT_URL: Optional[str] = os.getenv("QDRANT_URL")

    # ---- Security / JWT ----
    REFRESH_COOKIE_NAME: str = os.getenv("REFRESH_COOKIE_NAME", "lrx_refresh")
    REFRESH_COOKIE_SECURE: bool = str(os.getenv("REFRESH_COOKIE_SECURE", "true")).lower() in ("1", "true", "yes")
    REFRESH_COOKIE_SAMESITE: str | None = (os.getenv("REFRESH_COOKIE_SAMESITE", "none") or "none").lower()
    COOKIE_SECURE: bool = str(os.getenv("COOKIE_SECURE", str(REFRESH_COOKIE_SECURE))).lower() in ("1", "true", "yes")
    COOKIE_SAMESITE: str = (os.getenv("COOKIE_SAMESITE") or REFRESH_COOKIE_SAMESITE or ("none" if COOKIE_SECURE else "lax")).lower()
    COOKIE_DOMAIN: Optional[str] = os.getenv("COOKIE_DOMAIN") or None

    SECRET_KEY: Optional[str] = None
    ACCESS_TOKEN_SECRET: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    JWT_AUDIENCE: Optional[str] = None
    JWT_ISSUER: Optional[str] = None
    ACCESS_TTL_SEC: int = int(os.getenv("ACCESS_TTL_SEC", "900"))
    REFRESH_TTL_SEC: int = int(os.getenv("REFRESH_TTL_SEC", "2592000"))

    # ---- DB pool tuning ----
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", "600"))

    # ---- Email ----
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: Optional[str] = None

    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "smtp")
    DEFAULT_FROM_EMAIL: Optional[str] = os.getenv("DEFAULT_FROM_EMAIL") or os.getenv("EMAIL_FROM")
    SMTP_HOST: Optional[str] = os.getenv("SMTP_HOST")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: Optional[str] = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    SMTP_TLS: bool = str(os.getenv("SMTP_TLS", "true")).lower() in ("1", "true", "yes")
    SMTP_SSL: bool = str(os.getenv("SMTP_SSL", "false")).lower() in ("1", "true", "yes")

    RESEND_FROM: Optional[str] = None
    CONTACT_TO: Optional[str] = None

    # ---- n8n ----
    N8N_API_URL: Optional[str] = os.getenv("N8N_API_URL")
    N8N_API_KEY: Optional[str] = os.getenv("N8N_API_KEY")

    # ---- AI (OpenAI/Qdrant) ----
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    OPENAI_EMBEDDINGS_MODEL: str = os.getenv("OPENAI_EMBEDDINGS_MODEL", "text-embedding-3-small")
    AI_INGEST_TOKEN: Optional[str] = os.getenv("AI_INGEST_TOKEN")
    QDRANT_API_KEY: Optional[str] = os.getenv("QDRANT_API_KEY")
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "ai_insights")

    # ---- Primary DB (Liderix) ----
    LIDERIX_DB_URL: Optional[str] = None
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "liderixapp")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "manfromlamp")
    POSTGRES_PASSWORD: Optional[str] = os.getenv("POSTGRES_PASSWORD")

    # ---- External read-only client DB (ITSTEP) ----
    ITSTEP_DB_URL: Optional[str] = None
    ITSTEP_DB_HOST: str = os.getenv("ITSTEP_DB_HOST", "92.242.60.211")
    ITSTEP_DB_PORT: int = int(os.getenv("ITSTEP_DB_PORT", "5432"))
    ITSTEP_DB_NAME: str = os.getenv("ITSTEP_DB_NAME", "itstep_final")
    ITSTEP_DB_USER: str = os.getenv("ITSTEP_DB_USER", "bi_app")
    ITSTEP_DB_PASSWORD: Optional[str] = os.getenv("ITSTEP_DB_PASSWORD")

    # ---- Onboarding ----
    AUTO_SEED_SAMPLE_DATA: bool = str(os.getenv("AUTO_SEED_SAMPLE_DATA", "true")).lower() in ("1", "true", "yes")

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
        env_file=None,
    )

    # ---- Validators ----
    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def _default_secret_key(cls, v):
        return v or "temporary_secret"

    @field_validator("CORS_ALLOW_ORIGINS", mode="before")
    @classmethod
    def _val_cors_origins(cls, v):
        return _parse_listish(v)

    @field_validator("CORS_ALLOW_METHODS", mode="before")
    @classmethod
    def _val_cors_methods(cls, v):
        return _parse_listish(v)

    @field_validator("CORS_ALLOW_HEADERS", mode="before")
    @classmethod
    def _val_cors_headers(cls, v):
        return _parse_listish(v)

    @field_validator("COOKIE_DOMAIN", mode="before")
    @classmethod
    def _val_cookie_domain(cls, v, info: ValidationInfo):
        if v:
            return v
        data = getattr(info, "data", {}) or {}
        frontend_url = data.get("FRONTEND_URL")
        if frontend_url:
            return _derive_cookie_domain(frontend_url)
        origins = data.get("CORS_ALLOW_ORIGINS") or []
        if not isinstance(origins, list):
            origins = _parse_listish(origins)
        return _derive_cookie_domain_from_origins(origins)

    # ---- Compose DB URL from environment variables ----
    @field_validator("LIDERIX_DB_URL", mode="before")
    @classmethod
    def _build_db_url(cls, v, info: ValidationInfo):
        if v:
            # no ssl params needed for local docker usually, but keep as-is
            return v

        data = getattr(info, "data", {}) or {}
        user = data.get("POSTGRES_USER") or os.getenv("POSTGRES_USER")
        pwd = data.get("POSTGRES_PASSWORD") or os.getenv("POSTGRES_PASSWORD")
        host = data.get("POSTGRES_HOST") or os.getenv("POSTGRES_HOST", "postgres")
        port = data.get("POSTGRES_PORT") or os.getenv("POSTGRES_PORT", "5432")
        db = data.get("POSTGRES_DB") or os.getenv("POSTGRES_DB")

        if not all([user, host, db]):
            raise ValueError(
                "Не удалось собрать строку подключения к БД. "
                "Задайте LIDERIX_DB_URL или все переменные POSTGRES_*"
            )

        pwd_part = f":{pwd}" if pwd else ""
        return f"postgresql+asyncpg://{user}{pwd_part}@{host}:{port}/{db}"

    # ---- Build ITSTEP DB URL from environment variables ----
    @field_validator("ITSTEP_DB_URL", mode="before")
    @classmethod
    def _build_itstep_db_url(cls, v, info: ValidationInfo):
        # If explicitly set — normalize ssl params
        if v:
            return _normalize_asyncpg_ssl(v)

        data = getattr(info, "data", {}) or {}
        user = data.get("ITSTEP_DB_USER") or os.getenv("ITSTEP_DB_USER")
        pwd = data.get("ITSTEP_DB_PASSWORD") or os.getenv("ITSTEP_DB_PASSWORD")
        host = data.get("ITSTEP_DB_HOST") or os.getenv("ITSTEP_DB_HOST", "92.242.60.211")
        port = data.get("ITSTEP_DB_PORT") or os.getenv("ITSTEP_DB_PORT", "5432")
        db = data.get("ITSTEP_DB_NAME") or os.getenv("ITSTEP_DB_NAME")

        # optional DB: return None if missing pieces
        if not all([user, pwd, host, db]):
            return None

        pwd_part = f":{pwd}" if pwd else ""
        url = f"postgresql+asyncpg://{user}{pwd_part}@{host}:{port}/{db}?ssl=false"
        return _normalize_asyncpg_ssl(url)


settings = Settings()
