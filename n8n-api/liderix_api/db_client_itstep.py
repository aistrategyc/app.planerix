from __future__ import annotations

from typing import AsyncGenerator, Callable

import logging
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, AsyncEngine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from liderix_api.config.settings import settings

logger = logging.getLogger("uvicorn.error")


class ClientBase(DeclarativeBase):
    """Base class for client DB models (ITSTEP)."""
    pass


engine_itstep: AsyncEngine | None = None
SessionItstep = None

if settings.ITSTEP_DB_URL:
    engine_itstep = create_async_engine(
        settings.ITSTEP_DB_URL,
        echo=False,
        pool_pre_ping=True,
        connect_args={"ssl": False},  # asyncpg: используем ssl, НЕ sslmode
    )
    SessionItstep = async_sessionmaker(
        bind=engine_itstep,
        class_=AsyncSession,
        expire_on_commit=False,
    )
else:
    logger.warning("ITSTEP_DB_URL is not set — client analytics deps will return 503.")


async def get_client_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency: shared ITSTEP session."""
    if SessionItstep is None:
        raise HTTPException(status_code=503, detail="Client DB is not configured")

    async with SessionItstep() as session:
        yield session


def get_client_session_by_client_id(client_id: str) -> Callable[[], AsyncGenerator[AsyncSession, None]]:
    """
    Dependency factory by client_id (reserved for future multi-client routing).
    Currently returns the same ITSTEP session.
    """
    async def _get_session() -> AsyncGenerator[AsyncSession, None]:
        if SessionItstep is None:
            raise HTTPException(status_code=503, detail="Client DB is not configured")
        async with SessionItstep() as session:
            yield session

    return _get_session