# Enhanced KPI models with measurements and bindings
from uuid import uuid4
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from liderix_api.db import Base
from .mixins import TimestampMixin, SoftDeleteMixin


class KPIIndicator(Base, TimestampMixin, SoftDeleteMixin):
    """
    Enhanced KPI Indicator model with thresholds, formulas, and measurement tracking.

    This model represents a Key Performance Indicator that can be:
    - Manually entered (source_type='manual')
    - Auto-calculated from formula (source_type='formula')
    - Fetched from external system (source_type='external')
    """
    __tablename__ = "kpi_indicators"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )

    # Basic fields
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    unit = Column(String(50), nullable=False, default="units")

    # Values and thresholds
    target_value = Column(Float, nullable=False)
    current_value = Column(Float, nullable=True, default=0.0)
    baseline_value = Column(Float, nullable=True)  # Starting value for comparison
    warn_threshold = Column(Float, nullable=True)   # Warning level (yellow)
    alarm_threshold = Column(Float, nullable=True)  # Critical level (red)

    # Data source configuration
    source_type = Column(
        String(50),
        nullable=False,
        default="manual"
    )  # 'manual', 'formula', 'external'

    formula = Column(Text, nullable=True)  # Formula for auto-calculation (e.g., "tasks_completed / total_tasks * 100")
    formula_metadata = Column(JSONB, nullable=True)  # Additional formula config

    # KPI type and period
    kpi_type = Column(
        String(50),
        nullable=False,
        default="gauge"
    )  # 'counter', 'gauge', 'percentage'

    period = Column(
        String(50),
        nullable=False,
        default="monthly"
    )  # 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'

    aggregation = Column(
        String(50),
        nullable=True,
        default="last"
    )  # 'sum', 'avg', 'last', 'min', 'max'

    # Status tracking
    status = Column(String(50), nullable=False, default="on_track")  # 'on_track', 'at_risk', 'critical', 'completed'
    is_active = Column(Boolean, nullable=False, default=True)
    on_track = Column(Boolean, nullable=False, default=True)  # Deprecated, use status instead

    # Relationships
    org_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    owner_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    project_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Last update tracking
    last_measured_at = Column(DateTime(timezone=True), nullable=True)
    next_review_date = Column(DateTime(timezone=True), nullable=True)

    # Metadata (using meta_data to avoid SQLAlchemy reserved name)
    meta_data = Column('metadata', JSONB, nullable=True, default={})

    # Relationships
    measurements = relationship(
        "KPIMeasurement",
        back_populates="indicator",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="desc(KPIMeasurement.measured_at)"
    )

    metric_bindings = relationship(
        "MetricBinding",
        back_populates="kpi_indicator",
        cascade="all, delete-orphan",
        lazy="select"
    )

    def __repr__(self):
        return f"<KPIIndicator {self.name}: {self.current_value}/{self.target_value} {self.unit}>"

    @property
    def progress(self) -> float:
        """Progress percentage (0-100)"""
        if self.target_value == 0:
            return 0.0
        return (self.current_value / self.target_value) * 100.0

    @property
    def completion_rate(self) -> float:
        """Completion rate (0.0-1.0)"""
        if self.target_value == 0:
            return 0.0
        return self.current_value / self.target_value

    @property
    def is_on_track(self) -> bool:
        """Check if KPI is on track based on thresholds"""
        if self.current_value is None:
            return False

        # If alarm threshold is set and breached
        if self.alarm_threshold is not None:
            if self.current_value < self.alarm_threshold:
                return False

        # If warn threshold is set and breached
        if self.warn_threshold is not None:
            if self.current_value < self.warn_threshold:
                return False

        # Check if meeting target
        return self.current_value >= self.target_value * 0.7  # 70% threshold

    @property
    def trend(self) -> str:
        """Calculate trend based on recent measurements"""
        # TODO: Implement trend calculation from measurements
        # For now, return "stable"
        return "stable"

    def update_status_based_on_progress(self) -> None:
        """
        Auto-update KPI status based on current progress and thresholds.
        Called automatically when current_value or target_value changes.
        """
        if self.current_value is None:
            self.status = "at_risk"
            self.on_track = False
            return

        progress = self.progress

        # Check if target achieved
        if progress >= 100:
            self.status = "completed"
            self.on_track = True
            return

        # Check alarm threshold
        if self.alarm_threshold is not None:
            if self.current_value < self.alarm_threshold:
                self.status = "critical"
                self.on_track = False
                return

        # Check warn threshold
        if self.warn_threshold is not None:
            if self.current_value < self.warn_threshold:
                self.status = "at_risk"
                self.on_track = False
                return

        # Check if on track (>= 70% of target)
        if progress >= 70:
            self.status = "on_track"
            self.on_track = True
        elif progress >= 50:
            self.status = "at_risk"
            self.on_track = False
        else:
            self.status = "critical"
            self.on_track = False


class KPIMeasurement(Base, TimestampMixin):
    """
    Time-series measurements for KPI indicators.
    Allows tracking KPI values over time.
    """
    __tablename__ = "kpi_measurements"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )

    indicator_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("kpi_indicators.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    value = Column(Float, nullable=False)
    measured_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Optional metadata
    notes = Column(Text, nullable=True)
    source = Column(String(100), nullable=True, default="manual")  # Who/what recorded this
    confidence_score = Column(Float, nullable=True)  # 0.0-1.0 confidence in measurement accuracy

    meta_data = Column('metadata', JSONB, nullable=True, default={})

    # Relationships
    indicator = relationship("KPIIndicator", back_populates="measurements")

    def __repr__(self):
        return f"<KPIMeasurement {self.value} @ {self.measured_at}>"


# Add index for time-series queries
Index(
    "ix_kpi_measurement_ts",
    KPIMeasurement.indicator_id,
    KPIMeasurement.measured_at.desc(),
    postgresql_using="btree"
)


class MetricBinding(Base, TimestampMixin):
    """
    Bindings between KPI indicators and other entities (tasks, projects, OKRs).
    Allows auto-updating KPIs based on linked entity progress.
    """
    __tablename__ = "metric_bindings"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )

    kpi_indicator_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("kpi_indicators.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Linked entity (one of these must be set)
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

    okr_kr_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("key_results.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # Binding configuration
    weight = Column(Float, nullable=False, default=1.0)  # Weight for aggregation
    auto_update = Column(Boolean, nullable=False, default=True)  # Auto-update KPI when entity changes

    meta_data = Column('metadata', JSONB, nullable=True, default={})

    # Relationships
    kpi_indicator = relationship("KPIIndicator", back_populates="metric_bindings")

    def __repr__(self):
        return f"<MetricBinding KPI={self.kpi_indicator_id} Task={self.task_id} Project={self.project_id}>"


# Backward compatibility: Create alias for old KPI model name
KPI = KPIIndicator