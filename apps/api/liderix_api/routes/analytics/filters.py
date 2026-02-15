from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_itstep_session

router = APIRouter()


@router.get("/cities")
async def get_cities(
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_itstep_session),
):
    result = await session.execute(
        text(
            """
            SELECT id_city, city_name
            FROM sem.dim_city_display
            ORDER BY city_name
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    rows = result.mappings().all()
    return {"items": [dict(row) for row in rows]}
