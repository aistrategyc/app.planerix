"""
EventLink model for linking calendar events, tasks, and projects to OKR Key Results and KPI Indicators.

This model enables automatic progress updates when linked items change.
"""
from __future__ import annotations

import uuid
from enum import Enum as PyEnum
from sqlalchemy import (
    Column,
    String,
    Float,
    Boolean,
    ForeignKey,
    Index,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from liderix_api.db import Base
from .mixins import TimestampMixin, SoftDeleteMixin


class LinkType(PyEnum):
    """Type of link between entities"""
    CONTRIBUTES = "contributes"  # Item contributes to OKR/KPI progress
    BLOCKS = "blocks"            # Item blocks OKR/KPI progress
    RELATES = "relates"          # Item is related but doesn't affect progress
    REQUIRED = "required"        # Item is required for OKR/KPI completion


class EventLink(Base, TimestampMixin, SoftDeleteMixin):
    """
    Links calendar events, tasks, and projects to OKR Key Results and KPI Indicators.

    Enables tracking which activities contribute to which goals and metrics.
    Supports automatic progress calculation based on linked item completion.

    Rules:
    - Exactly ONE source must be set (event_id, task_id, or project_id)
    - Exactly ONE target must be set (okr_kr_id or kpi_indicator_id)
    - Weight determines how much the source contributes to target (0.0-1.0)
    """
    __tablename__ = "event_links"

    __table_args__ = (
        # Ensure exactly one source is set
        CheckConstraint(
            """
            (event_id IS NOT NULL)::int +
            (task_id IS NOT NULL)::int +
            (project_id IS NOT NULL)::int = 1
            """,
            name="ck_event_link_one_source"
        ),
        # Ensure exactly one target is set
        CheckConstraint(
            """
            (okr_kr_id IS NOT NULL)::int +
            (kpi_indicator_id IS NOT NULL)::int = 1
            """,
            name="ck_event_link_one_target"
        ),
        # Weight must be between 0 and 1
        CheckConstraint(
            "weight >= 0.0 AND weight <= 1.0",
            name="ck_event_link_weight_range"
        ),
        # Indexes for efficient queries
        Index("ix_event_link_event", "event_id"),
        Index("ix_event_link_task", "task_id"),
        Index("ix_event_link_project", "project_id"),
        Index("ix_event_link_okr_kr", "okr_kr_id"),
        Index("ix_event_link_kpi", "kpi_indicator_id"),
        Index("ix_event_link_type", "link_type"),
        {"extend_existing": True}
    )

    # Primary key
    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    # Source: Calendar Event
    event_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Source: Task
    task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Source: Project
    project_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Target: OKR Key Result
    okr_kr_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("key_results.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Target: KPI Indicator
    kpi_indicator_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("kpi_indicators.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Link configuration
    link_type = Column(
        String(50),
        default=LinkType.CONTRIBUTES.value,
        nullable=False
    )

    weight = Column(
        Float,
        default=1.0,
        nullable=False,
        comment="Weight of this link in progress calculation (0.0-1.0)"
    )

    auto_update = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Automatically update target when source changes"
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether this link is currently active"
    )

    # Metadata
    notes = Column(
        String(500),
        nullable=True,
        comment="Optional notes about this link"
    )

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {},
        comment="Additional metadata for the link"
    )

    # Relationships
    event = relationship(
        "CalendarEvent",
        lazy="selectin",
        foreign_keys=[event_id]
    )

    task = relationship(
        "Task",
        lazy="selectin",
        foreign_keys=[task_id]
    )

    project = relationship(
        "Project",
        lazy="selectin",
        foreign_keys=[project_id]
    )

    okr_key_result = relationship(
        "KeyResult",
        lazy="selectin",
        foreign_keys=[okr_kr_id]
    )

    kpi_indicator = relationship(
        "KPIIndicator",
        lazy="selectin",
        foreign_keys=[kpi_indicator_id]
    )

    __mapper_args__ = {
        "eager_defaults": True,
    }

    def __repr__(self) -> str:
        source = "event" if self.event_id else "task" if self.task_id else "project"
        target = "okr_kr" if self.okr_kr_id else "kpi"
        return f"<EventLink {source}→{target} weight={self.weight} type={self.link_type}>"

    @property
    def source_type(self) -> str:
        """Get the type of source entity"""
        if self.event_id:
            return "event"
        elif self.task_id:
            return "task"
        elif self.project_id:
            return "project"
        return "unknown"

    @property
    def target_type(self) -> str:
        """Get the type of target entity"""
        if self.okr_kr_id:
            return "okr_key_result"
        elif self.kpi_indicator_id:
            return "kpi_indicator"
        return "unknown"

    def get_source_progress(self) -> float:
        """
        Calculate progress from the source entity.

        Returns:
            float: Progress value between 0.0 and 1.0
        """
        if self.event_id and self.event:
            # Event is considered 100% complete if it has ended
            return 1.0 if self.event.status == "completed" else 0.0

        elif self.task_id and self.task:
            # Task progress is stored as percentage
            return self.task.progress_percentage / 100.0

        elif self.project_id and self.project:
            # Calculate project progress from its tasks
            if not self.project.tasks:
                return 0.0

            completed_tasks = sum(
                1 for task in self.project.tasks
                if task.status.value in ["done", "completed"]
            )
            return completed_tasks / len(self.project.tasks)

        return 0.0

    def calculate_weighted_contribution(self) -> float:
        """
        Calculate the weighted contribution of this link.

        Returns:
            float: Weighted progress value
        """
        if not self.is_active or not self.auto_update:
            return 0.0

        if self.link_type == LinkType.BLOCKS.value:
            # Blocking links don't contribute to progress
            return 0.0

        source_progress = self.get_source_progress()
        return source_progress * self.weight
