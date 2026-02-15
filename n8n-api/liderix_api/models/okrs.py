from __future__ import annotations
import uuid
#
# NOTE: OrgFKMixin already provides the org_id column for Objective.
#
from enum import Enum as PyEnum
from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Enum,
    Float,
    ForeignKey)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from liderix_api.db import Base
from .mixins import TimestampMixin, SoftDeleteMixin, OrgFKMixin
class ObjectiveStatus(PyEnum):
    """
    Статусы для целей.
    """
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ObjectiveVisibility(PyEnum):
    """
    Видимость цели.
    """
    PRIVATE = "private"
    INTERNAL = "internal"
    PUBLIC = "public"


class KeyResultDirection(PyEnum):
    """
    Направление метрики для KR.
    """
    INCREASE = "increase"
    DECREASE = "decrease"


class KeyResultProgressRule(PyEnum):
    """
    Правило расчета прогресса KR.
    """
    LINEAR = "linear"
    RATIO = "ratio"
    CAPPED = "capped"
class Objective(Base, TimestampMixin, SoftDeleteMixin, OrgFKMixin):
    """
    Модель для целей (Objectives) по методологии OKR.
    """
    __tablename__ = "objectives"
    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)
    title = Column(
        String(255),
        nullable=False)
    description = Column(
        Text,
        nullable=True)
    status = Column(
        Enum(
            ObjectiveStatus,
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=ObjectiveStatus.DRAFT,
        nullable=False)
    start_date = Column(
        DateTime(timezone=True),
        nullable=True)
    due_date = Column(
        DateTime(timezone=True),
        nullable=True)
    visibility = Column(
        Enum(
            ObjectiveVisibility,
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=ObjectiveVisibility.INTERNAL,
        nullable=False)
    tags = Column(
        JSONB,
        nullable=True,
        default=lambda: [])
    scope_type = Column(
        String(50),
        nullable=True)
    scope_ref = Column(
        String(120),
        nullable=True)

    owner_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    organization = relationship(
        "Organization",
        lazy="selectin",
        back_populates="objectives",
        overlaps="objectives"
    )

    owner = relationship(
        "User",
        lazy="selectin",
        foreign_keys=[owner_id],
        overlaps="objectives",
    )

    # Связь к ключевым результатам
    key_results = relationship(
        "KeyResult",
        cascade="all, delete-orphan",
        lazy="selectin",
        back_populates="objective",
        overlaps="objective,key_results"
    )

    __mapper_args__ = {
        "eager_defaults": True,
    }
class KeyResult(Base, TimestampMixin, SoftDeleteMixin):
    """
    Модель для хранения ключевых результатов (Key Results) цели.
    """
    __tablename__ = "key_results"
    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)
    objective_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("objectives.id", ondelete="CASCADE"),
        nullable=False,
        index=True)
    description = Column(
        String(255),
        nullable=False)
    start_value = Column(
        Float,
        default=0.0,
        nullable=False)
    target_value = Column(
        Float,
        nullable=False)
    current_value = Column(
        Float,
        default=0.0,
        nullable=False)
    unit = Column(
        String(50),
        nullable=True)
    metric_key = Column(
        String(120),
        nullable=True,
        index=True)
    metric_def_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("metric_definitions.id", ondelete="SET NULL"),
        nullable=True,
        index=True)
    filters_json = Column(
        JSONB,
        nullable=True,
        default=lambda: {})
    direction = Column(
        Enum(
            KeyResultDirection,
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=KeyResultDirection.INCREASE,
        nullable=False)
    progress_rule = Column(
        Enum(
            KeyResultProgressRule,
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=KeyResultProgressRule.LINEAR,
        nullable=False)
    data_quality_requirements = Column(
        JSONB,
        nullable=True,
        default=lambda: {})

    owner_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True)
    # Ссылка обратно на цель
    objective = relationship(
        "Objective",
        lazy="selectin",
        back_populates="key_results",
        overlaps="objective,key_results"
    )

    owner = relationship(
        "User",
        lazy="selectin",
        foreign_keys=[owner_id],
        overlaps="key_results",
    )
    metric_definition = relationship(
        "MetricDefinition",
        lazy="selectin",
        foreign_keys=[metric_def_id],
    )

    __mapper_args__ = {
        "eager_defaults": True,
    }
# Добавлено для совместимости с роутом (OKR как объединённая модель)
class OKR(Objective):
    """
    Объединённая модель OKR для совместимости с роутом (наследует от Objective).
    """
    __tablename__ = None  # Не создаёт новую таблицу, использует objectives


class KeyResultSnapshot(Base, TimestampMixin, OrgFKMixin):
    """Snapshot of Key Result progress for trend/forecast calculations."""
    __tablename__ = "okr_progress_snapshots"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    objective_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("objectives.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    key_result_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("key_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    metric_def_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("metric_definitions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    metric_key = Column(
        String(120),
        nullable=True,
        index=True,
    )

    start_value = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    current_value = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    target_value = Column(
        Float,
        nullable=False,
    )

    progress_percentage = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    direction = Column(
        Enum(
            KeyResultDirection,
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=KeyResultDirection.INCREASE,
        nullable=False,
    )

    progress_rule = Column(
        Enum(
            KeyResultProgressRule,
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=KeyResultProgressRule.LINEAR,
        nullable=False,
    )

    snapshot_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    filters_json = Column(
        JSONB,
        nullable=True,
        default=lambda: {},
    )

    data_quality_requirements = Column(
        JSONB,
        nullable=True,
        default=lambda: {},
    )

    source = Column(
        String(50),
        nullable=False,
        default="auto",
    )

    objective = relationship(
        "Objective",
        lazy="selectin",
        overlaps="objective,key_results",
    )

    key_result = relationship(
        "KeyResult",
        lazy="selectin",
    )

    metric_definition = relationship(
        "MetricDefinition",
        lazy="selectin",
        foreign_keys=[metric_def_id],
    )

    __mapper_args__ = {
        "eager_defaults": True,
    }
