from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditActor(BaseModel):
    id: UUID
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class AuditLogRead(BaseModel):
    id: UUID
    org_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    event_type: str
    success: bool
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime
    actor: Optional[AuditActor] = None

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class AuditLogListResponse(BaseModel):
    items: List[AuditLogRead]
    page: int
    page_size: int
    total: int

    model_config = ConfigDict(extra="forbid")
