from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from liderix_api.enums import MembershipRole


class TeamMemberRead(BaseModel):
    id: UUID
    name: str
    email: str
    role: MembershipRole
    department: Optional[str] = None
    position: Optional[str] = None
    avatar_url: Optional[str] = None
    join_date: Optional[datetime] = None
    status: Optional[str] = None
    tasks_completed: int = 0
    projects_active: int = 0
    tasks_open: int = 0
    tasks_overdue: int = 0
    tasks_in_review: int = 0
    tasks_blocked: int = 0

    model_config = ConfigDict(extra="forbid")


class TeamRead(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    department: Optional[str] = None
    lead: Optional[str] = None
    policy: Optional["TeamPolicy"] = None
    members: List[TeamMemberRead] = []
    projects: int = 0
    tasks_open: int = 0
    tasks_overdue: int = 0
    tasks_in_review: int = 0
    tasks_blocked: int = 0
    created_at: Optional[datetime] = None

    model_config = ConfigDict(extra="forbid")


class TeamListResponse(BaseModel):
    items: List[TeamRead]
    total: int

    model_config = ConfigDict(extra="forbid")


class TeamPolicy(BaseModel):
    default_approver_role: Optional[str] = None
    escalation_days: Optional[int] = None
    weekly_digest_recipients: Optional[List[str]] = None

    model_config = ConfigDict(extra="forbid")
