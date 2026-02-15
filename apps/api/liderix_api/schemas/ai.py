from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field
from liderix_api.enums import TaskPriority


class AIRecommendationPayload(BaseModel):
    action_type: str
    payload: Optional[Dict[str, object]] = None
    priority: Optional[int] = None
    expected_impact: Optional[Dict[str, object]] = None
    status: Optional[str] = None


class AIInsightPayload(BaseModel):
    widget_key: str
    title: str
    summary: str
    severity: Optional[str] = None
    metrics_json: Optional[Dict[str, object]] = None
    evidence_ref: Optional[Dict[str, object]] = None
    confidence: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    tags: Optional[List[str]] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    organization_id: Optional[UUID] = None
    tenant_key: Optional[str] = None
    kpi_indicator_id: Optional[UUID] = None
    objective_id: Optional[UUID] = None
    key_result_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    recommendations: Optional[List[AIRecommendationPayload]] = None


class AIIngestRequest(BaseModel):
    insights: List[AIInsightPayload]


class AIIngestResponse(BaseModel):
    inserted: int
    insight_ids: List[int]


class AIChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str


class AIChatRequest(BaseModel):
    message: str
    history: List[AIChatMessage] = Field(default_factory=list)


class AIChatResponse(BaseModel):
    answer: str
    sources: Optional[List[Dict[str, object]]] = None
    widget_data: Optional[Dict[str, object]] = None


class AIAutoActionRequest(BaseModel):
    insight_ids: List[int]
    create_tasks: bool = True
    create_notifications: bool = True
    require_approval: bool = True
    task_priority: Optional[TaskPriority] = None
    dry_run: bool = False


class AIAutoActionItem(BaseModel):
    insight_id: int
    responsible_user_id: Optional[UUID] = None
    task_id: Optional[UUID] = None
    notification_id: Optional[UUID] = None
    action_request_id: Optional[int] = None
    status: str = "queued"


class AIAutoActionResponse(BaseModel):
    items: List[AIAutoActionItem]


class AIActionRequestItem(BaseModel):
    id: int
    organization_id: UUID
    insight_id: Optional[int] = None
    recommendation_id: Optional[int] = None
    responsible_user_id: Optional[UUID] = None
    status: str
    action_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    widget_key: Optional[str] = None
    severity: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    project_id: Optional[UUID] = None
    kpi_indicator_id: Optional[UUID] = None
    objective_id: Optional[UUID] = None
    key_result_id: Optional[UUID] = None
    expected_impact: Optional[Dict[str, object]] = None
    payload: Optional[Dict[str, object]] = None
    task_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None


class AIActionRequestList(BaseModel):
    items: List[AIActionRequestItem]


class AIActionRequestDecision(BaseModel):
    status: str
    task_id: Optional[UUID] = None
