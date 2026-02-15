from __future__ import annotations

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from liderix_api.db import get_async_session
from liderix_api.models.audit import EventLog
from liderix_api.models.users import User
from liderix_api.models.memberships import Membership, MembershipStatus
from liderix_api.schemas.audit import AuditLogListResponse, AuditLogRead, AuditActor
from liderix_api.services.auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit"])


async def _user_org_ids(session: AsyncSession, user_id: UUID) -> List[UUID]:
    orgs = await session.scalars(
        select(Membership.org_id).where(
            and_(
                Membership.user_id == user_id,
                Membership.deleted_at.is_(None),
                Membership.status == MembershipStatus.ACTIVE,
            )
        )
    )
    return list(orgs)


@router.get("/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    org_id: Optional[UUID] = Query(None),
    event_type: Optional[str] = Query(None),
    success: Optional[bool] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_ids = await _user_org_ids(session, current_user.id)
    if org_id:
        if org_id not in org_ids:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        org_filter = [EventLog.org_id == org_id]
    else:
        org_filter = [EventLog.org_id.in_(org_ids)] if org_ids else [EventLog.user_id == current_user.id]

    filters = [*org_filter]
    if event_type:
        filters.append(EventLog.event_type == event_type)
    if success is not None:
        filters.append(EventLog.success == success)

    total = await session.scalar(select(func.count(EventLog.id)).where(*filters)) or 0
    stmt = (
        select(EventLog)
        .options(selectinload(EventLog.user))
        .where(*filters)
        .order_by(EventLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await session.execute(stmt)).scalars().all()

    items: List[AuditLogRead] = []
    for row in rows:
        actor = None
        if row.user:
            actor = AuditActor(
                id=row.user.id,
                email=row.user.email,
                username=row.user.username,
                full_name=row.user.full_name or f"{row.user.first_name or ''} {row.user.last_name or ''}".strip() or None,
            )
        items.append(
            AuditLogRead(
                id=row.id,
                org_id=row.org_id,
                user_id=row.user_id,
                event_type=row.event_type,
                success=bool(row.success),
                ip_address=row.ip_address,
                user_agent=row.user_agent,
                metadata=row.data,
                created_at=row.created_at,
                actor=actor,
            )
        )

    return AuditLogListResponse(items=items, page=page, page_size=page_size, total=total)
