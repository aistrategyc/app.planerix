from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_async_session
from liderix_api.enums import MembershipStatus
from liderix_api.models.memberships import Membership
from liderix_api.models.organization import DataSource, OAuthCredential
from liderix_api.models.users import User
from liderix_api.schemas.integrations import (
    DataSourceResponse,
    OAuthCredentialCreate,
    OAuthCredentialResponse,
    N8NCredentialCreate,
    N8NCredentialResponse,
    N8NWorkflowProvisionRequest,
    N8NWorkflowProvisionResponse,
)
from liderix_api.services.auth import get_current_user
from liderix_api.services.n8n import N8NError, get_n8n_client

router = APIRouter(prefix="/integrations", tags=["Integrations"])


async def _get_active_org_id(session: AsyncSession, user: User) -> UUID:
    membership = await session.scalar(
        select(Membership.org_id).where(
            Membership.user_id == user.id,
            Membership.deleted_at.is_(None),
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    if not membership:
        raise HTTPException(status_code=400, detail="User has no active organization")
    return membership


@router.get("/data-sources", response_model=list[DataSourceResponse])
async def list_data_sources(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_id = await _get_active_org_id(session, current_user)
    sources = (
        await session.scalars(
            select(DataSource)
            .where(
                DataSource.org_id == org_id,
                DataSource.deleted_at.is_(None),
            )
            .order_by(DataSource.created_at.desc())
        )
    ).all()
    return sources


@router.post("/n8n/provision", response_model=N8NWorkflowProvisionResponse)
async def provision_n8n_workflow(
    payload: N8NWorkflowProvisionRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_id = await _get_active_org_id(session, current_user)
    client = get_n8n_client()

    try:
        template = await client.request("GET", f"/api/v1/workflows/{payload.template_workflow_id}")
    except N8NError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    workflow_payload = {
        "name": payload.name
        or f"{payload.provider} - {current_user.email} - {payload.template_workflow_id}",
        "nodes": template.get("nodes", []),
        "connections": template.get("connections", {}),
        "settings": template.get("settings", {}),
        "staticData": template.get("staticData"),
    }

    try:
        created = await client.request("POST", "/api/v1/workflows", json=workflow_payload)
    except N8NError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    workflow_id = str(created.get("id"))
    workflow_url = f"{client.base_url}/workflow/{workflow_id}"

    data_source = DataSource(
        org_id=org_id,
        type=payload.provider,
        name=payload.name or f"{payload.provider} integration",
        status="connected",
        config={
            "n8n_workflow_id": workflow_id,
            "n8n_template_workflow_id": payload.template_workflow_id,
            "n8n_workflow_url": workflow_url,
        },
    )
    session.add(data_source)
    await session.commit()
    await session.refresh(data_source)

    return N8NWorkflowProvisionResponse(
        workflow_id=workflow_id,
        workflow_url=workflow_url,
        data_source_id=data_source.id,
    )


@router.post("/oauth", response_model=OAuthCredentialResponse)
async def store_oauth_credential(
    payload: OAuthCredentialCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_id = await _get_active_org_id(session, current_user)

    data_source = await session.scalar(
        select(DataSource).where(
            DataSource.org_id == org_id,
            DataSource.type == payload.provider,
            DataSource.deleted_at.is_(None),
        )
    )

    if not data_source:
        data_source = DataSource(
            org_id=org_id,
            type=payload.provider,
            name=payload.name or f"{payload.provider} integration",
            status="connected",
            config={},
        )
        session.add(data_source)
        await session.flush()

    config = dict(data_source.config or {})
    if payload.external_account_id:
        config["external_account_id"] = payload.external_account_id
    if payload.metadata:
        config["metadata"] = payload.metadata
    data_source.config = config
    data_source.status = "connected"

    credential = OAuthCredential(
        org_id=org_id,
        data_source_id=data_source.id,
        access_token_enc=payload.access_token,
        refresh_token_enc=payload.refresh_token,
        expires_at=payload.expires_at,
        meta_data=payload.metadata,
    )
    session.add(credential)
    await session.commit()
    await session.refresh(credential)

    return OAuthCredentialResponse(
        data_source_id=data_source.id,
        oauth_credential_id=credential.id,
    )


@router.post("/n8n/credentials", response_model=N8NCredentialResponse)
async def create_n8n_credential(
    payload: N8NCredentialCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    org_id = await _get_active_org_id(session, current_user)
    client = get_n8n_client()

    try:
        created = await client.request(
            "POST",
            "/api/v1/credentials",
            json={
                "name": payload.name,
                "type": payload.credential_type,
                "data": payload.credential_data,
            },
        )
    except N8NError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    credential_id = str(created.get("id"))

    if payload.data_source_id:
        data_source = await session.scalar(
            select(DataSource).where(
                DataSource.id == payload.data_source_id,
                DataSource.org_id == org_id,
                DataSource.deleted_at.is_(None),
            )
        )
        if data_source:
            config = dict(data_source.config or {})
            config["n8n_credential_id"] = credential_id
            data_source.config = config
            await session.commit()

    return N8NCredentialResponse(
        credential_id=credential_id,
        data_source_id=payload.data_source_id,
    )
