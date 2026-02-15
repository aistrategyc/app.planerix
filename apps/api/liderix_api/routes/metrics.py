from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_async_session
from liderix_api.models.organization import MetricDefinition
from liderix_api.models.users import User
from liderix_api.schemas.metrics import MetricDefinitionListResponse
from liderix_api.services.auth import get_current_user
from liderix_api.services.permissions import check_organization_access

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("/definitions", response_model=MetricDefinitionListResponse)
async def list_metric_definitions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, max_length=200),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    await check_organization_access(session, current_user.org_id, current_user)

    filters = [
        MetricDefinition.org_id == current_user.org_id,
        MetricDefinition.deleted_at.is_(None),
    ]
    if search:
        search_term = f"%{search.strip()}%"
        filters.append(
            (MetricDefinition.name.ilike(search_term)) |
            (MetricDefinition.description.ilike(search_term))
        )

    total = await session.scalar(
        select(func.count(MetricDefinition.id)).where(*filters)
    ) or 0

    stmt = (
        select(MetricDefinition)
        .where(*filters)
        .order_by(MetricDefinition.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await session.execute(stmt)).scalars().all()

    return MetricDefinitionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
