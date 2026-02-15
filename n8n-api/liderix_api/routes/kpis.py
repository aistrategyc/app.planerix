from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc, or_
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from liderix_api.models.kpi import KPIIndicator, KPIMeasurement
from liderix_api.schemas.kpis import (
    KPICreate, KPIUpdate, KPIRead, KPIListResponse,
    KPIMeasurementCreate, KPIMeasurementUpdate, KPIMeasurementRead,
    KPIDashboard, KPITrendData,
    KPIBulkUpdateRequest, KPIStatus, KPIType, KPIPeriod, KPISourceType, KPIAggregation,
    # Legacy schemas for backward compatibility
    KPICreateLegacy, KPIReadLegacy
)
from liderix_api.db import get_async_session
from liderix_api.services.auth import get_current_user
from liderix_api.models.users import User
from liderix_api.services.permissions import check_organization_access

# Backward compatibility: many call sites still use `KPI`.
KPI = KPIIndicator

router = APIRouter(prefix="", tags=["KPIs & Performance Metrics"])

# ==================== KPI CRUD OPERATIONS ====================

@router.get("/kpis", response_model=KPIListResponse)
async def get_kpis(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[KPIStatus] = None,
    kpi_type: Optional[KPIType] = None,
    owner_id: Optional[UUID] = None,
    project_id: Optional[UUID] = None,
    search: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    overdue_only: bool = False,
    achieved_only: bool = False,
    include_measurements: bool = Query(True, description="Include latest measurements"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get KPIs with advanced filtering, pagination and search."""
    await check_organization_access(session, current_user.org_id, current_user)

    # Build base query
    query = select(KPI).where(
        and_(
            KPI.org_id == current_user.org_id,
            KPI.deleted_at.is_(None)
        )
    )

    if include_measurements:
        query = query.options(selectinload(KPI.measurements))

    # Apply filters
    filters_applied = {}
    if status:
        query = query.where(KPI.status == status)
        filters_applied['status'] = status.value

    if kpi_type:
        query = query.where(KPI.kpi_type == kpi_type)
        filters_applied['kpi_type'] = kpi_type.value

    if owner_id:
        query = query.where(KPI.owner_id == owner_id)
        filters_applied['owner_id'] = str(owner_id)

    if project_id:
        query = query.where(KPI.project_id == project_id)
        filters_applied['project_id'] = str(project_id)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                KPI.name.ilike(search_term),
                KPI.description.ilike(search_term),
                KPI.formula.ilike(search_term)
            )
        )
        filters_applied['search'] = search

    if tags:
        # PostgreSQL JSON contains search
        for tag in tags:
            query = query.where(KPI.tags.contains([tag]))
        filters_applied['tags'] = tags

    if overdue_only:
        current_time = datetime.now(timezone.utc)
        query = query.where(
            and_(
                KPI.next_review_date.is_not(None),
                KPI.next_review_date < current_time,
                KPI.status != KPIStatus.ACHIEVED
            )
        )
        filters_applied['overdue_only'] = True

    if achieved_only:
        query = query.where(KPI.status == KPIStatus.ACHIEVED)
        filters_applied['achieved_only'] = True

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await session.scalar(count_query)

    # Apply pagination and ordering
    query = query.order_by(desc(KPI.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    kpis = result.scalars().all()

    return KPIListResponse(
        items=kpis,
        total=total,
        page=page,
        page_size=page_size,
        filters_applied=filters_applied
    )

@router.get("/kpis/{kpi_id}", response_model=KPIRead)
async def get_kpi(
    kpi_id: UUID,
    include_all_measurements: bool = Query(False, description="Include all measurements history"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific KPI with optional measurement history."""
    await check_organization_access(session, current_user.org_id, current_user)

    query = select(KPI).options(
        selectinload(KPI.measurements) if include_all_measurements else selectinload(KPI.measurements).limit(10)
    ).where(
        and_(
            KPI.id == kpi_id,
            KPI.org_id == current_user.org_id,
            KPI.deleted_at.is_(None)
        )
    )

    result = await session.execute(query)
    kpi = result.scalar_one_or_none()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")

    return kpi

@router.post("/kpis", response_model=KPIRead)
async def create_kpi(
    data: KPICreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new KPI with optional initial measurements."""
    await check_organization_access(session, current_user.org_id, current_user)

    # Create KPI - map schema fields to model fields and convert enums to strings
    kpi_data = data.model_dump(exclude={'initial_measurements', 'objective_id'}, mode='python')

    # Convert enum values to strings
    if 'source_type' in kpi_data and isinstance(kpi_data['source_type'], KPISourceType):
        kpi_data['source_type'] = kpi_data['source_type'].value
    if 'kpi_type' in kpi_data and isinstance(kpi_data['kpi_type'], KPIType):
        kpi_data['kpi_type'] = kpi_data['kpi_type'].value
    if 'period' in kpi_data and isinstance(kpi_data['period'], KPIPeriod):
        kpi_data['period'] = kpi_data['period'].value
    if 'aggregation' in kpi_data and isinstance(kpi_data['aggregation'], KPIAggregation):
        kpi_data['aggregation'] = kpi_data['aggregation'].value
    if 'status' in kpi_data and isinstance(kpi_data['status'], KPIStatus):
        kpi_data['status'] = kpi_data['status'].value

    new_kpi = KPI(
        **kpi_data,
        org_id=current_user.org_id,
        created_at=datetime.now(timezone.utc)
    )

    # Auto-set owner if not specified
    if not new_kpi.owner_id:
        new_kpi.owner_id = current_user.id

    session.add(new_kpi)
    await session.flush()  # Get KPI ID

    # Add initial measurements if provided
    if data.initial_measurements:
        for measurement_data in data.initial_measurements:
            measurement = KPIMeasurement(
                **measurement_data.model_dump(),
                indicator_id=new_kpi.id,
                created_at=datetime.now(timezone.utc)
            )
            session.add(measurement)

            # Update current value with the latest measurement
            if not new_kpi.current_value or measurement.measured_at > (new_kpi.measurements[0].measured_at if new_kpi.measurements else datetime.min):
                new_kpi.current_value = measurement.value

    # Auto-update status based on progress
    new_kpi.update_status_based_on_progress()

    await session.commit()

    # Re-fetch with eager loading to avoid DetachedInstanceError
    result = await session.execute(
        select(KPI)
        .options(selectinload(KPI.measurements))
        .where(KPI.id == new_kpi.id)
    )
    refreshed_kpi = result.scalar_one()

    return refreshed_kpi

@router.put("/kpis/{kpi_id}", response_model=KPIRead)
async def update_kpi(
    kpi_id: UUID,
    data: KPIUpdate,
    auto_update_status: bool = Query(True, description="Automatically update status based on progress"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Update an existing KPI."""
    await check_organization_access(session, current_user.org_id, current_user)

    result = await session.execute(
        select(KPI).options(
            selectinload(KPI.measurements)
        ).where(
            and_(
                KPI.id == kpi_id,
                KPI.org_id == current_user.org_id,
                KPI.deleted_at.is_(None)
            )
        )
    )
    kpi = result.scalar_one_or_none()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")

    # Update fields
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(kpi, field, value)

    kpi.updated_at = datetime.now(timezone.utc)

    # Auto-update status if requested and current_value or target_value changed
    if auto_update_status and ('current_value' in data.model_dump(exclude_unset=True) or 'target_value' in data.model_dump(exclude_unset=True)):
        kpi.update_status_based_on_progress()

    await session.commit()
    await session.refresh(kpi)
    return kpi

@router.delete("/kpis/{kpi_id}")
async def delete_kpi(
    kpi_id: UUID,
    hard_delete: bool = Query(False, description="Permanently delete (default is soft delete)"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a KPI (soft delete by default)."""
    await check_organization_access(session, current_user.org_id, current_user)

    result = await session.execute(
        select(KPI).where(
            and_(
                KPI.id == kpi_id,
                KPI.org_id == current_user.org_id,
                KPI.deleted_at.is_(None) if not hard_delete else True
            )
        )
    )
    kpi = result.scalar_one_or_none()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")

    if hard_delete:
        await session.delete(kpi)
    else:
        kpi.deleted_at = datetime.now(timezone.utc)

    await session.commit()
    return {"detail": "KPI deleted successfully"}

# ==================== KPI MEASUREMENTS ====================

@router.post("/kpis/{kpi_id}/measurements", response_model=KPIMeasurementRead)
async def add_kpi_measurement(
    kpi_id: UUID,
    data: KPIMeasurementCreate,
    auto_update_current: bool = Query(True, description="Auto-update KPI current value"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Add a new measurement to a KPI."""
    await check_organization_access(session, current_user.org_id, current_user)

    # Verify KPI exists and belongs to organization
    kpi = await session.execute(
        select(KPI).where(
            and_(
                KPI.id == kpi_id,
                KPI.org_id == current_user.org_id,
                KPI.deleted_at.is_(None)
            )
        )
    )
    kpi = kpi.scalar_one_or_none()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")

    # Create measurement
    measurement = KPIMeasurement(
        **data.model_dump(),
        indicator_id=kpi_id,
        created_at=datetime.now(timezone.utc)
    )
    session.add(measurement)

    # Update KPI current value if this is the latest measurement
    if auto_update_current:
        kpi.current_value = measurement.value
        kpi.last_measured_at = measurement.measured_at
        kpi.update_status_based_on_progress()
        kpi.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(measurement)
    return measurement

@router.get("/kpis/{kpi_id}/measurements", response_model=List[KPIMeasurementRead])
async def get_kpi_measurements(
    kpi_id: UUID,
    limit: int = Query(50, ge=1, le=500),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get measurements for a specific KPI."""
    await check_organization_access(session, current_user.org_id, current_user)

    # Verify KPI access
    kpi_check = await session.execute(
        select(KPI.id).where(
            and_(
                KPI.id == kpi_id,
                KPI.org_id == current_user.org_id,
                KPI.deleted_at.is_(None)
            )
        )
    )
    if not kpi_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="KPI not found")

    # Build query
    query = select(KPIMeasurement).where(KPIMeasurement.indicator_id == kpi_id)

    if start_date:
        query = query.where(KPIMeasurement.measured_at >= start_date)
    if end_date:
        query = query.where(KPIMeasurement.measured_at <= end_date)

    query = query.order_by(desc(KPIMeasurement.measured_at)).limit(limit)

    result = await session.execute(query)
    return result.scalars().all()

@router.put("/measurements/{measurement_id}", response_model=KPIMeasurementRead)
async def update_measurement(
    measurement_id: UUID,
    data: KPIMeasurementUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Update a KPI measurement."""
    await check_organization_access(session, current_user.org_id, current_user)

    result = await session.execute(
        select(KPIMeasurement).join(KPI).where(
            and_(
                KPIMeasurement.id == measurement_id,
                KPI.org_id == current_user.org_id
            )
        )
    )
    measurement = result.scalar_one_or_none()
    if not measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")

    # Update fields
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(measurement, field, value)

    measurement.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(measurement)
    return measurement

@router.delete("/measurements/{measurement_id}")
async def delete_measurement(
    measurement_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a KPI measurement."""
    await check_organization_access(session, current_user.org_id, current_user)

    result = await session.execute(
        select(KPIMeasurement).join(KPI).where(
            and_(
                KPIMeasurement.id == measurement_id,
                KPI.org_id == current_user.org_id
            )
        )
    )
    measurement = result.scalar_one_or_none()
    if not measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")

    await session.delete(measurement)
    await session.commit()
    return {"detail": "Measurement deleted successfully"}

# ==================== ADVANCED KPI FEATURES ====================

@router.get("/kpis/dashboard", response_model=KPIDashboard)
async def get_kpi_dashboard(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get KPI dashboard overview."""
    await check_organization_access(session, current_user.org_id, current_user)

    # Get all KPIs for the organization
    query = select(KPI).options(
        selectinload(KPI.measurements)
    ).where(
        and_(
            KPI.org_id == current_user.org_id,
            KPI.deleted_at.is_(None)
        )
    )
    result = await session.execute(query)
    kpis = result.scalars().all()

    # Calculate statistics
    total_kpis = len(kpis)
    kpis_by_status = {}
    kpis_by_type = {}
    achieved_count = 0
    on_track_count = 0
    overdue_count = 0

    current_time = datetime.now(timezone.utc)

    for kpi in kpis:
        # Status distribution
        status_key = kpi.status.value
        kpis_by_status[status_key] = kpis_by_status.get(status_key, 0) + 1

        # Type distribution
        type_key = kpi.kpi_type.value
        kpis_by_type[type_key] = kpis_by_type.get(type_key, 0) + 1

        # Performance metrics
        if kpi.status == KPIStatus.ACHIEVED:
            achieved_count += 1
        if kpi.status == KPIStatus.ON_TRACK:
            on_track_count += 1
        if kpi.next_review_date and kpi.next_review_date < current_time and kpi.status != KPIStatus.ACHIEVED:
            overdue_count += 1

    # Calculate rates
    average_achievement_rate = (achieved_count / total_kpis * 100) if total_kpis > 0 else 0
    on_track_percentage = ((achieved_count + on_track_count) / total_kpis * 100) if total_kpis > 0 else 0

    # Get top performers and underperformers
    kpi_reads = [KPIRead.model_validate(kpi) for kpi in kpis if kpi.target_value > 0]
    top_performers = sorted(kpi_reads, key=lambda x: x.progress_percentage, reverse=True)[:10]
    underperformers = [kpi for kpi in kpi_reads if kpi.status == KPIStatus.OFF_TRACK or kpi.progress_percentage < 50][:10]
    recent_achievements = [kpi for kpi in kpi_reads if kpi.status == KPIStatus.ACHIEVED][:5]

    return KPIDashboard(
        organization_id=current_user.org_id,
        total_kpis=total_kpis,
        kpis_by_status=kpis_by_status,
        kpis_by_type=kpis_by_type,
        average_achievement_rate=average_achievement_rate,
        on_track_percentage=on_track_percentage,
        overdue_reviews=overdue_count,
        top_performers=top_performers,
        underperformers=underperformers,
        recent_achievements=recent_achievements
    )

@router.get("/kpis/{kpi_id}/trend", response_model=KPITrendData)
async def get_kpi_trend(
    kpi_id: UUID,
    days_back: int = Query(90, ge=7, le=365),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Get trend data for a specific KPI."""
    await check_organization_access(session, current_user.org_id, current_user)

    # Get KPI with measurements
    kpi_result = await session.execute(
        select(KPI).options(
            selectinload(KPI.measurements)
        ).where(
            and_(
                KPI.id == kpi_id,
                KPI.org_id == current_user.org_id,
                KPI.deleted_at.is_(None)
            )
        )
    )
    kpi = kpi_result.scalar_one_or_none()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")

    # Filter measurements for the period
    start_date = datetime.now(timezone.utc) - timedelta(days=days_back)
    recent_measurements = [
        m for m in kpi.measurements
        if m.measured_at >= start_date
    ]

    # Build data points
    data_points = []
    for measurement in recent_measurements:
        data_points.append({
            "date": measurement.measured_at.isoformat(),
            "value": measurement.value,
            "target": kpi.target_value,
            "notes": measurement.notes
        })

    # Calculate trend
    if len(recent_measurements) >= 2:
        first_value = recent_measurements[-1].value  # Oldest
        last_value = recent_measurements[0].value    # Newest

        if first_value != 0:
            trend_percentage = ((last_value - first_value) / first_value) * 100
        else:
            trend_percentage = 0.0

        if trend_percentage > 5:
            trend_direction = "up"
        elif trend_percentage < -5:
            trend_direction = "down"
        else:
            trend_direction = "stable"
    else:
        trend_direction = "stable"
        trend_percentage = 0.0

    # Period comparisons (simplified)
    period_comparison = {
        "vs_target": ((kpi.current_value - kpi.target_value) / kpi.target_value * 100) if kpi.target_value != 0 else 0,
        "vs_baseline": ((kpi.current_value - kpi.baseline_value) / kpi.baseline_value * 100) if kpi.baseline_value and kpi.baseline_value != 0 else 0
    }

    return KPITrendData(
        kpi_id=kpi.id,
        kpi_name=kpi.name,
        data_points=data_points,
        trend_direction=trend_direction,
        trend_percentage=trend_percentage,
        period_comparison=period_comparison
    )

@router.post("/kpis/bulk-update")
async def bulk_update_kpis(
    request: KPIBulkUpdateRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Update multiple KPIs at once."""
    await check_organization_access(session, current_user.org_id, current_user)

    # Get KPIs to update
    result = await session.execute(
        select(KPI).where(
            and_(
                KPI.id.in_(request.kpi_ids),
                KPI.org_id == current_user.org_id,
                KPI.deleted_at.is_(None)
            )
        )
    )
    kpis = result.scalars().all()

    if len(kpis) != len(request.kpi_ids):
        raise HTTPException(status_code=404, detail="Some KPIs not found or access denied")

    # Update KPIs
    updated_count = 0
    for kpi in kpis:
        for field, value in request.updates.model_dump(exclude_unset=True).items():
            setattr(kpi, field, value)
        kpi.updated_at = datetime.now(timezone.utc)
        kpi.update_status_based_on_progress()
        updated_count += 1

    await session.commit()

    return {
        "detail": f"Updated {updated_count} KPIs",
        "updated_count": updated_count,
        "updated_kpi_ids": [str(kpi.id) for kpi in kpis]
    }

# ==================== LEGACY COMPATIBILITY ====================

@router.post("/kpis/legacy", response_model=KPIReadLegacy)
async def create_kpi_legacy(
    data: KPICreateLegacy,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Legacy KPI creation endpoint for backward compatibility."""
    # Convert legacy schema to new schema
    new_data = KPICreate(
        name=data.name,
        description=data.description,
        target_value=data.target_value,
        current_value=data.current_value or 0.0,
        period=KPIPeriod.MONTHLY,  # Map legacy periods
        owner_id=data.owner_id,
        project_id=data.project_id,
        tags=data.tags or []
    )

    kpi = await create_kpi(new_data, session, current_user)

    # Convert back to legacy format for response
    return KPIReadLegacy(
        id=kpi.id,
        name=kpi.name,
        description=kpi.description,
        target_value=kpi.target_value,
        current_value=kpi.current_value,
        period=data.period,
        status=data.status,
        created_at=kpi.created_at,
        updated_at=kpi.updated_at
    )
