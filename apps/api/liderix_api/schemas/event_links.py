"""
Pydantic schemas for EventLink API.

Handles validation and serialization for linking events/tasks/projects to OKRs/KPIs.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any, Literal
from uuid import UUID
from datetime import datetime


# ==================== ENUMS ====================

LinkTypeEnum = Literal["contributes", "blocks", "relates", "required"]


# ==================== BASE SCHEMAS ====================

class EventLinkBase(BaseModel):
    """Base schema for EventLink with common fields"""

    # Source (exactly one must be set)
    event_id: Optional[UUID] = None
    task_id: Optional[UUID] = None
    project_id: Optional[UUID] = None

    # Target (exactly one must be set)
    okr_kr_id: Optional[UUID] = None
    kpi_indicator_id: Optional[UUID] = None

    # Link configuration
    link_type: LinkTypeEnum = "contributes"
    weight: float = Field(default=1.0, ge=0.0, le=1.0, description="Weight for progress calculation (0.0-1.0)")
    auto_update: bool = Field(default=True, description="Automatically update target when source changes")
    is_active: bool = Field(default=True, description="Whether this link is currently active")

    # Optional metadata
    notes: Optional[str] = Field(None, max_length=500, description="Optional notes about this link")
    meta_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True
    )

    @field_validator('weight')
    @classmethod
    def validate_weight(cls, v: float) -> float:
        """Ensure weight is between 0.0 and 1.0"""
        if not 0.0 <= v <= 1.0:
            raise ValueError('Weight must be between 0.0 and 1.0')
        return v


class EventLinkCreate(EventLinkBase):
    """Schema for creating a new EventLink"""

    @field_validator('event_id', 'task_id', 'project_id')
    @classmethod
    def validate_one_source(cls, v, info):
        """Ensure exactly one source is set"""
        values = info.data
        sources = [
            values.get('event_id'),
            values.get('task_id'),
            values.get('project_id')
        ]
        # Remove None values and count non-None
        non_none_sources = [s for s in sources if s is not None]

        # Add current value if it's not None
        if v is not None and v not in non_none_sources:
            non_none_sources.append(v)

        if len(non_none_sources) != 1:
            raise ValueError('Exactly one source (event_id, task_id, or project_id) must be set')
        return v

    @field_validator('okr_kr_id', 'kpi_indicator_id')
    @classmethod
    def validate_one_target(cls, v, info):
        """Ensure exactly one target is set"""
        values = info.data
        targets = [
            values.get('okr_kr_id'),
            values.get('kpi_indicator_id')
        ]
        # Remove None values and count non-None
        non_none_targets = [t for t in targets if t is not None]

        # Add current value if it's not None
        if v is not None and v not in non_none_targets:
            non_none_targets.append(v)

        if len(non_none_targets) != 1:
            raise ValueError('Exactly one target (okr_kr_id or kpi_indicator_id) must be set')
        return v


class EventLinkUpdate(BaseModel):
    """Schema for updating an existing EventLink"""

    link_type: Optional[LinkTypeEnum] = None
    weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    auto_update: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=500)
    meta_data: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True
    )

    @field_validator('weight')
    @classmethod
    def validate_weight(cls, v: Optional[float]) -> Optional[float]:
        """Ensure weight is between 0.0 and 1.0"""
        if v is not None and not 0.0 <= v <= 1.0:
            raise ValueError('Weight must be between 0.0 and 1.0')
        return v


class EventLinkRead(EventLinkBase):
    """Schema for reading an EventLink"""

    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    # Computed fields
    source_type: str = Field(description="Type of source entity (event/task/project)")
    target_type: str = Field(description="Type of target entity (okr_key_result/kpi_indicator)")

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid"
    )


# ==================== LIST & FILTER SCHEMAS ====================

class EventLinkListResponse(BaseModel):
    """Paginated list of EventLinks"""

    items: List[EventLinkRead]
    total: int
    page: int
    page_size: int
    filters_applied: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class EventLinkFilters(BaseModel):
    """Filters for querying EventLinks"""

    # Source filters
    event_id: Optional[UUID] = None
    task_id: Optional[UUID] = None
    project_id: Optional[UUID] = None

    # Target filters
    okr_kr_id: Optional[UUID] = None
    kpi_indicator_id: Optional[UUID] = None

    # Configuration filters
    link_type: Optional[LinkTypeEnum] = None
    is_active: Optional[bool] = None
    auto_update: Optional[bool] = None

    # Pagination
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)

    model_config = ConfigDict(extra="forbid")


# ==================== BULK OPERATIONS ====================

class EventLinkBulkCreateRequest(BaseModel):
    """Create multiple EventLinks at once"""

    links: List[EventLinkCreate] = Field(min_length=1, max_length=100)

    model_config = ConfigDict(extra="forbid")


class EventLinkBulkCreateResponse(BaseModel):
    """Response for bulk create operation"""

    created: List[EventLinkRead]
    failed: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of failed items with error messages"
    )
    total_created: int
    total_failed: int

    model_config = ConfigDict(from_attributes=True, extra="forbid")


# ==================== ANALYTICS SCHEMAS ====================

class EventLinkAnalytics(BaseModel):
    """Analytics for EventLinks"""

    total_links: int
    links_by_type: Dict[str, int]
    links_by_source: Dict[str, int]
    links_by_target: Dict[str, int]
    active_links: int
    inactive_links: int
    average_weight: float

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class SourceProgressSummary(BaseModel):
    """Summary of progress from linked sources"""

    source_id: UUID
    source_type: str
    link_type: str
    weight: float
    source_progress: float
    weighted_contribution: float

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class TargetProgressReport(BaseModel):
    """Detailed progress report for a target (OKR KR or KPI)"""

    target_id: UUID
    target_type: str
    total_links: int
    active_links: int
    total_weighted_progress: float
    sources: List[SourceProgressSummary]

    model_config = ConfigDict(from_attributes=True, extra="forbid")
