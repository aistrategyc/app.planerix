"""
EventLink API routes.

Endpoints for managing links between events/tasks/projects and OKRs/KPIs.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, delete
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID

from liderix_api.db import get_async_session
from liderix_api.services.auth import get_current_user
from liderix_api.services.permissions import check_organization_access
from liderix_api.models.users import User
from liderix_api.models.event_links import EventLink
from liderix_api.schemas.event_links import (
    EventLinkCreate,
    EventLinkUpdate,
    EventLinkRead,
    EventLinkListResponse,
    EventLinkFilters,
    EventLinkBulkCreateRequest,
    EventLinkBulkCreateResponse,
    EventLinkAnalytics,
    TargetProgressReport,
    SourceProgressSummary,
)

router = APIRouter(tags=["Event Links"])


# ==================== CRUD OPERATIONS ====================

@router.post("", response_model=EventLinkRead, status_code=201)
async def create_event_link(
    data: EventLinkCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new EventLink.

    Links a source (event/task/project) to a target (OKR KR/KPI Indicator).
    """
    # Note: We don't check org_id here because links can cross organizational boundaries
    # in some cases (e.g., shared projects). Access control is handled at the
    # source/target entity level.

    # Create the link
    new_link = EventLink(
        **data.model_dump(exclude_unset=True)
    )

    session.add(new_link)
    await session.commit()

    # Re-fetch with relationships
    result = await session.execute(
        select(EventLink)
        .options(
            selectinload(EventLink.event),
            selectinload(EventLink.task),
            selectinload(EventLink.project),
            selectinload(EventLink.okr_key_result),
            selectinload(EventLink.kpi_indicator)
        )
        .where(EventLink.id == new_link.id)
    )
    refreshed_link = result.scalar_one()

    return refreshed_link


@router.get("", response_model=EventLinkListResponse)
async def list_event_links(
    # Source filters
    event_id: Optional[UUID] = Query(None, description="Filter by event ID"),
    task_id: Optional[UUID] = Query(None, description="Filter by task ID"),
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),

    # Target filters
    okr_kr_id: Optional[UUID] = Query(None, description="Filter by OKR Key Result ID"),
    kpi_indicator_id: Optional[UUID] = Query(None, description="Filter by KPI Indicator ID"),

    # Configuration filters
    link_type: Optional[str] = Query(None, description="Filter by link type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    auto_update: Optional[bool] = Query(None, description="Filter by auto-update status"),

    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),

    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    List EventLinks with filtering and pagination.

    Filter by source (event/task/project) or target (OKR KR/KPI).
    """
    # Build query with filters
    query = select(EventLink).where(EventLink.deleted_at.is_(None))

    # Apply source filters
    if event_id:
        query = query.where(EventLink.event_id == event_id)
    if task_id:
        query = query.where(EventLink.task_id == task_id)
    if project_id:
        query = query.where(EventLink.project_id == project_id)

    # Apply target filters
    if okr_kr_id:
        query = query.where(EventLink.okr_kr_id == okr_kr_id)
    if kpi_indicator_id:
        query = query.where(EventLink.kpi_indicator_id == kpi_indicator_id)

    # Apply configuration filters
    if link_type:
        query = query.where(EventLink.link_type == link_type)
    if is_active is not None:
        query = query.where(EventLink.is_active == is_active)
    if auto_update is not None:
        query = query.where(EventLink.auto_update == auto_update)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Load relationships
    query = query.options(
        selectinload(EventLink.event),
        selectinload(EventLink.task),
        selectinload(EventLink.project),
        selectinload(EventLink.okr_key_result),
        selectinload(EventLink.kpi_indicator)
    )

    # Execute query
    result = await session.execute(query)
    links = result.scalars().all()

    # Build filters_applied dict
    filters_applied = {}
    if event_id:
        filters_applied['event_id'] = str(event_id)
    if task_id:
        filters_applied['task_id'] = str(task_id)
    if project_id:
        filters_applied['project_id'] = str(project_id)
    if okr_kr_id:
        filters_applied['okr_kr_id'] = str(okr_kr_id)
    if kpi_indicator_id:
        filters_applied['kpi_indicator_id'] = str(kpi_indicator_id)
    if link_type:
        filters_applied['link_type'] = link_type
    if is_active is not None:
        filters_applied['is_active'] = is_active
    if auto_update is not None:
        filters_applied['auto_update'] = auto_update

    return EventLinkListResponse(
        items=links,
        total=total,
        page=page,
        page_size=page_size,
        filters_applied=filters_applied
    )


@router.get("/{link_id}", response_model=EventLinkRead)
async def get_event_link(
    link_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific EventLink by ID."""

    query = select(EventLink).options(
        selectinload(EventLink.event),
        selectinload(EventLink.task),
        selectinload(EventLink.project),
        selectinload(EventLink.okr_key_result),
        selectinload(EventLink.kpi_indicator)
    ).where(
        EventLink.id == link_id,
        EventLink.deleted_at.is_(None)
    )

    result = await session.execute(query)
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="EventLink not found")

    return link


@router.patch("/{link_id}", response_model=EventLinkRead)
async def update_event_link(
    link_id: UUID,
    data: EventLinkUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Update an existing EventLink."""

    # Find the link
    query = select(EventLink).where(
        EventLink.id == link_id,
        EventLink.deleted_at.is_(None)
    )
    result = await session.execute(query)
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="EventLink not found")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(link, field, value)

    await session.commit()

    # Re-fetch with relationships
    result = await session.execute(
        select(EventLink)
        .options(
            selectinload(EventLink.event),
            selectinload(EventLink.task),
            selectinload(EventLink.project),
            selectinload(EventLink.okr_key_result),
            selectinload(EventLink.kpi_indicator)
        )
        .where(EventLink.id == link.id)
    )
    refreshed_link = result.scalar_one()

    return refreshed_link


@router.delete("/{link_id}", status_code=204)
async def delete_event_link(
    link_id: UUID,
    hard_delete: bool = Query(False, description="Permanently delete (true) or soft delete (false)"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Delete an EventLink (soft delete by default)."""

    # Find the link
    query = select(EventLink).where(EventLink.id == link_id)
    if not hard_delete:
        query = query.where(EventLink.deleted_at.is_(None))

    result = await session.execute(query)
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="EventLink not found")

    if hard_delete:
        # Permanent delete
        await session.delete(link)
    else:
        # Soft delete
        from datetime import datetime, timezone
        link.deleted_at = datetime.now(timezone.utc)

    await session.commit()


# ==================== BULK OPERATIONS ====================

@router.post("/bulk", response_model=EventLinkBulkCreateResponse, status_code=201)
async def bulk_create_event_links(
    data: EventLinkBulkCreateRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create multiple EventLinks at once.

    Returns both successfully created links and any that failed with error messages.
    """
    created_links: List[EventLink] = []
    failed_items: List[dict] = []

    for idx, link_data in enumerate(data.links):
        try:
            new_link = EventLink(**link_data.model_dump(exclude_unset=True))
            session.add(new_link)
            await session.flush()  # Flush to catch errors per-item
            created_links.append(new_link)
        except Exception as e:
            failed_items.append({
                "index": idx,
                "data": link_data.model_dump(),
                "error": str(e)
            })
            await session.rollback()

    # Commit all successful creates
    if created_links:
        await session.commit()

        # Re-fetch with relationships
        link_ids = [link.id for link in created_links]
        result = await session.execute(
            select(EventLink)
            .options(
                selectinload(EventLink.event),
                selectinload(EventLink.task),
                selectinload(EventLink.project),
                selectinload(EventLink.okr_key_result),
                selectinload(EventLink.kpi_indicator)
            )
            .where(EventLink.id.in_(link_ids))
        )
        refreshed_links = result.scalars().all()
    else:
        refreshed_links = []

    return EventLinkBulkCreateResponse(
        created=refreshed_links,
        failed=failed_items,
        total_created=len(refreshed_links),
        total_failed=len(failed_items)
    )


# ==================== ANALYTICS ====================

@router.get("/analytics/summary", response_model=EventLinkAnalytics)
async def get_event_link_analytics(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get analytics summary for all EventLinks."""

    # Total links
    total_query = select(func.count()).select_from(EventLink).where(EventLink.deleted_at.is_(None))
    total_result = await session.execute(total_query)
    total_links = total_result.scalar() or 0

    # Links by type
    type_query = select(
        EventLink.link_type,
        func.count(EventLink.id)
    ).where(
        EventLink.deleted_at.is_(None)
    ).group_by(EventLink.link_type)
    type_result = await session.execute(type_query)
    links_by_type = {row[0]: row[1] for row in type_result.all()}

    # Links by source type
    source_counts = {
        "events": 0,
        "tasks": 0,
        "projects": 0
    }
    event_count_query = select(func.count()).select_from(EventLink).where(
        EventLink.deleted_at.is_(None),
        EventLink.event_id.is_not(None)
    )
    event_count = (await session.execute(event_count_query)).scalar() or 0
    source_counts["events"] = event_count

    task_count_query = select(func.count()).select_from(EventLink).where(
        EventLink.deleted_at.is_(None),
        EventLink.task_id.is_not(None)
    )
    task_count = (await session.execute(task_count_query)).scalar() or 0
    source_counts["tasks"] = task_count

    project_count_query = select(func.count()).select_from(EventLink).where(
        EventLink.deleted_at.is_(None),
        EventLink.project_id.is_not(None)
    )
    project_count = (await session.execute(project_count_query)).scalar() or 0
    source_counts["projects"] = project_count

    # Links by target type
    target_counts = {
        "okr_key_results": 0,
        "kpi_indicators": 0
    }
    okr_count_query = select(func.count()).select_from(EventLink).where(
        EventLink.deleted_at.is_(None),
        EventLink.okr_kr_id.is_not(None)
    )
    okr_count = (await session.execute(okr_count_query)).scalar() or 0
    target_counts["okr_key_results"] = okr_count

    kpi_count_query = select(func.count()).select_from(EventLink).where(
        EventLink.deleted_at.is_(None),
        EventLink.kpi_indicator_id.is_not(None)
    )
    kpi_count = (await session.execute(kpi_count_query)).scalar() or 0
    target_counts["kpi_indicators"] = kpi_count

    # Active/inactive counts
    active_query = select(func.count()).select_from(EventLink).where(
        EventLink.deleted_at.is_(None),
        EventLink.is_active == True
    )
    active_count = (await session.execute(active_query)).scalar() or 0

    inactive_count = total_links - active_count

    # Average weight
    avg_weight_query = select(func.avg(EventLink.weight)).where(EventLink.deleted_at.is_(None))
    avg_weight_result = await session.execute(avg_weight_query)
    avg_weight = float(avg_weight_result.scalar() or 1.0)

    return EventLinkAnalytics(
        total_links=total_links,
        links_by_type=links_by_type,
        links_by_source=source_counts,
        links_by_target=target_counts,
        active_links=active_count,
        inactive_links=inactive_count,
        average_weight=avg_weight
    )


@router.get("/analytics/target/{target_type}/{target_id}", response_model=TargetProgressReport)
async def get_target_progress_report(
    target_type: str,  # "okr_key_result" or "kpi_indicator"
    target_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed progress report for a target (OKR KR or KPI).

    Shows all linked sources and their weighted contributions.
    """
    # Build query based on target type
    if target_type == "okr_key_result":
        query = select(EventLink).where(
            EventLink.okr_kr_id == target_id,
            EventLink.deleted_at.is_(None)
        )
    elif target_type == "kpi_indicator":
        query = select(EventLink).where(
            EventLink.kpi_indicator_id == target_id,
            EventLink.deleted_at.is_(None)
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid target_type. Must be 'okr_key_result' or 'kpi_indicator'"
        )

    # Load with relationships
    query = query.options(
        selectinload(EventLink.event),
        selectinload(EventLink.task),
        selectinload(EventLink.project)
    )

    result = await session.execute(query)
    links = result.scalars().all()

    if not links:
        raise HTTPException(status_code=404, detail="No links found for this target")

    # Calculate progress for each source
    sources: List[SourceProgressSummary] = []
    total_weighted_progress = 0.0
    active_count = 0

    for link in links:
        if link.is_active:
            active_count += 1

        source_progress = link.get_source_progress()
        weighted_contribution = link.calculate_weighted_contribution()
        total_weighted_progress += weighted_contribution

        # Determine source ID and type
        if link.event_id:
            source_id = link.event_id
            source_type = "event"
        elif link.task_id:
            source_id = link.task_id
            source_type = "task"
        elif link.project_id:
            source_id = link.project_id
            source_type = "project"
        else:
            continue  # Skip if no source (shouldn't happen due to constraints)

        sources.append(SourceProgressSummary(
            source_id=source_id,
            source_type=source_type,
            link_type=link.link_type,
            weight=link.weight,
            source_progress=source_progress,
            weighted_contribution=weighted_contribution
        ))

    return TargetProgressReport(
        target_id=target_id,
        target_type=target_type,
        total_links=len(links),
        active_links=active_count,
        total_weighted_progress=total_weighted_progress,
        sources=sources
    )
