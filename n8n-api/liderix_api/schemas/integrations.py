from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class OAuthCredentialCreate(BaseModel):
    provider: Literal["facebook_ads", "google_ads", "ga4", "tiktok_ads", "custom"]
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    external_account_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    name: Optional[str] = None


class OAuthCredentialResponse(BaseModel):
    data_source_id: UUID
    oauth_credential_id: UUID


class N8NCredentialCreate(BaseModel):
    name: str
    credential_type: str = Field(..., description="n8n credential type name")
    credential_data: Dict[str, Any] = Field(default_factory=dict)
    data_source_id: Optional[UUID] = None


class N8NCredentialResponse(BaseModel):
    credential_id: str
    data_source_id: Optional[UUID] = None


class N8NWorkflowProvisionRequest(BaseModel):
    provider: Literal["facebook_ads", "google_ads", "ga4", "tiktok_ads", "custom"]
    template_workflow_id: str = Field(..., description="n8n workflow id to clone")
    name: Optional[str] = Field(None, description="Optional workflow name override")


class N8NWorkflowProvisionResponse(BaseModel):
    workflow_id: str
    workflow_url: str
    data_source_id: UUID


class DataSourceResponse(BaseModel):
    id: UUID
    type: str
    name: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
