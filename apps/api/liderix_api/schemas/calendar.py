"""
Calendar and Event Pydantic schemas for API request/response validation
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from liderix_api.enums import EventType, EventStatus, RecurrenceType


# ============================================================================
# Event Attendee Schemas
# ============================================================================

class EventAttendeeBase(BaseModel):
    """Base schema for event attendees"""
    user_id: Optional[UUID] = Field(None, description="User ID (for internal users)")
    email: Optional[str] = Field(None, description="Email (for external attendees)")
    display_name: Optional[str] = Field(None, description="Display name (for external attendees)")
    is_required: bool = Field(True, description="Is attendance required")
    notes: Optional[str] = Field(None, description="Attendee notes")


class EventAttendeeCreate(EventAttendeeBase):
    """Schema for creating event attendee"""
    pass


class EventAttendeeUpdate(BaseModel):
    """Schema for updating attendee status"""
    status: str = Field(..., description="pending, accepted, declined, tentative")
    notes: Optional[str] = Field(None, description="Response notes")


class EventAttendeeResponse(EventAttendeeBase):
    """Schema for event attendee response"""
    id: UUID
    event_id: UUID
    status: str
    is_organizer: bool
    response_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# Recurrence Pattern Schema
# ============================================================================

class RecurrencePattern(BaseModel):
    """Recurrence configuration schema"""
    interval: int = Field(1, ge=1, description="Repeat every N units (e.g., every 2 weeks)")
    days_of_week: Optional[List[int]] = Field(
        None,
        description="Days of week (0=Monday, 6=Sunday) for weekly recurrence"
    )
    day_of_month: Optional[int] = Field(
        None,
        ge=1,
        le=31,
        description="Day of month for monthly recurrence"
    )
    month_of_year: Optional[int] = Field(
        None,
        ge=1,
        le=12,
        description="Month of year for yearly recurrence"
    )
    count: Optional[int] = Field(
        None,
        ge=1,
        description="Number of occurrences (alternative to end_date)"
    )
    exceptions: Optional[List[datetime]] = Field(
        None,
        description="Exception dates (EXDATE in RRULE)"
    )


# ============================================================================
# Calendar Event Schemas
# ============================================================================

class CalendarEventBase(BaseModel):
    """Base schema for calendar events"""
    title: str = Field(..., min_length=1, max_length=500, description="Event title")
    description: Optional[str] = Field(None, description="Event description")
    event_type: EventType = Field(EventType.MEETING, description="Event type")
    start_date: datetime = Field(..., description="Event start date/time (ISO 8601)")
    end_date: datetime = Field(..., description="Event end date/time (ISO 8601)")
    is_all_day: bool = Field(False, description="Is this an all-day event")
    timezone: str = Field("UTC", description="Event timezone (IANA format)")

    # Location and meeting
    location: Optional[str] = Field(None, max_length=500, description="Physical location")
    meeting_url: Optional[str] = Field(None, max_length=1000, description="Video meeting URL")
    meeting_id: Optional[str] = Field(None, max_length=100, description="Meeting ID")
    meeting_password: Optional[str] = Field(None, max_length=100, description="Meeting password")

    # Recurrence
    recurrence_type: RecurrenceType = Field(
        RecurrenceType.NONE,
        description="Recurrence type"
    )
    recurrence_pattern: Optional[RecurrencePattern] = Field(
        None,
        description="Recurrence configuration"
    )
    recurrence_end_date: Optional[datetime] = Field(
        None,
        description="End date for recurring events"
    )

    # Settings
    is_private: bool = Field(False, description="Is event private")
    is_important: bool = Field(False, description="Is event important/high priority")
    reminder_minutes: Optional[int] = Field(None, ge=0, description="Reminder before event (minutes)")
    color: Optional[str] = Field("#3174ad", pattern="^#[0-9A-Fa-f]{6}$", description="Hex color")

    # Metadata
    meta_data: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    @model_validator(mode='after')
    def validate_dates(self) -> 'CalendarEventBase':
        """Validate that end_date is after start_date"""
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self

    @field_validator('recurrence_pattern')
    def validate_recurrence(cls, v: Optional[RecurrencePattern], info) -> Optional[RecurrencePattern]:
        """Validate recurrence pattern is provided when recurrence_type is not NONE"""
        if info.data.get('recurrence_type') != RecurrenceType.NONE and not v:
            raise ValueError("recurrence_pattern is required when recurrence_type is not NONE")
        return v


class CalendarEventCreate(CalendarEventBase):
    """Schema for creating calendar events"""
    # Related entities (optional)
    task_id: Optional[UUID] = Field(None, description="Related task ID")
    project_id: Optional[UUID] = Field(None, description="Related project ID")
    okr_id: Optional[UUID] = Field(None, description="Related OKR ID")

    # Attendees
    attendees: Optional[List[EventAttendeeCreate]] = Field(
        None,
        description="Event attendees"
    )


class CalendarEventUpdate(BaseModel):
    """Schema for updating calendar events (all fields optional)"""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    event_type: Optional[EventType] = None
    status: Optional[EventStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_all_day: Optional[bool] = None
    timezone: Optional[str] = None
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    meeting_id: Optional[str] = None
    meeting_password: Optional[str] = None
    recurrence_type: Optional[RecurrenceType] = None
    recurrence_pattern: Optional[RecurrencePattern] = None
    recurrence_end_date: Optional[datetime] = None
    is_private: Optional[bool] = None
    is_important: Optional[bool] = None
    reminder_minutes: Optional[int] = Field(None, ge=0)
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    meta_data: Optional[Dict[str, Any]] = None

    @model_validator(mode='after')
    def validate_dates_if_both_present(self) -> 'CalendarEventUpdate':
        """Validate dates only if both are provided"""
        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class CalendarEventResponse(CalendarEventBase):
    """Schema for calendar event response"""
    id: UUID
    org_id: UUID
    creator_id: Optional[UUID] = None
    status: EventStatus

    # Related entities
    task_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    okr_id: Optional[UUID] = None

    # Recurrence
    parent_event_id: Optional[UUID] = None

    # External
    external_id: Optional[str] = None
    external_source: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    is_deleted: bool = False

    # Relationships
    attendees: List[EventAttendeeResponse] = Field(default_factory=list)

    # Computed
    duration_minutes: Optional[int] = Field(None, description="Event duration in minutes")

    class Config:
        from_attributes = True


class CalendarEventListResponse(BaseModel):
    """Schema for paginated event list response"""
    events: List[CalendarEventResponse]
    total: int
    page: int = 1
    page_size: int = 50
    has_next: bool = False


class RitualBootstrapResponse(BaseModel):
    okr_reviews_created: int
    okr_reviews_skipped: int
    project_milestones_created: int
    project_milestones_skipped: int


# ============================================================================
# Calendar Container Schemas
# ============================================================================

class CalendarBase(BaseModel):
    """Base schema for calendar containers"""
    name: str = Field(..., min_length=1, max_length=200, description="Calendar name")
    description: Optional[str] = Field(None, description="Calendar description")
    color: str = Field("#3174ad", pattern="^#[0-9A-Fa-f]{6}$", description="Calendar color")
    is_public: bool = Field(False, description="Is calendar publicly visible")
    timezone: str = Field("UTC", description="Calendar timezone")
    default_reminder_minutes: Optional[int] = Field(15, ge=0, description="Default reminder time")


class CalendarCreate(CalendarBase):
    """Schema for creating calendars"""
    is_default: bool = Field(False, description="Set as default calendar for user")


class CalendarUpdate(BaseModel):
    """Schema for updating calendars (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    timezone: Optional[str] = None
    default_reminder_minutes: Optional[int] = Field(None, ge=0)


class CalendarResponse(CalendarBase):
    """Schema for calendar response"""
    id: UUID
    org_id: UUID
    owner_id: UUID
    is_default: bool
    is_active: bool
    sync_enabled: bool
    last_sync_at: Optional[datetime] = None
    external_id: Optional[str] = None
    external_source: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CalendarListResponse(BaseModel):
    """Schema for calendar list response"""
    calendars: List[CalendarResponse]
    total: int


# ============================================================================
# Calendar Permission Schemas
# ============================================================================

class CalendarPermissionBase(BaseModel):
    """Base schema for calendar permissions"""
    user_id: UUID = Field(..., description="User to grant permission to")
    permission: str = Field(..., description="Permission level: read, write, admin")

    @field_validator('permission')
    def validate_permission(cls, v: str) -> str:
        """Validate permission level"""
        if v not in ['read', 'write', 'admin']:
            raise ValueError("permission must be one of: read, write, admin")
        return v


class CalendarPermissionCreate(CalendarPermissionBase):
    """Schema for creating calendar permission"""
    pass


class CalendarPermissionUpdate(BaseModel):
    """Schema for updating calendar permission"""
    permission: str = Field(..., description="Permission level: read, write, admin")

    @field_validator('permission')
    def validate_permission(cls, v: str) -> str:
        """Validate permission level"""
        if v not in ['read', 'write', 'admin']:
            raise ValueError("permission must be one of: read, write, admin")
        return v


class CalendarPermissionResponse(CalendarPermissionBase):
    """Schema for calendar permission response"""
    id: UUID
    calendar_id: UUID
    granted_by_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# Query Parameter Schemas
# ============================================================================

class EventQueryParams(BaseModel):
    """Schema for event query parameters"""
    start_date: Optional[datetime] = Field(None, description="Filter events starting from this date")
    end_date: Optional[datetime] = Field(None, description="Filter events until this date")
    event_type: Optional[EventType] = Field(None, description="Filter by event type")
    status: Optional[EventStatus] = Field(None, description="Filter by status")
    task_id: Optional[UUID] = Field(None, description="Filter by related task")
    project_id: Optional[UUID] = Field(None, description="Filter by related project")
    okr_id: Optional[UUID] = Field(None, description="Filter by related OKR")
    creator_id: Optional[UUID] = Field(None, description="Filter by creator")
    is_private: Optional[bool] = Field(None, description="Filter by privacy")
    search: Optional[str] = Field(None, description="Search in title and description")
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(50, ge=1, le=100, description="Items per page")
    sort_by: str = Field("start_date", description="Sort field")
    sort_order: str = Field("asc", description="Sort order: asc or desc")

    @field_validator('sort_order')
    def validate_sort_order(cls, v: str) -> str:
        """Validate sort order"""
        if v not in ['asc', 'desc']:
            raise ValueError("sort_order must be 'asc' or 'desc'")
        return v


# ============================================================================
# Bulk Operations
# ============================================================================

class BulkEventStatusUpdate(BaseModel):
    """Schema for bulk event status update"""
    event_ids: List[UUID] = Field(..., min_length=1, max_length=100, description="Event IDs to update")
    status: EventStatus = Field(..., description="New status")


class BulkEventDelete(BaseModel):
    """Schema for bulk event deletion"""
    event_ids: List[UUID] = Field(..., min_length=1, max_length=100, description="Event IDs to delete")
    delete_recurring: bool = Field(False, description="Delete all recurring instances")


# ============================================================================
# Response Messages
# ============================================================================

class EventOperationResponse(BaseModel):
    """Generic response for event operations"""
    message: str
    event_id: Optional[UUID] = None
    affected_count: Optional[int] = None
