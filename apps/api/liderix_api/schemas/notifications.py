from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from liderix_api.enums import NotificationType, NotificationStatus


class NotificationRead(BaseModel):
    id: UUID
    org_id: Optional[UUID] = None
    user_id: UUID
    type: NotificationType
    status: NotificationStatus
    title: str
    message: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[UUID] = None
    action_url: Optional[str] = None
    action_text: Optional[str] = None
    priority: Optional[str] = None
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class NotificationListResponse(BaseModel):
    items: List[NotificationRead]
    page: int
    page_size: int
    total: int
    unread_count: int = 0

    model_config = ConfigDict(extra="forbid")


class NotificationCreate(BaseModel):
    org_id: Optional[UUID] = None
    user_id: UUID
    type: NotificationType
    title: str = Field(..., max_length=500)
    message: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[UUID] = None
    action_url: Optional[str] = Field(default=None, max_length=1000)
    action_text: Optional[str] = Field(default=None, max_length=100)
    priority: Optional[str] = Field(default="normal", max_length=20)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
