from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_async_session
from liderix_api.models.notifications import Notification
from liderix_api.models.memberships import Membership, MembershipStatus
from liderix_api.models.users import User
from liderix_api.schemas.notifications import NotificationListResponse, NotificationRead
from liderix_api.services.auth import get_current_user
from liderix_api.enums import NotificationStatus, NotificationType

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


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


@router.get("", response_model=NotificationListResponse)
@router.get("/", response_model=NotificationListResponse, include_in_schema=False)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    org_id: Optional[UUID] = Query(None),
    status: Optional[NotificationStatus] = Query(None),
    type: Optional[NotificationType] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_ids = await _user_org_ids(session, current_user.id)
    if org_id:
        if org_id not in org_ids:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        org_filter = [Notification.org_id == org_id]
    else:
        org_filter = [Notification.org_id.in_(org_ids)] if org_ids else []

    filters = [
        Notification.user_id == current_user.id,
        Notification.is_deleted.is_(False),
        *org_filter,
    ]
    if status:
        filters.append(Notification.status == status)
    if type:
        filters.append(Notification.type == type)

    total = await session.scalar(select(func.count(Notification.id)).where(*filters)) or 0
    unread_count = await session.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_deleted.is_(False),
            Notification.status == NotificationStatus.UNREAD,
            *org_filter,
        )
    ) or 0

    stmt = (
        select(Notification)
        .where(*filters)
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await session.execute(stmt)).scalars().all()
    return NotificationListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        unread_count=unread_count,
    )


@router.patch("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    notification = await session.get(Notification, notification_id)
    if not notification or notification.is_deleted:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    notification.status = NotificationStatus.READ
    notification.read_at = now_utc()
    await session.commit()
    await session.refresh(notification)
    return notification


@router.patch("/read-all", status_code=status.HTTP_200_OK)
async def mark_all_read(
    org_id: Optional[UUID] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_ids = await _user_org_ids(session, current_user.id)
    if org_id and org_id not in org_ids:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    filters = [
        Notification.user_id == current_user.id,
        Notification.is_deleted.is_(False),
        Notification.status == NotificationStatus.UNREAD,
    ]
    if org_id:
        filters.append(Notification.org_id == org_id)

    result = await session.execute(
        update(Notification)
        .where(*filters)
        .values(status=NotificationStatus.READ, read_at=now_utc())
        .execution_options(synchronize_session="fetch")
    )
    await session.commit()
    return {"updated": result.rowcount or 0}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    notification = await session.get(Notification, notification_id)
    if not notification or notification.is_deleted:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    notification.is_deleted = True
    notification.deleted_at = now_utc()
    await session.commit()
    return None
