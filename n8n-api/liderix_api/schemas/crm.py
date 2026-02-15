from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from liderix_api.enums import (
    CRMContactStatus,
    CRMContactPriority,
    CRMContactSource,
    CRMDealStage,
)


class CRMContactBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=50)
    company: Optional[str] = Field(default=None, max_length=200)
    position: Optional[str] = Field(default=None, max_length=200)
    status: CRMContactStatus = CRMContactStatus.LEAD
    priority: CRMContactPriority = CRMContactPriority.MEDIUM
    source: CRMContactSource = CRMContactSource.WEBSITE
    value: Optional[float] = None
    last_contact: Optional[datetime] = None
    next_follow_up: Optional[datetime] = None
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    org_id: Optional[UUID] = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        return v.strip()

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CRMContactCreate(CRMContactBase):
    pass


class CRMContactUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    company: Optional[str] = Field(default=None, max_length=200)
    position: Optional[str] = Field(default=None, max_length=200)
    status: Optional[CRMContactStatus] = None
    priority: Optional[CRMContactPriority] = None
    source: Optional[CRMContactSource] = None
    value: Optional[float] = None
    last_contact: Optional[datetime] = None
    next_follow_up: Optional[datetime] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CRMContactRead(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    status: CRMContactStatus
    priority: CRMContactPriority
    source: CRMContactSource
    value: Optional[float] = None
    last_contact: Optional[datetime] = None
    next_follow_up: Optional[datetime] = None
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")


T = TypeVar("T")


class CRMContactListResponse(BaseModel, Generic[T]):
    items: List[CRMContactRead]
    page: int
    page_size: int
    total: int

    model_config = ConfigDict(extra="forbid")


class CRMDealBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    contact_id: Optional[UUID] = None
    company: Optional[str] = Field(default=None, max_length=200)
    amount: float = Field(default=0.0, ge=0)
    stage: CRMDealStage = CRMDealStage.PROSPECTING
    probability: int = Field(default=0, ge=0, le=100)
    expected_close_date: Optional[datetime] = None
    org_id: Optional[UUID] = None

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: str) -> str:
        return v.strip()

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CRMDealCreate(CRMDealBase):
    pass


class CRMDealUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    contact_id: Optional[UUID] = None
    company: Optional[str] = Field(default=None, max_length=200)
    amount: Optional[float] = Field(default=None, ge=0)
    stage: Optional[CRMDealStage] = None
    probability: Optional[int] = Field(default=None, ge=0, le=100)
    expected_close_date: Optional[datetime] = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CRMDealRead(BaseModel):
    id: UUID
    org_id: UUID
    title: str
    contact_id: Optional[UUID] = None
    contact_name: Optional[str] = None
    company: Optional[str] = None
    amount: float
    stage: CRMDealStage
    probability: int
    expected_close_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class CRMDealListResponse(BaseModel, Generic[T]):
    items: List[CRMDealRead]
    page: int
    page_size: int
    total: int

    model_config = ConfigDict(extra="forbid")
