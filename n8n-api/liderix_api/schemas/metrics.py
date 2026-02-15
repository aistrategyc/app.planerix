from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MetricDefinitionRead(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    description: Optional[str] = None
    unit: Optional[str] = None
    formula: Optional[str] = None
    aggregation: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class MetricDefinitionListResponse(BaseModel):
    items: List[MetricDefinitionRead]
    total: int
    page: int
    page_size: int

    model_config = ConfigDict(from_attributes=True, extra="forbid")
