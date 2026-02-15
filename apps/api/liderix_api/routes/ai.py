from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text, select, bindparam
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.config.settings import settings
from liderix_api.db import get_async_session, get_itstep_session
from liderix_api.enums import (
    MembershipRole,
    NotificationType,
    TaskPriority,
    TaskStatus,
    TaskType,
)
from liderix_api.models.kpi import KPIIndicator
from liderix_api.models.memberships import Membership, MembershipStatus
from liderix_api.models.notifications import Notification
from liderix_api.models.okrs import Objective, KeyResult
from liderix_api.models.organization import Organization
from liderix_api.models.projects import Project
from liderix_api.models.tasks import Task
from liderix_api.models.users import User
from liderix_api.schemas.ai import (
    AIActionRequestDecision,
    AIActionRequestItem,
    AIActionRequestList,
    AIAutoActionItem,
    AIAutoActionRequest,
    AIAutoActionResponse,
    AIChatRequest,
    AIChatResponse,
    AIIngestRequest,
    AIIngestResponse,
)
from liderix_api.services.auth import get_current_user
from liderix_api.services.ai_clients import get_openai_client, get_qdrant_client
from liderix_api.routes.analytics.widgets import _get_columns, _split_view, _load_widget_config, _resolve_entity_column

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])


async def _get_active_org_id(session: AsyncSession, user: User) -> UUID:
    org_id = await session.scalar(
        select(Membership.org_id).where(
            Membership.user_id == user.id,
            Membership.deleted_at.is_(None),
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    if not org_id:
        raise HTTPException(status_code=400, detail="User has no active organization")
    return org_id


async def _get_table_columns(session: AsyncSession, schema: str, table: str) -> set[str]:
    result = await session.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table
            """
        ),
        {"schema": schema, "table": table},
    )
    return {row[0] for row in result.fetchall()}


def _require_ingest_token(request: Request) -> None:
    token = request.headers.get("x-planerix-token")
    if not settings.AI_INGEST_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI ingest token is not configured",
        )
    if not token or token != settings.AI_INGEST_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingest token")


def _severity_to_priority(severity: Optional[str]) -> TaskPriority:
    if not severity:
        return TaskPriority.MEDIUM
    normalized = severity.lower()
    if normalized in {"critical", "p0"}:
        return TaskPriority.CRITICAL
    if normalized in {"high", "p1"}:
        return TaskPriority.HIGH
    if normalized in {"low", "p3"}:
        return TaskPriority.LOW
    return TaskPriority.MEDIUM


def _safe_task_priority(value: Optional[str], fallback: TaskPriority) -> TaskPriority:
    if not value:
        return fallback
    try:
        return TaskPriority(value)
    except ValueError:
        return fallback


async def _resolve_responsible_user_id(
    session: AsyncSession,
    org_id: UUID,
    insight: Dict[str, Any],
) -> Optional[UUID]:
    kpi_id = insight.get("kpi_indicator_id")
    if kpi_id:
        owner = await session.scalar(select(KPIIndicator.owner_id).where(KPIIndicator.id == kpi_id))
        if owner:
            return owner

    objective_id = insight.get("objective_id")
    if objective_id:
        owner = await session.scalar(select(Objective.owner_id).where(Objective.id == objective_id))
        if owner:
            return owner

    key_result_id = insight.get("key_result_id")
    if key_result_id:
        owner = await session.scalar(select(KeyResult.owner_id).where(KeyResult.id == key_result_id))
        if owner:
            return owner

    project_id = insight.get("project_id")
    if project_id:
        owner = await session.scalar(select(Project.owner_id).where(Project.id == project_id))
        if owner:
            return owner

    org_owner = await session.scalar(select(Organization.owner_id).where(Organization.id == org_id))
    if org_owner:
        return org_owner

    owner_member = await session.scalar(
        select(Membership.user_id).where(
            Membership.org_id == org_id,
            Membership.role == MembershipRole.OWNER,
            Membership.status == MembershipStatus.ACTIVE,
            Membership.deleted_at.is_(None),
        )
    )
    if owner_member:
        return owner_member

    admin_member = await session.scalar(
        select(Membership.user_id).where(
            Membership.org_id == org_id,
            Membership.role == MembershipRole.ADMIN,
            Membership.status == MembershipStatus.ACTIVE,
            Membership.deleted_at.is_(None),
        )
    )
    if admin_member:
        return admin_member

    return await session.scalar(
        select(Membership.user_id).where(
            Membership.org_id == org_id,
            Membership.status == MembershipStatus.ACTIVE,
            Membership.deleted_at.is_(None),
        )
    )


async def _insert_action_request(
    session: AsyncSession,
    columns: set[str],
    values: Dict[str, Any],
) -> Optional[int]:
    if not columns:
        return None
    action_values = {k: v for k, v in values.items() if k in columns}
    if not action_values:
        return None
    cols = ", ".join(action_values.keys())
    params = ", ".join([f":{k}" for k in action_values.keys()])
    result = await session.execute(
        text(
            f"""
            INSERT INTO ai.action_requests ({cols})
            VALUES ({params})
            RETURNING id
            """
        ),
        action_values,
    )
    return result.scalar_one()


async def _fetch_widget_data(
    widget_key: str,
    data_session: AsyncSession,
    core_session: AsyncSession,
    org_id: str,
    filters: Dict[str, Any],
) -> Dict[str, Any]:
    config = await _load_widget_config(core_session, widget_key)

    schema, table = _split_view(config.view)
    columns = await _get_columns(data_session, schema, table)

    clauses = []
    params: Dict[str, Any] = {}
    default_filters = config.default_filters or {}

    start_date = filters.get("start_date") or default_filters.get("start_date")
    end_date = filters.get("end_date") or default_filters.get("end_date")
    product = filters.get("product") or default_filters.get("product")
    branch = filters.get("branch") or default_filters.get("branch")
    source = filters.get("source") or default_filters.get("source")
    platform = filters.get("platform") or default_filters.get("platform")
    entity_id = filters.get("entity_id")

    if org_id and "organization_id" in columns:
        clauses.append("organization_id = :organization_id")
        params["organization_id"] = org_id
    elif org_id and "org_id" in columns:
        clauses.append("org_id = :organization_id")
        params["organization_id"] = org_id

    if start_date and config.date_column in columns:
        clauses.append(f"{config.date_column} >= :start_date")
        params["start_date"] = start_date
    if end_date and config.date_column in columns:
        clauses.append(f"{config.date_column} <= :end_date")
        params["end_date"] = end_date
    if product and "product" in columns:
        clauses.append("product = :product")
        params["product"] = product
    if branch and "branch" in columns:
        clauses.append("branch = :branch")
        params["branch"] = branch
    if source and "source" in columns:
        clauses.append("source = :source")
        params["source"] = source
    if platform and "platform" in columns:
        clauses.append("platform = :platform")
        params["platform"] = platform
    entity_column = _resolve_entity_column(config)
    if entity_id and entity_column and entity_column in columns:
        clauses.append(f"{entity_column} = :entity_id")
        params["entity_id"] = entity_id

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    limit = int(filters.get("limit") or config.default_limit)
    offset = int(filters.get("offset") or 0)
    params.update({"limit": limit, "offset": offset})

    query = text(
        f"""
        SELECT *
        FROM {config.view}
        {where_sql}
        LIMIT :limit
        OFFSET :offset
        """
    )
    result = await data_session.execute(query, params)
    rows = result.mappings().all()
    return {"widget_key": widget_key, "items": [dict(row) for row in rows]}


@router.post("/insights/ingest", response_model=AIIngestResponse)
async def ingest_ai_insights(
    payload: AIIngestRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    _require_ingest_token(request)
    columns = await _get_table_columns(session, "ai", "insights")
    rec_columns = await _get_table_columns(session, "ai", "recommendations")

    inserted_ids: list[int] = []
    inserted_items: list[tuple[int, Any]] = []
    for insight in payload.insights:
        values: Dict[str, Any] = {
            "widget_key": insight.widget_key,
            "title": insight.title,
            "summary": insight.summary,
            "severity": insight.severity,
            "metrics_json": insight.metrics_json,
            "evidence_ref": insight.evidence_ref,
            "confidence": insight.confidence,
            "valid_from": insight.valid_from,
            "valid_to": insight.valid_to,
            "tags": insight.tags,
            "entity_type": insight.entity_type,
            "entity_id": insight.entity_id,
            "organization_id": insight.organization_id,
            "kpi_indicator_id": insight.kpi_indicator_id,
            "objective_id": insight.objective_id,
            "key_result_id": insight.key_result_id,
            "project_id": insight.project_id,
        }
        if "tenant_key" in columns:
            values["tenant_key"] = insight.tenant_key or (
                str(insight.organization_id) if insight.organization_id else None
            )
        values = {k: v for k, v in values.items() if k in columns}

        if not values:
            continue

        col_names = ", ".join(values.keys())
        col_params = ", ".join([f":{k}" for k in values.keys()])
        insert_sql = text(
            f"""
            INSERT INTO ai.insights ({col_names})
            VALUES ({col_params})
            RETURNING id
            """
        )
        result = await session.execute(insert_sql, values)
        insight_id = result.scalar_one()
        inserted_ids.append(insight_id)
        inserted_items.append((insight_id, insight))

        if insight.recommendations and rec_columns:
            for rec in insight.recommendations:
                rec_values = {
                    "insight_id": insight_id,
                    "action_type": rec.action_type,
                    "payload": rec.payload,
                    "priority": rec.priority,
                    "expected_impact": rec.expected_impact,
                    "status": rec.status,
                }
                rec_values = {k: v for k, v in rec_values.items() if k in rec_columns}
                if not rec_values:
                    continue
                rec_cols = ", ".join(rec_values.keys())
                rec_params = ", ".join([f":{k}" for k in rec_values.keys()])
                await session.execute(
                    text(
                        f"""
                        INSERT INTO ai.recommendations ({rec_cols})
                        VALUES ({rec_params})
                        """
                    ),
                    rec_values,
                )

    await session.commit()

    # Optional: push embeddings to Qdrant
    openai_client = get_openai_client()
    qdrant_client = get_qdrant_client()
    if openai_client and qdrant_client and inserted_items:
        try:
            texts = [item[1].summary for item in inserted_items]
            embeddings = await openai_client.embeddings(
                model=settings.OPENAI_EMBEDDINGS_MODEL,
                inputs=texts,
            )
            if embeddings:
                await qdrant_client.ensure_collection(
                    settings.QDRANT_COLLECTION, vector_size=len(embeddings[0])
                )
                points = []
                for idx, (insight_id, insight) in enumerate(inserted_items):
                    if idx >= len(embeddings):
                        break
                    points.append(
                        {
                            "id": insight_id,
                            "vector": embeddings[idx],
                            "payload": {
                                "organization_id": str(insight.organization_id) if insight.organization_id else None,
                                "widget_key": insight.widget_key,
                                "title": insight.title,
                                "summary": insight.summary,
                                "severity": insight.severity,
                            },
                        }
                    )
                await qdrant_client.upsert_points(
                    collection=settings.QDRANT_COLLECTION, points=points
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Qdrant embedding ingest failed: %s", exc)

    return AIIngestResponse(inserted=len(inserted_ids), insight_ids=inserted_ids)


@router.post("/insights/dispatch", response_model=AIAutoActionResponse)
async def dispatch_ai_insights(
    payload: AIAutoActionRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    if not payload.insight_ids:
        return AIAutoActionResponse(items=[])

    org_id = await _get_active_org_id(session, current_user)
    insight_columns = await _get_table_columns(session, "ai", "insights")
    rec_columns = await _get_table_columns(session, "ai", "recommendations")
    action_columns = await _get_table_columns(session, "ai", "actions")
    action_request_columns = await _get_table_columns(session, "ai", "action_requests")

    if "organization_id" not in insight_columns:
        raise HTTPException(status_code=500, detail="AI insights schema missing organization_id")

    select_cols = [
        "id",
        "widget_key",
        "title",
        "summary",
        "severity",
        "entity_type",
        "entity_id",
        "organization_id",
        "project_id",
        "kpi_indicator_id",
        "objective_id",
        "key_result_id",
    ]
    if "tenant_key" in insight_columns:
        select_cols.append("tenant_key")

    query = text(
        f"""
        SELECT {", ".join(select_cols)}
        FROM ai.insights
        WHERE id IN :insight_ids
          AND (organization_id = :org_id { "OR tenant_key = :tenant_key" if "tenant_key" in insight_columns else "" })
        """
    ).bindparams(bindparam("insight_ids", expanding=True))

    params: Dict[str, Any] = {"insight_ids": payload.insight_ids, "org_id": org_id}
    if "tenant_key" in insight_columns:
        params["tenant_key"] = str(org_id)

    result = await session.execute(query, params)
    insights = result.mappings().all()

    items: list[AIAutoActionItem] = []
    if payload.dry_run:
        for row in insights:
            responsible_id = await _resolve_responsible_user_id(session, org_id, dict(row))
            items.append(
                AIAutoActionItem(
                    insight_id=row["id"],
                    responsible_user_id=responsible_id,
                    status="dry_run",
                )
            )
        return AIAutoActionResponse(items=items)

    for row in insights:
        insight = dict(row)
        responsible_id = await _resolve_responsible_user_id(session, org_id, insight)
        task_id: Optional[UUID] = None
        notification_id: Optional[UUID] = None

        recs = []
        if rec_columns:
            rec_result = await session.execute(
                text(
                    """
                    SELECT id, action_type, payload, priority, expected_impact, status
                    FROM ai.recommendations
                    WHERE insight_id = :insight_id
                    ORDER BY id ASC
                    """
                ),
                {"insight_id": insight["id"]},
            )
            recs = rec_result.mappings().all()

        should_create_task = payload.create_tasks and (
            (insight.get("severity") or "").lower() in {"critical", "high"}
            or bool(recs)
        )

        expected_impact = recs[0]["expected_impact"] if recs else None
        priority = payload.task_priority or _severity_to_priority(insight.get("severity"))
        description_lines = [insight.get("summary") or ""]
        if recs:
            description_lines.append("")
            description_lines.append("Recommendations:")
            for rec in recs[:3]:
                action_type = rec.get("action_type") or "action"
                description_lines.append(f"- {action_type}")
        description = "\n".join([line for line in description_lines if line is not None])

        action_request_id: Optional[int] = None
        if payload.require_approval and action_request_columns and should_create_task:
            action_request_id = await _insert_action_request(
                session,
                action_request_columns,
                {
                    "organization_id": org_id,
                    "insight_id": insight.get("id"),
                    "recommendation_id": recs[0]["id"] if recs and "id" in recs[0] else None,
                    "responsible_user_id": responsible_id,
                    "status": "pending",
                    "action_type": recs[0]["action_type"] if recs else None,
                    "title": insight.get("title"),
                    "description": description.strip() if description else None,
                    "priority": priority.value,
                    "widget_key": insight.get("widget_key"),
                    "severity": insight.get("severity"),
                    "entity_type": insight.get("entity_type"),
                    "entity_id": insight.get("entity_id"),
                    "project_id": insight.get("project_id"),
                    "kpi_indicator_id": insight.get("kpi_indicator_id"),
                    "objective_id": insight.get("objective_id"),
                    "key_result_id": insight.get("key_result_id"),
                    "payload": recs[0]["payload"] if recs else None,
                    "expected_impact": expected_impact,
                    "created_by": current_user.id,
                },
            )

        if should_create_task and not action_request_id:
            task = Task(
                id=uuid4(),
                title=f"[AI] {insight.get('title') or 'Insight'}",
                description=description.strip() if description else None,
                org_id=org_id,
                creator_id=current_user.id,
                assignee_id=responsible_id,
                project_id=insight.get("project_id"),
                status=TaskStatus.TODO,
                priority=priority,
                task_type=TaskType.IMPROVEMENT,
                source_ref="ai",
                entity_type=insight.get("entity_type")
                or ("kpi" if insight.get("kpi_indicator_id") else None),
                entity_id=insight.get("entity_id")
                or (str(insight["kpi_indicator_id"]) if insight.get("kpi_indicator_id") else None),
                expected_impact=expected_impact,
                meta_data={
                    "ai_insight_id": insight.get("id"),
                    "widget_key": insight.get("widget_key"),
                    "severity": insight.get("severity"),
                },
            )
            session.add(task)
            await session.flush()
            task_id = task.id

        if payload.create_notifications and responsible_id:
            related_entity_type = None
            related_entity_id = None
            if insight.get("kpi_indicator_id"):
                related_entity_type = "kpi"
                related_entity_id = insight.get("kpi_indicator_id")
            elif insight.get("objective_id"):
                related_entity_type = "objective"
                related_entity_id = insight.get("objective_id")
            elif insight.get("key_result_id"):
                related_entity_type = "key_result"
                related_entity_id = insight.get("key_result_id")
            elif insight.get("project_id"):
                related_entity_type = "project"
                related_entity_id = insight.get("project_id")

            notification = Notification(
                id=uuid4(),
                org_id=org_id,
                user_id=responsible_id,
                type=NotificationType.KPI_ALERT if insight.get("kpi_indicator_id") else NotificationType.SYSTEM,
                title=f"AI: {insight.get('title') or 'Insight'}",
                message=insight.get("summary") or "New AI insight available.",
                related_entity_type=related_entity_type,
                related_entity_id=related_entity_id,
                action_url=f"/notifications?ai_action_request_id={action_request_id}" if action_request_id else None,
                meta_data={
                    "ai_insight_id": insight.get("id"),
                    "widget_key": insight.get("widget_key"),
                    "severity": insight.get("severity"),
                    "ai_action_request_id": action_request_id,
                },
            )
            session.add(notification)
            await session.flush()
            notification_id = notification.id

        if action_columns and task_id:
            action_values = {
                "rec_id": recs[0]["id"] if recs and "id" in recs[0] else None,
                "tenant_key": insight.get("tenant_key") or str(org_id),
                "widget_key": insight.get("widget_key"),
                "entity_type": insight.get("entity_type"),
                "entity_id": insight.get("entity_id"),
                "project_id": insight.get("project_id"),
                "task_id": task_id,
                "expected_impact": expected_impact,
                "status": "pending",
                "owner_user_id": responsible_id,
            }
            action_values = {k: v for k, v in action_values.items() if k in action_columns}
            if action_values:
                cols = ", ".join(action_values.keys())
                vals = ", ".join([f":{k}" for k in action_values.keys()])
                await session.execute(
                    text(
                        f"""
                        INSERT INTO ai.actions ({cols})
                        VALUES ({vals})
                        """
                    ),
                    action_values,
                )

        items.append(
            AIAutoActionItem(
                insight_id=insight["id"],
                responsible_user_id=responsible_id,
                task_id=task_id,
                notification_id=notification_id,
                action_request_id=action_request_id,
                status=(
                    "suggested" if action_request_id else "created" if task_id or notification_id else "skipped"
                ),
            )
        )

    await session.commit()
    return AIAutoActionResponse(items=items)


@router.get("/action-requests", response_model=AIActionRequestList)
async def list_action_requests(
    status: Optional[str] = Query(default=None),
    responsible_user_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_id = await _get_active_org_id(session, current_user)
    role = await session.scalar(
        select(Membership.role).where(
            Membership.org_id == org_id,
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.ACTIVE,
            Membership.deleted_at.is_(None),
        )
    )
    is_admin = role in {MembershipRole.OWNER, MembershipRole.ADMIN}
    if not is_admin:
        if responsible_user_id and responsible_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed to view other users' requests")
        responsible_user_id = current_user.id

    columns = await _get_table_columns(session, "ai", "action_requests")
    if not columns:
        raise HTTPException(status_code=500, detail="AI action_requests schema missing")

    select_cols = [
        "id",
        "organization_id",
        "insight_id",
        "recommendation_id",
        "responsible_user_id",
        "status",
        "action_type",
        "title",
        "description",
        "priority",
        "widget_key",
        "severity",
        "entity_type",
        "entity_id",
        "project_id",
        "kpi_indicator_id",
        "objective_id",
        "key_result_id",
        "expected_impact",
        "payload",
        "task_id",
        "created_by",
        "created_at",
        "reviewed_by",
        "reviewed_at",
    ]
    select_cols = [col for col in select_cols if col in columns]
    where_clauses = ["organization_id = :org_id"]
    params: Dict[str, Any] = {"org_id": org_id, "limit": limit, "offset": offset}

    if status and "status" in columns:
        where_clauses.append("status = :status")
        params["status"] = status
    if responsible_user_id and "responsible_user_id" in columns:
        where_clauses.append("responsible_user_id = :responsible_user_id")
        params["responsible_user_id"] = responsible_user_id

    where_sql = f"WHERE {' AND '.join(where_clauses)}"
    query = text(
        f"""
        SELECT {", ".join(select_cols)}
        FROM ai.action_requests
        {where_sql}
        ORDER BY created_at DESC
        LIMIT :limit
        OFFSET :offset
        """
    )
    result = await session.execute(query, params)
    rows = result.mappings().all()
    return AIActionRequestList(items=[dict(row) for row in rows])


@router.post("/action-requests/{action_request_id}/accept", response_model=AIActionRequestDecision)
async def accept_action_request(
    action_request_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_id = await _get_active_org_id(session, current_user)
    columns = await _get_table_columns(session, "ai", "action_requests")
    if not columns:
        raise HTTPException(status_code=500, detail="AI action_requests schema missing")

    select_cols = [
        "id",
        "organization_id",
        "responsible_user_id",
        "status",
        "title",
        "description",
        "priority",
        "widget_key",
        "severity",
        "entity_type",
        "entity_id",
        "project_id",
        "kpi_indicator_id",
        "objective_id",
        "key_result_id",
        "expected_impact",
        "task_id",
        "insight_id",
    ]
    select_cols = [col for col in select_cols if col in columns]

    result = await session.execute(
        text(
            f"""
            SELECT {", ".join(select_cols)}
            FROM ai.action_requests
            WHERE id = :action_request_id AND organization_id = :org_id
            """
        ),
        {"action_request_id": action_request_id, "org_id": org_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Action request not found")

    role = await session.scalar(
        select(Membership.role).where(
            Membership.org_id == org_id,
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.ACTIVE,
            Membership.deleted_at.is_(None),
        )
    )
    is_admin = role in {MembershipRole.OWNER, MembershipRole.ADMIN}
    responsible_id = row.get("responsible_user_id")
    if not is_admin and responsible_id and responsible_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to accept this request")

    if row.get("status") not in {"pending", "suggested"}:
        return AIActionRequestDecision(status=row.get("status") or "unknown", task_id=row.get("task_id"))

    task_id = row.get("task_id")
    if not task_id:
        priority_value = _safe_task_priority(row.get("priority"), TaskPriority.MEDIUM)
        task = Task(
            id=uuid4(),
            title=row.get("title") or "[AI] Action request",
            description=row.get("description"),
            org_id=org_id,
            creator_id=current_user.id,
            assignee_id=responsible_id or current_user.id,
            project_id=row.get("project_id"),
            status=TaskStatus.TODO,
            priority=priority_value,
            task_type=TaskType.IMPROVEMENT,
            source_ref="ai",
            entity_type=row.get("entity_type"),
            entity_id=row.get("entity_id"),
            expected_impact=row.get("expected_impact"),
            meta_data={
                "ai_action_request_id": row.get("id"),
                "ai_insight_id": row.get("insight_id"),
                "widget_key": row.get("widget_key"),
                "severity": row.get("severity"),
            },
        )
        session.add(task)
        await session.flush()
        task_id = task.id

    await session.execute(
        text(
            """
            UPDATE ai.action_requests
            SET status = 'accepted',
                reviewed_by = :reviewed_by,
                reviewed_at = :reviewed_at,
                task_id = :task_id
            WHERE id = :action_request_id
            """
        ),
        {
            "reviewed_by": current_user.id,
            "reviewed_at": datetime.now(timezone.utc),
            "task_id": task_id,
            "action_request_id": action_request_id,
        },
    )
    await session.commit()
    return AIActionRequestDecision(status="accepted", task_id=task_id)


@router.post("/action-requests/{action_request_id}/reject", response_model=AIActionRequestDecision)
async def reject_action_request(
    action_request_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_id = await _get_active_org_id(session, current_user)
    columns = await _get_table_columns(session, "ai", "action_requests")
    if not columns:
        raise HTTPException(status_code=500, detail="AI action_requests schema missing")

    result = await session.execute(
        text(
            """
            SELECT id, responsible_user_id, status
            FROM ai.action_requests
            WHERE id = :action_request_id AND organization_id = :org_id
            """
        ),
        {"action_request_id": action_request_id, "org_id": org_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Action request not found")

    role = await session.scalar(
        select(Membership.role).where(
            Membership.org_id == org_id,
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.ACTIVE,
            Membership.deleted_at.is_(None),
        )
    )
    is_admin = role in {MembershipRole.OWNER, MembershipRole.ADMIN}
    responsible_id = row.get("responsible_user_id")
    if not is_admin and responsible_id and responsible_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to reject this request")

    if row.get("status") not in {"pending", "suggested"}:
        return AIActionRequestDecision(status=row.get("status") or "unknown", task_id=None)

    await session.execute(
        text(
            """
            UPDATE ai.action_requests
            SET status = 'rejected',
                reviewed_by = :reviewed_by,
                reviewed_at = :reviewed_at
            WHERE id = :action_request_id
            """
        ),
        {
            "reviewed_by": current_user.id,
            "reviewed_at": datetime.now(timezone.utc),
            "action_request_id": action_request_id,
        },
    )
    await session.commit()
    return AIActionRequestDecision(status="rejected", task_id=None)


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    payload: AIChatRequest,
    session: AsyncSession = Depends(get_async_session),
    itstep_session: AsyncSession = Depends(get_itstep_session),
    current_user: User = Depends(get_current_user),
):
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OpenAI is not configured")

    org_id = await _get_active_org_id(session, current_user)
    openai_client = get_openai_client()
    if not openai_client:
        raise HTTPException(status_code=503, detail="OpenAI client is unavailable")

    qdrant_client = get_qdrant_client()
    qdrant_context: Optional[str] = None
    sources: list[dict[str, object]] = []

    if qdrant_client:
        try:
            embedding = await openai_client.embeddings(
                model=settings.OPENAI_EMBEDDINGS_MODEL,
                inputs=[payload.message],
            )
            if embedding and embedding[0]:
                results = await qdrant_client.search(
                    collection=settings.QDRANT_COLLECTION,
                    vector=embedding[0],
                    limit=5,
                    filter_payload={
                        "must": [
                            {
                                "key": "organization_id",
                                "match": {"value": str(org_id)},
                            }
                        ]
                    },
                )
                if results:
                    qdrant_context = "\n".join(
                        [
                            f"- {item.get('payload', {}).get('title')}: {item.get('payload', {}).get('summary')}"
                            for item in results
                        ]
                    )
                    sources = [item.get("payload", {}) for item in results]
        except Exception as exc:  # noqa: BLE001
            logger.warning("Qdrant retrieval failed: %s", exc)

    recent_insights = await session.execute(
        text(
            """
            SELECT id, widget_key, severity, title, summary
            FROM ai.insights
            WHERE organization_id = :org_id
            ORDER BY created_at DESC
            LIMIT 5
            """
        ),
        {"org_id": org_id},
    )
    recent_rows = recent_insights.mappings().all()
    recent_context = "\n".join(
        [f"- {row['title']}: {row['summary']}" for row in recent_rows]
    )

    widget_key_rows = await session.execute(
        text(
            """
            SELECT widget_key
            FROM ai.widget_registry
            WHERE is_active = true
            ORDER BY widget_key
            """
        )
    )
    widget_keys = ", ".join(widget_key_rows.scalars().all())
    system_prompt = (
        "Ты аналитический AI агент Planerix. Отвечай кратко и по делу, "
        "не выдумывай данные. Если нужны факты из витрин, вызови инструмент "
        "`get_widget_data` с корректным widget_key и фильтрами. "
        f"Доступные widget_key: {widget_keys}. "
    )

    if recent_context:
        system_prompt += f"\nПоследние инсайты:\n{recent_context}"
    if qdrant_context:
        system_prompt += f"\nПохожие инсайты из памяти:\n{qdrant_context}"

    messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": payload.message})

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_widget_data",
                "description": "Fetch analytics widget data by widget_key and filters.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "widget_key": {"type": "string"},
                        "filters": {"type": "object"},
                    },
                    "required": ["widget_key"],
                },
            },
        }
    ]

    response = await openai_client.chat_completion(
        model=settings.OPENAI_MODEL,
        messages=messages,
        tools=tools,
        tool_choice="auto",
    )
    message = response.get("choices", [{}])[0].get("message", {})
    tool_calls = message.get("tool_calls", [])
    widget_data: Optional[Dict[str, Any]] = None

    if tool_calls:
        for tool_call in tool_calls:
            call_id = tool_call.get("id")
            function = tool_call.get("function", {})
            if function.get("name") != "get_widget_data":
                continue
            try:
                args = json.loads(function.get("arguments", "{}"))
            except json.JSONDecodeError:
                args = {}
            widget_key = args.get("widget_key")
            filters = args.get("filters") or {}
            if widget_key:
                widget_data = await _fetch_widget_data(
                    widget_key, itstep_session, session, str(org_id), filters
                )
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call_id,
                        "content": json.dumps(widget_data, ensure_ascii=True),
                    }
                )

        response = await openai_client.chat_completion(
            model=settings.OPENAI_MODEL,
            messages=messages,
            temperature=0.2,
        )
        message = response.get("choices", [{}])[0].get("message", {})

    answer = message.get("content") or "Ответ не получен."

    return AIChatResponse(answer=answer, sources=sources or None, widget_data=widget_data)
