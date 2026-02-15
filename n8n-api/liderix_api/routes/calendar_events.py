"""
Calendar Events API routes
Handles calendar events, recurring events, and attendee management
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
import logging

from fastapi import (
    APIRouter, Depends, HTTPException, status, Response, Request,
    Query
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, and_, or_, delete as sql_delete
from sqlalchemy.orm import selectinload, noload
from sqlalchemy.exc import IntegrityError

from liderix_api.db import get_async_session
from liderix_api.models.calendar import CalendarEvent, EventAttendee
from liderix_api.models.users import User
from liderix_api.models.memberships import Membership, MembershipStatus
from liderix_api.models.tasks import Task
from liderix_api.models.projects import Project
from liderix_api.models.okrs import Objective, ObjectiveStatus
from liderix_api.schemas.calendar import (
    CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse,
    CalendarEventListResponse, EventAttendeeUpdate, EventAttendeeResponse,
    EventOperationResponse, BulkEventStatusUpdate,
    BulkEventDelete, RitualBootstrapResponse
)
from liderix_api.enums import EventType, EventStatus, RecurrenceType
from liderix_api.services.auth import get_current_user
from liderix_api.services.audit import AuditLogger
from liderix_api.services.permissions import check_organization_permission

router = APIRouter(tags=["Calendar Events"])
logger = logging.getLogger(__name__)


# ============================================================================
# Helper Functions
# ============================================================================

def now_utc() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)


def problem(status_code: int, type_: str, title: str, detail: str):
    """Raise HTTP exception with RFC 7807 problem details"""
    raise HTTPException(
        status_code=status_code,
        detail={"type": type_, "title": title, "detail": detail, "status": status_code},
    )


async def _get_event_with_access(
    session: AsyncSession,
    event_id: UUID,
    current_user: User,
    required_permission: str = "read"
) -> CalendarEvent:
    """Get event with access validation"""
    event = await session.scalar(
        select(CalendarEvent)
        .options(
            noload("*"),
            selectinload(CalendarEvent.creator),
            selectinload(CalendarEvent.attendees),
            selectinload(CalendarEvent.task),
            selectinload(CalendarEvent.project),
        )
        .where(CalendarEvent.id == event_id)
    )

    if not event:
        problem(404, "urn:problem:event-not-found", "Event Not Found",
                "Event does not exist")

    if event.deleted_at is not None:
        problem(404, "urn:problem:event-deleted", "Event Deleted",
                "Event has been deleted")

    # Check access permissions
    has_access = await _check_event_permission(session, event, current_user, required_permission)
    if not has_access:
        problem(403, "urn:problem:access-denied", "Access Denied",
                f"You don't have {required_permission} permission for this event")

    return event


async def _check_event_permission(
    session: AsyncSession,
    event: CalendarEvent,
    user: User,
    permission: str
) -> bool:
    """Check if user has permission for event"""
    # Event creator has all permissions
    if event.creator_id == user.id:
        return True

    # Check if user is an attendee
    is_attendee = any(
        att.user_id == user.id for att in event.attendees if att.user_id
    )
    if is_attendee and permission == "read":
        return True

    # If event is public (not private), users in same org can read
    if not event.is_private and permission == "read":
        # Check org membership
        if await check_organization_permission(session, event.org_id, user, "read"):
            return True

    # Check if event is linked to a project/task user has access to
    if event.project_id:
        from liderix_api.services.permissions import check_project_permission
        project = await session.get(Project, event.project_id)
        if project and await check_project_permission(session, project, user, permission):
            return True

    return False


async def _validate_related_entities(
    session: AsyncSession,
    org_id: UUID,
    task_id: Optional[UUID],
    project_id: Optional[UUID],
    okr_id: Optional[UUID]
) -> Dict[str, Any]:
    """Validate that related entities exist and belong to the same org"""
    validated = {}

    if task_id:
        task = await session.get(Task, task_id)
        if not task or task.deleted_at:
            problem(404, "urn:problem:task-not-found", "Task Not Found",
                    "Related task does not exist")
        if task.org_id != org_id:
            problem(400, "urn:problem:org-mismatch", "Organization Mismatch",
                    "Related task belongs to different organization")
        validated['task'] = task

    if project_id:
        project = await session.get(Project, project_id)
        if not project or project.deleted_at:
            problem(404, "urn:problem:project-not-found", "Project Not Found",
                    "Related project does not exist")
        if project.org_id != org_id:
            problem(400, "urn:problem:org-mismatch", "Organization Mismatch",
                    "Related project belongs to different organization")
        validated['project'] = project

    if okr_id:
        # Assuming OKR model exists with org_id
        from liderix_api.models.okrs import Objective
        okr = await session.get(Objective, okr_id)
        if not okr or okr.deleted_at:
            problem(404, "urn:problem:okr-not-found", "OKR Not Found",
                    "Related OKR does not exist")
        if okr.org_id != org_id:
            problem(400, "urn:problem:org-mismatch", "Organization Mismatch",
                    "Related OKR belongs to different organization")
        validated['okr'] = okr

    return validated


async def _create_attendees(
    session: AsyncSession,
    event_id: UUID,
    attendees_data: Optional[List],
    creator_id: UUID
) -> List[EventAttendee]:
    """Create event attendees"""
    if not attendees_data:
        return []

    attendees = []

    # Always add creator as organizer
    creator_attendee = EventAttendee(
        id=uuid4(),
        event_id=event_id,
        user_id=creator_id,
        status="accepted",
        is_organizer=True,
        is_required=True,
        created_at=now_utc()
    )
    attendees.append(creator_attendee)

    for att_data in attendees_data:
        # Skip if already added creator
        if att_data.user_id == creator_id:
            continue

        attendee = EventAttendee(
            id=uuid4(),
            event_id=event_id,
            user_id=att_data.user_id,
            email=att_data.email,
            display_name=att_data.display_name,
            is_required=att_data.is_required,
            notes=att_data.notes,
            status="pending",
            is_organizer=False,
            created_at=now_utc()
        )
        attendees.append(attendee)

    session.add_all(attendees)
    return attendees


# ============================================================================
# Event CRUD Operations
# ============================================================================


@router.post("/rituals/bootstrap", response_model=RitualBootstrapResponse)
async def bootstrap_calendar_rituals(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Create default OKR weekly reviews and project milestone events."""
    await check_organization_permission(session, current_user.org_id, current_user, "write")

    okr_reviews_created = 0
    okr_reviews_skipped = 0
    project_milestones_created = 0
    project_milestones_skipped = 0

    now = now_utc()

    objectives = (await session.execute(
        select(Objective)
        .where(
            and_(
                Objective.org_id == current_user.org_id,
                Objective.deleted_at.is_(None),
                Objective.status == ObjectiveStatus.ACTIVE,
            )
        )
    )).scalars().all()

    for objective in objectives:
        existing = await session.scalar(
            select(CalendarEvent.id).where(
                and_(
                    CalendarEvent.org_id == current_user.org_id,
                    CalendarEvent.event_type == EventType.OKR_REVIEW,
                    CalendarEvent.okr_id == objective.id,
                    CalendarEvent.deleted_at.is_(None),
                )
            )
        )
        if existing:
            okr_reviews_skipped += 1
            continue

        start_date = objective.start_date or now
        start_date = start_date.replace(hour=9, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(hours=1)
        recurrence_pattern = {"interval": 1, "days_of_week": [start_date.weekday()]}

        event = CalendarEvent(
            id=uuid4(),
            org_id=current_user.org_id,
            creator_id=current_user.id,
            title=f"OKR Review: {objective.title}",
            description=objective.description,
            event_type=EventType.OKR_REVIEW,
            status=EventStatus.CONFIRMED,
            start_date=start_date,
            end_date=end_date,
            is_all_day=False,
            timezone="UTC",
            okr_id=objective.id,
            recurrence_type=RecurrenceType.WEEKLY,
            recurrence_pattern=recurrence_pattern,
            recurrence_end_date=objective.due_date,
            meta_data={"auto_generated": True, "ritual": "okr_weekly_review"},
            created_at=now,
        )
        session.add(event)
        okr_reviews_created += 1

    projects = (await session.execute(
        select(Project)
        .where(
            and_(
                Project.org_id == current_user.org_id,
                Project.deleted_at.is_(None),
                Project.end_date.is_not(None),
            )
        )
    )).scalars().all()

    for project in projects:
        existing = await session.scalar(
            select(CalendarEvent.id).where(
                and_(
                    CalendarEvent.org_id == current_user.org_id,
                    CalendarEvent.event_type == EventType.PROJECT_MILESTONE,
                    CalendarEvent.project_id == project.id,
                    CalendarEvent.deleted_at.is_(None),
                )
            )
        )
        if existing:
            project_milestones_skipped += 1
            continue

        start_date = project.end_date
        end_date = start_date + timedelta(hours=1)
        event = CalendarEvent(
            id=uuid4(),
            org_id=current_user.org_id,
            creator_id=current_user.id,
            title=f"Project milestone: {project.name}",
            description=project.description,
            event_type=EventType.PROJECT_MILESTONE,
            status=EventStatus.CONFIRMED,
            start_date=start_date,
            end_date=end_date,
            is_all_day=True,
            timezone="UTC",
            project_id=project.id,
            meta_data={"auto_generated": True, "ritual": "project_milestone"},
            created_at=now,
        )
        session.add(event)
        project_milestones_created += 1

    if okr_reviews_created or project_milestones_created:
        await session.commit()

    await AuditLogger.log_event(
        session,
        current_user.id,
        "calendar.rituals.bootstrap",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {
            "okr_created": okr_reviews_created,
            "okr_skipped": okr_reviews_skipped,
            "project_created": project_milestones_created,
            "project_skipped": project_milestones_skipped,
        },
    )

    return RitualBootstrapResponse(
        okr_reviews_created=okr_reviews_created,
        okr_reviews_skipped=okr_reviews_skipped,
        project_milestones_created=project_milestones_created,
        project_milestones_skipped=project_milestones_skipped,
    )

@router.get("", response_model=CalendarEventListResponse)
@router.get("/", response_model=CalendarEventListResponse)
async def list_events(
    request: Request,
    start_date: Optional[datetime] = Query(None, description="Filter events from this date"),
    end_date: Optional[datetime] = Query(None, description="Filter events until this date"),
    event_type: Optional[EventType] = Query(None, description="Filter by event type"),
    status: Optional[EventStatus] = Query(None, description="Filter by status"),
    project_id: Optional[UUID] = Query(None, description="Filter by project"),
    task_id: Optional[UUID] = Query(None, description="Filter by task"),
    okr_id: Optional[UUID] = Query(None, description="Filter by OKR"),
    search: Optional[str] = Query(None, description="Search in title/description"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """List calendar events with filtering and pagination"""

    # Build base query
    query = select(CalendarEvent).options(
        noload("*"),
        selectinload(CalendarEvent.creator),
        selectinload(CalendarEvent.attendees),
        selectinload(CalendarEvent.task),
        selectinload(CalendarEvent.project),
    )

    filters = [CalendarEvent.deleted_at.is_(None)]

    # Access control - user can see events where they are:
    # 1. Creator
    # 2. Attendee
    # 3. Public events in their organizations
    # 4. Events linked to their projects

    # Get user's organization IDs
    user_orgs = await session.scalars(
        select(Membership.org_id).where(
            and_(
                Membership.user_id == current_user.id,
                Membership.deleted_at.is_(None),
                Membership.status == MembershipStatus.ACTIVE,
            )
        )
    )
    user_org_ids = list(user_orgs)

    # Build access filter
    access_filters = [
        CalendarEvent.creator_id == current_user.id,
    ]

    # Events where user is attendee
    attendee_event_ids_query = select(EventAttendee.event_id).where(
        EventAttendee.user_id == current_user.id
    )
    access_filters.append(CalendarEvent.id.in_(attendee_event_ids_query))

    # Public events in user's organizations
    if user_org_ids:
        access_filters.append(
            and_(
                CalendarEvent.org_id.in_(user_org_ids),
                CalendarEvent.is_private.is_(False)
            )
        )

    filters.append(or_(*access_filters))

    # Apply date range filter
    if start_date:
        filters.append(CalendarEvent.start_date >= start_date)
    if end_date:
        filters.append(CalendarEvent.end_date <= end_date)

    # Apply other filters
    if event_type:
        filters.append(CalendarEvent.event_type == event_type)
    if status:
        filters.append(CalendarEvent.status == status)
    if project_id:
        filters.append(CalendarEvent.project_id == project_id)
    if task_id:
        filters.append(CalendarEvent.task_id == task_id)
    if okr_id:
        filters.append(CalendarEvent.okr_id == okr_id)

    # Search filter
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        filters.append(
            or_(
                CalendarEvent.title.ilike(search_term),
                CalendarEvent.description.ilike(search_term),
            )
        )

    # Get total count
    total = await session.scalar(
        select(func.count(CalendarEvent.id)).where(*filters)
    ) or 0

    # Apply sorting and pagination
    events = await session.scalars(
        query.where(*filters)
        .order_by(CalendarEvent.start_date.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = list(events)

    await AuditLogger.log_event(
        session, current_user.id, "calendar_events.list", True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"page": page, "page_size": page_size, "total": total}
    )

    return CalendarEventListResponse(
        events=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=page * page_size < total,
    )


@router.post("/", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    data: CalendarEventCreate,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new calendar event"""

    # Get user's active organization
    membership = await session.scalar(
        select(Membership).where(
            and_(
                Membership.user_id == current_user.id,
                Membership.status == MembershipStatus.ACTIVE,
                Membership.deleted_at.is_(None),
            )
        ).limit(1)
    )

    if not membership:
        problem(400, "urn:problem:no-organization", "No Organization",
                "User must belong to an organization to create events")

    org_id = membership.org_id

    # Validate related entities
    await _validate_related_entities(
        session, org_id,
        data.task_id, data.project_id, data.okr_id
    )

    # Create event
    event = CalendarEvent(
        id=uuid4(),
        org_id=org_id,
        creator_id=current_user.id,
        title=data.title.strip(),
        description=data.description.strip() if data.description else None,
        event_type=data.event_type,
        status=EventStatus.CONFIRMED,
        start_date=data.start_date,
        end_date=data.end_date,
        is_all_day=data.is_all_day,
        timezone=data.timezone,
        location=data.location,
        meeting_url=data.meeting_url,
        meeting_id=data.meeting_id,
        meeting_password=data.meeting_password,
        recurrence_type=data.recurrence_type,
        recurrence_pattern=data.recurrence_pattern.model_dump() if data.recurrence_pattern else None,
        recurrence_end_date=data.recurrence_end_date,
        task_id=data.task_id,
        project_id=data.project_id,
        okr_id=data.okr_id,
        is_private=data.is_private,
        is_important=data.is_important,
        reminder_minutes=data.reminder_minutes,
        color=data.color,
        meta_data=data.meta_data or {},
        created_at=now_utc(),
        updated_at=now_utc(),
    )

    session.add(event)

    try:
        await session.flush()  # Flush to get event.id

        # Create attendees
        if data.attendees:
            await _create_attendees(session, event.id, data.attendees, current_user.id)

        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        logger.error(f"Failed to create event: {e}")
        problem(409, "urn:problem:event-creation-failed", "Event Creation Failed",
                "Failed to create event due to data constraint violation")

    await session.refresh(event)

    # Set location header
    response.headers["Location"] = f"/api/calendar-events/{event.id}"

    await AuditLogger.log_event(
        session, current_user.id, "calendar_event.create", True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {
            "event_id": str(event.id),
            "title": event.title,
            "event_type": event.event_type,
        }
    )

    # Load with relationships
    event_with_details = await session.scalar(
        select(CalendarEvent)
        .options(
            noload("*"),
            selectinload(CalendarEvent.creator),
            selectinload(CalendarEvent.attendees),
        )
        .where(CalendarEvent.id == event.id)
    )

    return event_with_details


@router.get("/{event_id}", response_model=CalendarEventResponse)
async def get_event(
    event_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Get event by ID"""
    event = await _get_event_with_access(session, event_id, current_user, "read")

    await AuditLogger.log_event(
        session, current_user.id, "calendar_event.view", True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"event_id": str(event_id)}
    )

    return event


@router.patch("/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: UUID,
    data: CalendarEventUpdate,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Update calendar event"""
    event = await _get_event_with_access(session, event_id, current_user, "write")

    # Track changes
    changes = {}
    payload = data.model_dump(exclude_unset=True)

    # Apply changes
    for field, value in payload.items():
        if field == "recurrence_pattern" and value:
            value = value.model_dump()
        old_value = getattr(event, field)
        if old_value != value:
            changes[field] = {"old": old_value, "new": value}
            setattr(event, field, value)

    event.updated_at = now_utc()

    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        logger.error(f"Failed to update event {event_id}: {e}")
        problem(409, "urn:problem:update-failed", "Update Failed",
                "Failed to update event due to data constraint violation")

    await session.refresh(event)

    await AuditLogger.log_event(
        session, current_user.id, "calendar_event.update", True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"event_id": str(event_id), "changes": changes}
    )

    return event


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    event_id: UUID,
    request: Request,
    hard_delete: bool = Query(False, description="Permanently delete event"),
    delete_recurring: bool = Query(False, description="Delete all recurring instances"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Delete calendar event"""
    event = await _get_event_with_access(session, event_id, current_user, "delete")

    affected_count = 1

    if hard_delete:
        # Delete attendees first
        await session.execute(
            sql_delete(EventAttendee).where(EventAttendee.event_id == event_id)
        )

        # Delete recurring instances if requested
        if delete_recurring and event.parent_event_id is None:
            recurring_instances = await session.scalars(
                select(CalendarEvent).where(CalendarEvent.parent_event_id == event_id)
            )
            for instance in recurring_instances:
                await session.execute(
                    sql_delete(EventAttendee).where(EventAttendee.event_id == instance.id)
                )
                await session.delete(instance)
                affected_count += 1

        await session.delete(event)
        action = "calendar_event.hard_delete"
    else:
        # Soft delete
        event.deleted_at = now_utc()
        event.status = EventStatus.CANCELLED

        # Soft delete recurring instances if requested
        if delete_recurring and event.parent_event_id is None:
            result = await session.execute(
                update(CalendarEvent)
                .where(CalendarEvent.parent_event_id == event_id)
                .values(deleted_at=now_utc(), status=EventStatus.CANCELLED)
            )
            affected_count += result.rowcount

        action = "calendar_event.soft_delete"

    await session.commit()

    await AuditLogger.log_event(
        session, current_user.id, action, True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {
            "event_id": str(event_id),
            "title": event.title,
            "hard_delete": hard_delete,
            "delete_recurring": delete_recurring,
            "affected_count": affected_count,
        }
    )


# ============================================================================
# Event Attendees Management
# ============================================================================

@router.get("/{event_id}/attendees", response_model=List[EventAttendeeResponse])
async def get_event_attendees(
    event_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Get event attendees"""
    await _get_event_with_access(session, event_id, current_user, "read")

    attendees = await session.scalars(
        select(EventAttendee)
        .options(selectinload(EventAttendee.user))
        .where(EventAttendee.event_id == event_id)
        .order_by(EventAttendee.is_organizer.desc(), EventAttendee.created_at.asc())
    )

    return list(attendees)


@router.patch("/{event_id}/attendees/{attendee_id}", response_model=EventAttendeeResponse)
async def update_attendee_status(
    event_id: UUID,
    attendee_id: UUID,
    data: EventAttendeeUpdate,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Update attendee RSVP status"""
    # Verify event exists and user has access
    await _get_event_with_access(session, event_id, current_user, "read")

    attendee = await session.scalar(
        select(EventAttendee).where(
            and_(
                EventAttendee.id == attendee_id,
                EventAttendee.event_id == event_id,
            )
        )
    )

    if not attendee:
        problem(404, "urn:problem:attendee-not-found", "Attendee Not Found",
                "Attendee does not exist")

    # Only the attendee themselves can update their status
    if attendee.user_id != current_user.id:
        problem(403, "urn:problem:access-denied", "Access Denied",
                "You can only update your own RSVP status")

    old_status = attendee.status
    attendee.status = data.status
    attendee.notes = data.notes
    attendee.response_date = now_utc()
    attendee.updated_at = now_utc()

    await session.commit()
    await session.refresh(attendee)

    await AuditLogger.log_event(
        session, current_user.id, "calendar_event.rsvp", True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {
            "event_id": str(event_id),
            "attendee_id": str(attendee_id),
            "old_status": old_status,
            "new_status": data.status,
        }
    )

    return attendee


# ============================================================================
# Bulk Operations
# ============================================================================

@router.post("/bulk/status", response_model=EventOperationResponse)
async def bulk_update_status(
    data: BulkEventStatusUpdate,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Bulk update event status"""
    updated_count = 0

    for event_id in data.event_ids:
        try:
            event = await _get_event_with_access(session, event_id, current_user, "write")
            event.status = data.status
            event.updated_at = now_utc()
            updated_count += 1
        except HTTPException:
            continue  # Skip events user doesn't have access to

    await session.commit()

    await AuditLogger.log_event(
        session, current_user.id, "calendar_events.bulk_status_update", True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {
            "requested_count": len(data.event_ids),
            "updated_count": updated_count,
            "new_status": data.status,
        }
    )

    return EventOperationResponse(
        message=f"Successfully updated {updated_count} event(s)",
        affected_count=updated_count
    )


@router.post("/bulk/delete", response_model=EventOperationResponse)
async def bulk_delete_events(
    data: BulkEventDelete,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Bulk delete events"""
    deleted_count = 0

    for event_id in data.event_ids:
        try:
            event = await _get_event_with_access(session, event_id, current_user, "delete")
            event.deleted_at = now_utc()
            event.status = EventStatus.CANCELLED
            deleted_count += 1
        except HTTPException:
            continue

    await session.commit()

    await AuditLogger.log_event(
        session, current_user.id, "calendar_events.bulk_delete", True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {
            "requested_count": len(data.event_ids),
            "deleted_count": deleted_count,
        }
    )

    return EventOperationResponse(
        message=f"Successfully deleted {deleted_count} event(s)",
        affected_count=deleted_count
    )
