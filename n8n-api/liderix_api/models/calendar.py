"""
Calendar and Event models for scheduling and time management
"""

from __future__ import annotations

import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    Enum as SQLEnum,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Boolean,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from liderix_api.db import Base
from liderix_api.enums import EventType, EventStatus, RecurrenceType
from .mixins import TimestampMixin, SoftDeleteMixin, OrgFKMixin


class CalendarEvent(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    """Calendar events and meetings"""
    __tablename__ = "calendar_events"

    __table_args__ = (
        Index("ix_event_dates", "start_date", "end_date"),
        Index("ix_event_org_type", "org_id", "event_type"),
        Index("ix_event_creator", "creator_id"),
        CheckConstraint("end_date >= start_date", name="chk_event_dates"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    title = Column(
        String(500),
        nullable=False,
        index=True
    )

    description = Column(
        Text,
        nullable=True
    )

    event_type = Column(
        SQLEnum(
            EventType,
            name="eventtype",
            native_enum=True,
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=EventType.MEETING,
        nullable=False,
    )

    status = Column(
        SQLEnum(
            EventStatus,
            name="eventstatus",
            native_enum=True,
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=EventStatus.CONFIRMED,
        nullable=False,
    )

    # Time and duration
    start_date = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )

    end_date = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )

    is_all_day = Column(
        Boolean,
        default=False,
        nullable=False
    )

    timezone = Column(
        String(50),
        nullable=True,
        default="UTC"
    )

    # Location and meeting details
    location = Column(
        String(500),
        nullable=True
    )

    meeting_url = Column(
        String(1000),
        nullable=True
    )

    meeting_id = Column(
        String(100),
        nullable=True
    )

    meeting_password = Column(
        String(100),
        nullable=True
    )

    # Relationships
    creator_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Related entities
    task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    project_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    okr_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("objectives.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Recurrence
    recurrence_type = Column(
        SQLEnum(
            RecurrenceType,
            name="recurrencetype",
            native_enum=True,
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=RecurrenceType.NONE,
        nullable=False,
    )

    recurrence_pattern = Column(
        JSONB,
        nullable=True,
        comment="Recurrence configuration: interval, days_of_week, etc."
    )

    recurrence_end_date = Column(
        DateTime(timezone=True),
        nullable=True
    )

    parent_event_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="For recurring event instances"
    )

    # Settings
    is_private = Column(
        Boolean,
        default=False,
        nullable=False
    )

    is_important = Column(
        Boolean,
        default=False,
        nullable=False
    )

    reminder_minutes = Column(
        Integer,
        nullable=True,
        comment="Minutes before event to send reminder"
    )

    color = Column(
        String(7),  # Hex color
        nullable=True,
        default="#3174ad"
    )

    # Metadata
    external_id = Column(
        String(255),
        nullable=True,
        comment="External calendar system ID"
    )

    external_source = Column(
        String(100),
        nullable=True,
        comment="google, outlook, etc."
    )

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )

    # SQLAlchemy relationships
    organization = relationship(
        "Organization",
        lazy="selectin",
        overlaps="calendar_events"
    )

    creator = relationship(
        "User",
        foreign_keys=[creator_id],
        lazy="selectin"
    )

    task = relationship(
        "Task",
        lazy="selectin"
    )

    project = relationship(
        "Project",
        lazy="selectin"
    )

    # Self-referential for recurring events
    parent_event = relationship(
        "CalendarEvent",
        remote_side=[id],
        back_populates="recurring_instances",
        lazy="selectin"
    )

    recurring_instances = relationship(
        "CalendarEvent",
        back_populates="parent_event",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    # Event attendees
    attendees = relationship(
        "EventAttendee",
        back_populates="event",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<CalendarEvent id={self.id} title={self.title!r} start={self.start_date}>"

    @property
    def duration_minutes(self) -> int:
        """Calculate event duration in minutes"""
        if self.start_date and self.end_date:
            return int((self.end_date - self.start_date).total_seconds() / 60)
        return 0

    def is_recurring(self) -> bool:
        """Check if event has recurrence"""
        return self.recurrence_type != RecurrenceType.NONE

    def is_instance(self) -> bool:
        """Check if this is a recurring event instance"""
        return self.parent_event_id is not None


class EventAttendee(Base, TimestampMixin):
    """Event attendees and their RSVP status"""
    __tablename__ = "event_attendees"

    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_event_attendee"),
        Index("ix_attendee_event", "event_id"),
        Index("ix_attendee_user", "user_id"),
        Index("ix_attendee_status", "status"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    event_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    status = Column(
        SQLEnum("pending", "accepted", "declined", "tentative", name="attendee_status"),
        default="pending",
        nullable=False
    )

    is_organizer = Column(
        Boolean,
        default=False,
        nullable=False
    )

    is_required = Column(
        Boolean,
        default=True,
        nullable=False
    )

    email = Column(
        String(255),
        nullable=True,
        comment="External attendee email (non-users)"
    )

    display_name = Column(
        String(255),
        nullable=True,
        comment="External attendee name"
    )

    response_date = Column(
        DateTime(timezone=True),
        nullable=True
    )

    notes = Column(
        Text,
        nullable=True,
        comment="Attendee notes or comments"
    )

    # Relationships
    event = relationship(
        "CalendarEvent",
        back_populates="attendees",
        lazy="selectin"
    )

    user = relationship(
        "User",
        lazy="selectin"
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<EventAttendee event_id={self.event_id} user_id={self.user_id} status={self.status}>"


class Calendar(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    """Calendar containers for grouping events"""
    __tablename__ = "calendars"

    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_calendar_org_name"),
        Index("ix_calendar_owner", "owner_id"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    name = Column(
        String(200),
        nullable=False,
        index=True
    )

    description = Column(
        Text,
        nullable=True
    )

    color = Column(
        String(7),  # Hex color
        nullable=False,
        default="#3174ad"
    )

    owner_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    is_default = Column(
        Boolean,
        default=False,
        nullable=False
    )

    is_public = Column(
        Boolean,
        default=False,
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    # External calendar integration
    external_id = Column(
        String(255),
        nullable=True
    )

    external_source = Column(
        String(100),
        nullable=True
    )

    sync_enabled = Column(
        Boolean,
        default=False,
        nullable=False
    )

    last_sync_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # Settings
    timezone = Column(
        String(50),
        nullable=False,
        default="UTC"
    )

    default_reminder_minutes = Column(
        Integer,
        nullable=True,
        default=15
    )

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )

    # Relationships
    organization = relationship(
        "Organization",
        lazy="selectin"
    )

    owner = relationship(
        "User",
        lazy="selectin"
    )

    # Calendar permissions
    shared_with = relationship(
        "CalendarPermission",
        back_populates="calendar",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<Calendar id={self.id} name={self.name!r} owner_id={self.owner_id}>"


class CalendarPermission(Base, TimestampMixin):
    """Calendar sharing permissions"""
    __tablename__ = "calendar_permissions"

    __table_args__ = (
        UniqueConstraint("calendar_id", "user_id", name="uq_calendar_permission"),
        Index("ix_calendar_permission_user", "user_id"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    calendar_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("calendars.id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    permission = Column(
        SQLEnum("read", "write", "admin", name="calendar_permission_level"),
        default="read",
        nullable=False
    )

    granted_by_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    calendar = relationship(
        "Calendar",
        back_populates="shared_with",
        lazy="selectin"
    )

    user = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin"
    )

    granted_by = relationship(
        "User",
        foreign_keys=[granted_by_id],
        lazy="selectin"
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<CalendarPermission calendar_id={self.calendar_id} user_id={self.user_id} permission={self.permission}>"
