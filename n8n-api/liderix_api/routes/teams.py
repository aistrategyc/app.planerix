from __future__ import annotations

from typing import List
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from liderix_api.db import get_async_session
from liderix_api.models import Department, Membership
from liderix_api.models.users import User
from liderix_api.models.tasks import Task
from liderix_api.models.project_members import ProjectMember
from liderix_api.models.projects import Project
from liderix_api.enums import TaskStatus, ProjectStatus
from liderix_api.schemas.teams import TeamListResponse, TeamRead, TeamMemberRead
from liderix_api.services.guards import tenant_guard, TenantContext, require_perm
from liderix_api.services.audit import AuditLogger

router = APIRouter(prefix="/orgs/{org_id}/teams", tags=["Teams"])


def _display_name(user: User) -> str:
    if user.full_name:
        return user.full_name
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or user.username or user.email


@router.get("", response_model=TeamListResponse, include_in_schema=False)
@router.get("/", response_model=TeamListResponse)
async def list_teams(
    org_id: UUID,
    request: Request,
    ctx: TenantContext = Depends(tenant_guard),
    session: AsyncSession = Depends(get_async_session),
):
    await require_perm(ctx, "org:read")

    departments = (await session.execute(
        select(Department)
        .where(and_(Department.org_id == org_id, Department.deleted_at.is_(None)))
        .order_by(Department.name.asc())
    )).scalars().all()

    memberships = (await session.execute(
        select(Membership)
        .options(selectinload(Membership.user), selectinload(Membership.department))
        .where(
            and_(
                Membership.org_id == org_id,
                Membership.deleted_at.is_(None),
            )
        )
    )).scalars().all()

    user_ids = [m.user_id for m in memberships if m.user_id]

    tasks_by_user = {}
    if user_ids:
        rows = await session.execute(
            select(Task.assignee_id, func.count(Task.id))
            .where(
                and_(
                    Task.assignee_id.in_(user_ids),
                    Task.status == TaskStatus.DONE,
                    Task.deleted_at.is_(None),
                )
            )
            .group_by(Task.assignee_id)
        )
        tasks_by_user = {row[0]: int(row[1] or 0) for row in rows}

    now = datetime.now(timezone.utc)
    workload_by_user = {}
    if user_ids:
        active_statuses = TaskStatus.get_active_statuses()
        open_case = case((Task.status.in_(active_statuses), 1), else_=0)
        overdue_case = case(
            (
                and_(
                    Task.status.in_(active_statuses),
                    Task.due_date.is_not(None),
                    Task.due_date < now,
                ),
                1,
            ),
            else_=0,
        )
        review_case = case((Task.status == TaskStatus.IN_REVIEW, 1), else_=0)
        blocked_case = case((Task.status == TaskStatus.BLOCKED, 1), else_=0)

        rows = await session.execute(
            select(
                Task.assignee_id,
                func.sum(open_case).label("open_count"),
                func.sum(overdue_case).label("overdue_count"),
                func.sum(review_case).label("review_count"),
                func.sum(blocked_case).label("blocked_count"),
            )
            .where(
                and_(
                    Task.assignee_id.in_(user_ids),
                    Task.deleted_at.is_(None),
                )
            )
            .group_by(Task.assignee_id)
        )
        workload_by_user = {
            row[0]: {
                "open": int(row[1] or 0),
                "overdue": int(row[2] or 0),
                "review": int(row[3] or 0),
                "blocked": int(row[4] or 0),
            }
            for row in rows
        }

    projects_by_user = {}
    if user_ids:
        rows = await session.execute(
            select(ProjectMember.user_id, func.count(func.distinct(ProjectMember.project_id)))
            .join(Project, Project.id == ProjectMember.project_id)
            .where(
                and_(
                    ProjectMember.user_id.in_(user_ids),
                    ProjectMember.deleted_at.is_(None),
                    Project.deleted_at.is_(None),
                    Project.status == ProjectStatus.ACTIVE,
                )
            )
            .group_by(ProjectMember.user_id)
        )
        projects_by_user = {row[0]: int(row[1] or 0) for row in rows}

    members_by_department: dict[UUID, List[TeamMemberRead]] = {}
    team_workload: dict[UUID, dict[str, int]] = {}
    for membership in memberships:
        user = membership.user
        if not user:
            continue
        workload = workload_by_user.get(user.id, {"open": 0, "overdue": 0, "review": 0, "blocked": 0})
        member = TeamMemberRead(
            id=user.id,
            name=_display_name(user),
            email=user.email,
            role=membership.role,
            department=membership.department.name if membership.department else None,
            position=user.position,
            avatar_url=user.avatar_url,
            join_date=membership.created_at,
            status=membership.status,
            tasks_completed=tasks_by_user.get(user.id, 0),
            projects_active=projects_by_user.get(user.id, 0),
            tasks_open=workload["open"],
            tasks_overdue=workload["overdue"],
            tasks_in_review=workload["review"],
            tasks_blocked=workload["blocked"],
        )
        if membership.department_id:
            members_by_department.setdefault(membership.department_id, []).append(member)
            team_totals = team_workload.setdefault(
                membership.department_id,
                {"open": 0, "overdue": 0, "review": 0, "blocked": 0},
            )
            team_totals["open"] += workload["open"]
            team_totals["overdue"] += workload["overdue"]
            team_totals["review"] += workload["review"]
            team_totals["blocked"] += workload["blocked"]

    teams: List[TeamRead] = []
    for dept in departments:
        dept_members = members_by_department.get(dept.id, [])
        lead_name = None
        if dept.manager_id:
            manager = await session.get(User, dept.manager_id)
            if manager:
                lead_name = _display_name(manager)
        totals = team_workload.get(dept.id, {"open": 0, "overdue": 0, "review": 0, "blocked": 0})
        teams.append(
            TeamRead(
                id=dept.id,
                name=dept.name,
                description=dept.description,
                department=dept.name,
                lead=lead_name,
                policy=dept.policy,
                members=dept_members,
                projects=0,
                tasks_open=totals["open"],
                tasks_overdue=totals["overdue"],
                tasks_in_review=totals["review"],
                tasks_blocked=totals["blocked"],
                created_at=dept.created_at,
            )
        )

    await AuditLogger.log_event(
        session,
        ctx.user_id,
        "teams.list",
        True,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
        {"org_id": str(org_id), "team_count": len(teams)},
    )

    return TeamListResponse(items=teams, total=len(teams))
