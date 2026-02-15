"""
Notification models for user notifications and system alerts
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Text,
    Enum as SQLEnum,
    DateTime,
    ForeignKey,
    Index,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from liderix_api.db import Base
from liderix_api.enums import NotificationType, NotificationStatus, NotificationChannel
from .mixins import TimestampMixin, SoftDeleteMixin, OrgFKMixin


class Notification(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    """User notifications and system alerts"""
    __tablename__ = "notifications"

    __table_args__ = (
        Index("ix_notification_user", "user_id"),
        Index("ix_notification_type", "type"),
        Index("ix_notification_status", "status"),
        Index("ix_notification_created", "created_at"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    type = Column(
        SQLEnum(
            NotificationType,
            name="notificationtype_new",
            native_enum=True,
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False
    )

    status = Column(
        SQLEnum(
            NotificationStatus,
            name="notificationstatus_new",
            native_enum=True,
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=NotificationStatus.UNREAD,
        nullable=False
    )

    title = Column(
        String(500),
        nullable=False
    )

    message = Column(
        Text,
        nullable=False
    )

    # Related entity references
    related_entity_type = Column(
        String(50),
        nullable=True,
        comment="Type of related entity (task, project, okr, etc.)"
    )

    related_entity_id = Column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="ID of related entity"
    )

    # Action information
    action_url = Column(
        String(1000),
        nullable=True,
        comment="URL to navigate to when notification is clicked"
    )

    action_text = Column(
        String(100),
        nullable=True,
        comment="Text for action button"
    )

    # Delivery information
    channels = Column(
        JSONB,
        nullable=True,
        default=lambda: [NotificationChannel.IN_APP.value],
        comment="List of delivery channels"
    )

    sent_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    read_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # Priority and expiration
    priority = Column(
        String(20),
        default="normal",
        nullable=False
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # Metadata
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

    user = relationship(
        "User",
        lazy="selectin"
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user_id={self.user_id} type={self.type.value}>"

    def mark_as_read(self) -> None:
        """Mark notification as read"""
        self.status = NotificationStatus.READ
        self.read_at = func.now()

    def is_expired(self) -> bool:
        """Check if notification is expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at


class NotificationPreference(Base, TimestampMixin):
    """User notification preferences and settings"""
    __tablename__ = "notification_preferences"

    __table_args__ = (
        UniqueConstraint("user_id", "type", name="uq_user_notification_pref"),
        Index("ix_notification_pref_user", "user_id"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    type = Column(
        SQLEnum(NotificationType, name='notificationtype_new', native_enum=False),
        nullable=False
    )

    # Channel preferences
    in_app_enabled = Column(
        Boolean,
        default=True,
        nullable=False
    )

    email_enabled = Column(
        Boolean,
        default=True,
        nullable=False
    )

    sms_enabled = Column(
        Boolean,
        default=False,
        nullable=False
    )

    push_enabled = Column(
        Boolean,
        default=True,
        nullable=False
    )

    # Timing preferences
    immediate = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Send immediately or batch"
    )

    digest_frequency = Column(
        String(20),
        default="daily",
        nullable=True,
        comment="never, daily, weekly, monthly"
    )

    quiet_hours_start = Column(
        String(5),
        nullable=True,
        comment="Start of quiet hours (HH:MM format)"
    )

    quiet_hours_end = Column(
        String(5),
        nullable=True,
        comment="End of quiet hours (HH:MM format)"
    )

    # Relationships
    user = relationship(
        "User",
        lazy="selectin"
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<NotificationPreference user_id={self.user_id} type={self.type.value}>"


class NotificationTemplate(Base, TimestampMixin, SoftDeleteMixin):
    """Templates for notification messages"""
    __tablename__ = "notification_templates"

    __table_args__ = (
        UniqueConstraint("type", "channel", name="uq_notification_template"),
        Index("ix_notification_template_type", "type"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    type = Column(
        SQLEnum(NotificationType, name='notificationtype_new', native_enum=False),
        nullable=False
    )

    channel = Column(
        SQLEnum(NotificationChannel),
        nullable=False
    )

    title_template = Column(
        String(500),
        nullable=False,
        comment="Title template with placeholders"
    )

    message_template = Column(
        Text,
        nullable=False,
        comment="Message template with placeholders"
    )

    subject_template = Column(
        String(200),
        nullable=True,
        comment="Email subject template"
    )

    # Template variables
    required_variables = Column(
        JSONB,
        nullable=True,
        default=lambda: [],
        comment="List of required template variables"
    )

    optional_variables = Column(
        JSONB,
        nullable=True,
        default=lambda: [],
        comment="List of optional template variables"
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    # Metadata
    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<NotificationTemplate type={self.type.value} channel={self.channel.value}>"

    def render(self, variables: dict) -> dict:
        """Render template with provided variables"""

        def replace_vars(template: str) -> str:
            if not template:
                return ""

            for key, value in variables.items():
                placeholder = f"{{{key}}}"
                template = template.replace(placeholder, str(value))
            return template

        return {
            "title": replace_vars(self.title_template),
            "message": replace_vars(self.message_template),
            "subject": replace_vars(self.subject_template) if self.subject_template else None
        }
