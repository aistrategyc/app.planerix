from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_COLUMNS_CACHE: dict[str, tuple[set[str], float]] = {}
_CACHE_TTL_SECONDS = 300


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in row.items():
        if isinstance(value, Decimal):
            normalized[key] = float(value)
        elif isinstance(value, (date, datetime)):
            normalized[key] = value.isoformat()
        else:
            normalized[key] = value
    return normalized


async def get_view_columns(session: AsyncSession, view: str) -> set[str]:
    now = time.monotonic()
    cached = _COLUMNS_CACHE.get(view)
    if cached and now - cached[1] < _CACHE_TTL_SECONDS:
        return cached[0]

    if "." in view:
        schema, table = view.split(".", 1)
    else:
        schema, table = "public", view

    result = await session.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table
            """
        ),
        {"schema": schema, "table": table},
    )
    columns = {row[0] for row in result.fetchall()}
    _COLUMNS_CACHE[view] = (columns, now)
    return columns


def pick_first(row: dict[str, Any], keys: list[str]) -> Optional[Any]:
    for key in keys:
        if key in row and row[key] is not None:
            return row[key]
    return None


def pick_number(row: dict[str, Any], keys: list[str], default: float = 0.0) -> float:
    value = pick_first(row, keys)
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
