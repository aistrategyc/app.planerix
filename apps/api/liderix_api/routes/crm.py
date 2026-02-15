from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from liderix_api.db import get_async_session
from liderix_api.models.crm import CRMContact, CRMDeal
from liderix_api.models.memberships import Membership, MembershipStatus
from liderix_api.models.users import User
from liderix_api.schemas.crm import (
    CRMContactCreate,
    CRMContactUpdate,
    CRMContactRead,
    CRMContactListResponse,
    CRMDealCreate,
    CRMDealUpdate,
    CRMDealRead,
    CRMDealListResponse,
)
from liderix_api.services.auth import get_current_user
from liderix_api.services.audit import AuditLogger
from liderix_api.enums import CRMContactStatus, CRMContactPriority, CRMContactSource, CRMDealStage

router = APIRouter(prefix="/crm", tags=["CRM"])


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


async def _resolve_org_id(
    session: AsyncSession, user_id: UUID, org_id: Optional[UUID]
) -> UUID:
    org_ids = await _user_org_ids(session, user_id)
    if org_id:
        if org_id not in org_ids:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        return org_id
    if not org_ids:
        raise HTTPException(status_code=403, detail="No organization membership found")
    return org_ids[0]


# ----------------- Contacts -----------------

@router.get("/contacts", response_model=CRMContactListResponse)
async def list_contacts(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    org_id: Optional[UUID] = Query(None),
    status: Optional[CRMContactStatus] = Query(None),
    priority: Optional[CRMContactPriority] = Query(None),
    source: Optional[CRMContactSource] = Query(None),
    search: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_ids = await _user_org_ids(session, current_user.id)
    if org_id:
        if org_id not in org_ids:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        org_filter = [CRMContact.org_id == org_id]
    else:
        org_filter = [CRMContact.org_id.in_(org_ids)] if org_ids else [CRMContact.org_id.is_(None)]

    filters = [CRMContact.is_deleted.is_(False), *org_filter]

    if status:
        filters.append(CRMContact.status == status)
    if priority:
        filters.append(CRMContact.priority == priority)
    if source:
        filters.append(CRMContact.source == source)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                CRMContact.name.ilike(term),
                CRMContact.email.ilike(term),
                CRMContact.company.ilike(term),
            )
        )

    total = await session.scalar(select(func.count(CRMContact.id)).where(*filters)) or 0
    stmt = (
        select(CRMContact)
        .where(*filters)
        .order_by(CRMContact.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await session.execute(stmt)).scalars().all()

    await AuditLogger.log_event(
        session,
        current_user.id,
        "crm.contacts.list",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"org_id": str(org_id) if org_id else None, "page": page, "page_size": page_size},
    )

    return CRMContactListResponse(items=items, page=page, page_size=page_size, total=total)


@router.post("/contacts", response_model=CRMContactRead, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: CRMContactCreate,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_id = await _resolve_org_id(session, current_user.id, data.org_id)
    contact = CRMContact(
        id=uuid4(),
        org_id=org_id,
        name=data.name.strip(),
        email=str(data.email).lower(),
        phone=data.phone,
        company=data.company,
        position=data.position,
        status=data.status,
        priority=data.priority,
        source=data.source,
        value=data.value,
        last_contact=data.last_contact,
        next_follow_up=data.next_follow_up,
        notes=data.notes,
        tags=data.tags or [],
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    session.add(contact)
    await session.commit()
    await session.refresh(contact)

    await AuditLogger.log_event(
        session,
        current_user.id,
        "crm.contact.create",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"org_id": str(org_id), "contact_id": str(contact.id)},
    )

    return contact


@router.patch("/contacts/{contact_id}", response_model=CRMContactRead)
async def update_contact(
    contact_id: UUID,
    data: CRMContactUpdate,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    contact = await session.get(CRMContact, contact_id)
    if not contact or contact.is_deleted:
        raise HTTPException(status_code=404, detail="Contact not found")

    org_ids = await _user_org_ids(session, current_user.id)
    if contact.org_id not in org_ids:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    contact.updated_at = now_utc()
    await session.commit()
    await session.refresh(contact)

    await AuditLogger.log_event(
        session,
        current_user.id,
        "crm.contact.update",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"org_id": str(contact.org_id), "contact_id": str(contact.id)},
    )

    return contact


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    contact = await session.get(CRMContact, contact_id)
    if not contact or contact.is_deleted:
        raise HTTPException(status_code=404, detail="Contact not found")

    org_ids = await _user_org_ids(session, current_user.id)
    if contact.org_id not in org_ids:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    contact.is_deleted = True
    contact.deleted_at = now_utc()
    contact.updated_at = now_utc()
    await session.commit()

    await AuditLogger.log_event(
        session,
        current_user.id,
        "crm.contact.delete",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"org_id": str(contact.org_id), "contact_id": str(contact.id)},
    )

    return None


# ----------------- Deals -----------------

@router.get("/deals", response_model=CRMDealListResponse)
async def list_deals(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    org_id: Optional[UUID] = Query(None),
    stage: Optional[CRMDealStage] = Query(None),
    contact_id: Optional[UUID] = Query(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_ids = await _user_org_ids(session, current_user.id)
    if org_id:
        if org_id not in org_ids:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        org_filter = [CRMDeal.org_id == org_id]
    else:
        org_filter = [CRMDeal.org_id.in_(org_ids)] if org_ids else [CRMDeal.org_id.is_(None)]

    filters = [CRMDeal.is_deleted.is_(False), *org_filter]
    if stage:
        filters.append(CRMDeal.stage == stage)
    if contact_id:
        filters.append(CRMDeal.contact_id == contact_id)

    total = await session.scalar(select(func.count(CRMDeal.id)).where(*filters)) or 0
    stmt = (
        select(CRMDeal)
        .options(selectinload(CRMDeal.contact))
        .where(*filters)
        .order_by(CRMDeal.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await session.execute(stmt)).scalars().all()

    result_items: List[CRMDealRead] = []
    for deal in items:
        result_items.append(
            CRMDealRead(
                id=deal.id,
                org_id=deal.org_id,
                title=deal.title,
                contact_id=deal.contact_id,
                contact_name=deal.contact.name if deal.contact else None,
                company=deal.company or (deal.contact.company if deal.contact else None),
                amount=deal.amount,
                stage=deal.stage,
                probability=deal.probability,
                expected_close_date=deal.expected_close_date,
                created_at=deal.created_at,
                updated_at=deal.updated_at,
            )
        )

    await AuditLogger.log_event(
        session,
        current_user.id,
        "crm.deals.list",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"org_id": str(org_id) if org_id else None, "page": page, "page_size": page_size},
    )

    return CRMDealListResponse(items=result_items, page=page, page_size=page_size, total=total)


@router.post("/deals", response_model=CRMDealRead, status_code=status.HTTP_201_CREATED)
async def create_deal(
    data: CRMDealCreate,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_id = await _resolve_org_id(session, current_user.id, data.org_id)

    contact = None
    if data.contact_id:
        contact = await session.get(CRMContact, data.contact_id)
        if not contact or contact.is_deleted or contact.org_id != org_id:
            raise HTTPException(status_code=404, detail="Contact not found")

    deal = CRMDeal(
        id=uuid4(),
        org_id=org_id,
        title=data.title.strip(),
        contact_id=data.contact_id,
        company=data.company or (contact.company if contact else None),
        amount=data.amount,
        stage=data.stage,
        probability=data.probability,
        expected_close_date=data.expected_close_date,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    session.add(deal)
    await session.commit()
    await session.refresh(deal)

    await AuditLogger.log_event(
        session,
        current_user.id,
        "crm.deal.create",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"org_id": str(org_id), "deal_id": str(deal.id)},
    )

    return CRMDealRead(
        id=deal.id,
        org_id=deal.org_id,
        title=deal.title,
        contact_id=deal.contact_id,
        contact_name=contact.name if contact else None,
        company=deal.company,
        amount=deal.amount,
        stage=deal.stage,
        probability=deal.probability,
        expected_close_date=deal.expected_close_date,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )


@router.patch("/deals/{deal_id}", response_model=CRMDealRead)
async def update_deal(
    deal_id: UUID,
    data: CRMDealUpdate,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    deal = await session.get(CRMDeal, deal_id)
    if not deal or deal.is_deleted:
        raise HTTPException(status_code=404, detail="Deal not found")

    org_ids = await _user_org_ids(session, current_user.id)
    if deal.org_id not in org_ids:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    contact = None
    if data.contact_id is not None:
        contact = await session.get(CRMContact, data.contact_id)
        if not contact or contact.is_deleted or contact.org_id != deal.org_id:
            raise HTTPException(status_code=404, detail="Contact not found")
        deal.contact_id = data.contact_id
        if not data.company:
            deal.company = contact.company

    for field, value in data.model_dump(exclude_unset=True, exclude={"contact_id"}).items():
        setattr(deal, field, value)
    deal.updated_at = now_utc()
    await session.commit()
    await session.refresh(deal)

    contact = contact or (await session.get(CRMContact, deal.contact_id)) if deal.contact_id else None

    await AuditLogger.log_event(
        session,
        current_user.id,
        "crm.deal.update",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"org_id": str(deal.org_id), "deal_id": str(deal.id)},
    )

    return CRMDealRead(
        id=deal.id,
        org_id=deal.org_id,
        title=deal.title,
        contact_id=deal.contact_id,
        contact_name=contact.name if contact else None,
        company=deal.company or (contact.company if contact else None),
        amount=deal.amount,
        stage=deal.stage,
        probability=deal.probability,
        expected_close_date=deal.expected_close_date,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )


@router.delete("/deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deal(
    deal_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    deal = await session.get(CRMDeal, deal_id)
    if not deal or deal.is_deleted:
        raise HTTPException(status_code=404, detail="Deal not found")

    org_ids = await _user_org_ids(session, current_user.id)
    if deal.org_id not in org_ids:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    deal.is_deleted = True
    deal.deleted_at = now_utc()
    deal.updated_at = now_utc()
    await session.commit()

    await AuditLogger.log_event(
        session,
        current_user.id,
        "crm.deal.delete",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"org_id": str(deal.org_id), "deal_id": str(deal.id)},
    )

    return None
