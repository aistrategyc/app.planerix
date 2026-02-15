"""
Onboarding API routes for new user setup
"""

from __future__ import annotations

from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_async_session
from liderix_api.models.users import User
from liderix_api.services.auth import get_current_user
from liderix_api.services.onboarding import OnboardingService


router = APIRouter(tags=["Onboarding"])


class OnboardingTemplateInfo(BaseModel):
    """Information about an onboarding template"""
    name: str
    description: str
    icon: str
    ideal_for: str
    includes: list[str]
    recommended_team_size: str


class OnboardingTemplatesResponse(BaseModel):
    """Response with all available templates"""
    templates: Dict[str, OnboardingTemplateInfo]


class OnboardingCreateRequest(BaseModel):
    """Request to create sample data"""
    template: str = Field(
        default="business",
        description="Template to use: business, marketing, software, sales, empty"
    )


class OnboardingCreateResponse(BaseModel):
    """Response after creating sample data"""
    success: bool
    template: str
    created: Dict[str, int] = Field(description="Count of created entities")
    message: str


@router.get("/templates", response_model=OnboardingTemplatesResponse)
async def get_onboarding_templates() -> OnboardingTemplatesResponse:
    """
    Get available onboarding templates

    Returns information about all available templates for the onboarding wizard.
    This endpoint does not require authentication for users to preview options.
    """
    templates_info = OnboardingService.get_template_info()

    # Convert to Pydantic models
    templates = {
        key: OnboardingTemplateInfo(**info)
        for key, info in templates_info.items()
    }

    return OnboardingTemplatesResponse(templates=templates)


@router.post("/setup", response_model=OnboardingCreateResponse, status_code=201)
async def create_onboarding_data(
    request: OnboardingCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
) -> OnboardingCreateResponse:
    """
    Create sample data for user based on selected template

    This endpoint should be called after user registration to populate
    their workspace with sample data that demonstrates the platform's features.

    **Templates:**
    - `business`: General business management
    - `marketing`: Marketing campaigns and lead generation
    - `software`: Agile development and sprints
    - `sales`: CRM and sales pipeline
    - `empty`: Clean slate with no sample data
    """
    # Get user's organization ID
    org_id = current_user.org_id
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "type": "urn:problem:no-organization",
                "title": "No Organization",
                "detail": "User must be associated with an organization",
                "status": 400
            }
        )

    try:
        result = await OnboardingService.create_sample_data_for_user(
            user_id=current_user.id,
            org_id=org_id,
            session=session,
            template=request.template
        )

        return OnboardingCreateResponse(
            success=True,
            template=result["template"],
            created=result["created"],
            message=f"Successfully created {request.template} template workspace"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "type": "urn:problem:invalid-request",
                "title": "Invalid Request",
                "detail": str(e),
                "status": 400
            }
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "type": "urn:problem:internal-error",
                "title": "Internal Server Error",
                "detail": "Failed to create onboarding data",
                "status": 500
            }
        )


@router.get("/status")
async def get_onboarding_status(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
) -> Dict[str, Any]:
    """
    Check if user has completed onboarding

    Returns information about user's workspace setup status:
    - Has projects
    - Has tasks
    - Has OKRs
    - Has KPIs
    - Suggested next steps
    """
    from sqlalchemy import select, func
    from liderix_api.models.projects import Project
    from liderix_api.models.tasks import Task
    from liderix_api.models.okr import Objective
    from liderix_api.models.kpi import KPIIndicator

    org_id = current_user.org_id
    if not org_id:
        return {
            "onboarding_complete": False,
            "has_projects": False,
            "has_tasks": False,
            "has_okrs": False,
            "has_kpis": False,
            "completion_percentage": 0,
            "next_steps": ["Join or create an organization"]
        }

    # Count entities
    projects_count = (await session.execute(
        select(func.count(Project.id)).where(Project.org_id == org_id)
    )).scalar() or 0

    tasks_count = (await session.execute(
        select(func.count(Task.id)).where(Task.org_id == org_id)
    )).scalar() or 0

    okrs_count = (await session.execute(
        select(func.count(Objective.id)).where(Objective.org_id == org_id)
    )).scalar() or 0

    kpis_count = (await session.execute(
        select(func.count(KPIIndicator.id)).where(KPIIndicator.org_id == org_id)
    )).scalar() or 0

    # Calculate completion
    has_projects = projects_count > 0
    has_tasks = tasks_count > 0
    has_okrs = okrs_count > 0
    has_kpis = kpis_count > 0

    completed_steps = sum([has_projects, has_tasks, has_okrs, has_kpis])
    completion_percentage = int((completed_steps / 4) * 100)

    # Determine onboarding status
    onboarding_complete = completion_percentage >= 75

    # Suggest next steps
    next_steps = []
    if not has_projects:
        next_steps.append("Create your first project")
    if not has_tasks:
        next_steps.append("Add tasks to track work")
    if not has_okrs:
        next_steps.append("Set goals with OKRs")
    if not has_kpis:
        next_steps.append("Define KPIs to measure success")

    if onboarding_complete and not next_steps:
        next_steps = [
            "Invite team members",
            "Connect integrations",
            "Customize your dashboard"
        ]

    return {
        "onboarding_complete": onboarding_complete,
        "has_projects": has_projects,
        "has_tasks": has_tasks,
        "has_okrs": has_okrs,
        "has_kpis": has_kpis,
        "counts": {
            "projects": projects_count,
            "tasks": tasks_count,
            "okrs": okrs_count,
            "kpis": kpis_count,
        },
        "completion_percentage": completion_percentage,
        "next_steps": next_steps
    }
