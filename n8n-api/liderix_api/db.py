from __future__ import annotations

from typing import AsyncGenerator, Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from liderix_api.config.settings import settings


class Base(DeclarativeBase):
    """Base class for ORM models."""
    pass


# =============================================================================
# Primary DB (Liderix)
# =============================================================================

liderix_engine: AsyncEngine = create_async_engine(
    settings.LIDERIX_DB_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    connect_args={"timeout": 5},
)

LiderixAsyncSessionLocal = async_sessionmaker(
    bind=liderix_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: primary DB session."""
    async with LiderixAsyncSessionLocal() as session:
        yield session


# =============================================================================
# External analytics DB (ITSTEP) - optional
# =============================================================================

def get_itstep_db_url() -> Optional[str]:
    """
    Returns ITSTEP DB URL if configured.
    URL is prepared/sanitized inside settings (e.g. sslmode removed).
    """
    return settings.ITSTEP_DB_URL


itstep_engine: AsyncEngine | None = None
ItstepAsyncSessionLocal = None

_itstep_url = get_itstep_db_url()
if _itstep_url:
    # IMPORTANT:
    # - asyncpg expects `ssl` (bool/SSLContext), not `sslmode`
    # - if sslmode is present in URL, it will break; settings.py removes it.
    itstep_engine = create_async_engine(
        _itstep_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
        connect_args={"ssl": False, "timeout": 5},  # безопасно для dev; убирает попытки SSL на уровне asyncpg
    )

    ItstepAsyncSessionLocal = async_sessionmaker(
        bind=itstep_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_itstep_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: ITSTEP DB session (503 if not configured)."""
    if ItstepAsyncSessionLocal is None:
        raise HTTPException(status_code=503, detail="Client DB (ITSTEP) is not configured")

    async with ItstepAsyncSessionLocal() as session:
        yield session
