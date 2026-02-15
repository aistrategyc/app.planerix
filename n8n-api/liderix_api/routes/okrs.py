# apps/api/liderix_api/routes/okrs.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from liderix_api.models.okrs import (
    Objective,
    KeyResult,
    ObjectiveStatus,
    KeyResultSnapshot,
    KeyResultDirection,
    KeyResultProgressRule,
)
from liderix_api.models import MetricDefinition
from liderix_api.schemas.okrs import (
    ObjectiveCreate, ObjectiveUpdate, ObjectiveRead, ObjectiveListResponse,
    KeyResultCreate, KeyResultUpdate, KeyResultRead,
    KeyResultSnapshotListResponse,
    OKRProgressReport, OKRAnalytics
)
from liderix_api.db import get_async_session
from liderix_api.services.auth import get_current_user
from liderix_api.models.users import User
from liderix_api.services.permissions import check_organization_access

router = APIRouter(tags=["OKRs & Objectives"])


def _calculate_kr_progress(kr: KeyResult) -> float:
    """Calculate KR progress percentage using the same logic as the schema."""
    direction = kr.direction or KeyResultDirection.INCREASE
    rule = kr.progress_rule or KeyResultProgressRule.LINEAR

    if rule == KeyResultProgressRule.RATIO:
        if direction == KeyResultDirection.DECREASE:
            if kr.current_value == 0:
                return 100.0 if kr.target_value == 0 else 0.0
            progress = (kr.target_value / kr.current_value) * 100
        else:
            if kr.target_value == 0:
                return 0.0
            progress = (kr.current_value / kr.target_value) * 100
    else:
        if kr.target_value == kr.start_value:
            return 100.0 if kr.current_value >= kr.target_value else 0.0
        if direction == KeyResultDirection.DECREASE:
            progress = ((kr.start_value - kr.current_value) /
                        (kr.start_value - kr.target_value)) * 100
        else:
            progress = ((kr.current_value - kr.start_value) /
                        (kr.target_value - kr.start_value)) * 100

    return max(0.0, min(100.0, progress))


def _build_snapshot(kr: KeyResult, org_id: UUID, snapshot_at: datetime, source: str = "auto") -> KeyResultSnapshot:
    return KeyResultSnapshot(
        id=uuid4(),
        org_id=org_id,
        objective_id=kr.objective_id,
        key_result_id=kr.id,
        metric_def_id=kr.metric_def_id,
        metric_key=kr.metric_key,
        start_value=kr.start_value,
        current_value=kr.current_value,
        target_value=kr.target_value,
        progress_percentage=_calculate_kr_progress(kr),
        direction=kr.direction or KeyResultDirection.INCREASE,
        progress_rule=kr.progress_rule or KeyResultProgressRule.LINEAR,
        snapshot_at=snapshot_at,
        filters_json=kr.filters_json or {},
        data_quality_requirements=kr.data_quality_requirements or {},
        source=source,
    )


async def _ensure_metric_definition(
    session: AsyncSession,
    org_id: UUID,
    metric_def_id: Optional[UUID],
) -> None:
    if not metric_def_id:
        return
    metric = await session.scalar(
        select(MetricDefinition).where(
            and_(
                MetricDefinition.id == metric_def_id,
                MetricDefinition.org_id == org_id,
                MetricDefinition.deleted_at.is_(None),
            )
        )
    )
    if not metric:
        raise HTTPException(status_code=400, detail="Metric definition not found in organization")

# 🔹 Получить все цели организации с пагинацией и фильтрами
@router.get("/objectives", response_model=ObjectiveListResponse)
async def get_objectives(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[ObjectiveStatus] = None,
    search: Optional[str] = None,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    query = select(Objective).options(
        selectinload(Objective.key_results)
    ).where(
        and_(
            Objective.org_id == current_user.org_id,
            Objective.deleted_at.is_(None)
        )
    )

    if status:
        query = query.where(Objective.status == status)

    if search:
        query = query.where(Objective.title.ilike(f"%{search}%"))

    # Подсчет общего количества
    count_query = select(func.count(Objective.id)).where(
        and_(
            Objective.org_id == current_user.org_id,
            Objective.deleted_at.is_(None)
        )
    )
    if status:
        count_query = count_query.where(Objective.status == status)
    if search:
        count_query = count_query.where(Objective.title.ilike(f"%{search}%"))

    total = await session.scalar(count_query)

    # Получение данных с пагинацией
    query = query.order_by(desc(Objective.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    objectives = result.scalars().all()

    return ObjectiveListResponse(
        items=objectives,
        total=total,
        page=page,
        page_size=page_size
    )

# 🔹 Получить одну цель по ID
@router.get("/objectives/{objective_id}", response_model=ObjectiveRead)
async def get_objective(
    objective_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    result = await session.execute(
        select(Objective).options(
            selectinload(Objective.key_results)
        ).where(
            and_(
                Objective.id == objective_id,
                Objective.org_id == current_user.org_id,
                Objective.deleted_at.is_(None)
            )
        )
    )
    objective = result.scalar_one_or_none()
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")
    return objective

# 🔹 Создать новую цель с ключевыми результатами
@router.post("/objectives", response_model=ObjectiveRead)
async def create_objective(
    data: ObjectiveCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    # Создание цели
    objective_data = data.model_dump(exclude={'key_results'})
    if not objective_data.get("owner_id"):
        objective_data["owner_id"] = current_user.id
    new_objective = Objective(
        **objective_data,
        org_id=current_user.org_id,
        created_at=datetime.now(timezone.utc)
    )
    session.add(new_objective)
    await session.flush()  # Получаем ID цели

    # Создание ключевых результатов
    if data.key_results:
        snapshots: List[KeyResultSnapshot] = []
        for kr_data in data.key_results:
            kr_payload = kr_data.model_dump()
            await _ensure_metric_definition(session, current_user.org_id, kr_payload.get("metric_def_id"))
            if not kr_payload.get("owner_id"):
                kr_payload["owner_id"] = objective_data.get("owner_id")
            key_result = KeyResult(
                id=uuid4(),
                **kr_payload,
                objective_id=new_objective.id,
                created_at=datetime.now(timezone.utc)
            )
            session.add(key_result)
            snapshots.append(_build_snapshot(key_result, current_user.org_id, datetime.now(timezone.utc)))
        if snapshots:
            session.add_all(snapshots)

    await session.commit()
    await session.refresh(new_objective)
    return new_objective

# 🔹 Обновить цель
@router.put("/objectives/{objective_id}", response_model=ObjectiveRead)
async def update_objective(
    objective_id: UUID,
    data: ObjectiveUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    result = await session.execute(
        select(Objective).options(
            selectinload(Objective.key_results)
        ).where(
            and_(
                Objective.id == objective_id,
                Objective.org_id == current_user.org_id,
                Objective.deleted_at.is_(None)
            )
        )
    )
    objective = result.scalar_one_or_none()
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")

    # Обновление полей
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(objective, field, value)
    objective.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(objective)
    return objective

# 🔹 Мягкое удаление цели
@router.delete("/objectives/{objective_id}")
async def delete_objective(
    objective_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    result = await session.execute(
        select(Objective).where(
            and_(
                Objective.id == objective_id,
                Objective.org_id == current_user.org_id,
                Objective.deleted_at.is_(None)
            )
        )
    )
    objective = result.scalar_one_or_none()
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")

    # Мягкое удаление
    objective.deleted_at = datetime.now(timezone.utc)
    await session.commit()

    return {"detail": "Objective deleted successfully"}


# ==================== KEY RESULTS MANAGEMENT ====================

@router.get("/objectives/{objective_id}/snapshots", response_model=KeyResultSnapshotListResponse)
async def list_objective_snapshots(
    objective_id: UUID,
    latest_only: bool = Query(True, description="Return only latest snapshot per key result"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    await check_organization_access(session, current_user.org_id, current_user)

    objective = await session.scalar(
        select(Objective).where(
            and_(
                Objective.id == objective_id,
                Objective.org_id == current_user.org_id,
                Objective.deleted_at.is_(None),
            )
        )
    )
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")

    if latest_only:
        latest_subq = (
            select(
                KeyResultSnapshot.key_result_id,
                func.max(KeyResultSnapshot.snapshot_at).label("latest_at"),
            )
            .where(
                and_(
                    KeyResultSnapshot.objective_id == objective_id,
                    KeyResultSnapshot.org_id == current_user.org_id,
                )
            )
            .group_by(KeyResultSnapshot.key_result_id)
            .subquery()
        )
        stmt = (
            select(KeyResultSnapshot)
            .join(
                latest_subq,
                and_(
                    KeyResultSnapshot.key_result_id == latest_subq.c.key_result_id,
                    KeyResultSnapshot.snapshot_at == latest_subq.c.latest_at,
                ),
            )
            .order_by(KeyResultSnapshot.snapshot_at.desc())
        )
    else:
        stmt = (
            select(KeyResultSnapshot)
            .where(
                and_(
                    KeyResultSnapshot.objective_id == objective_id,
                    KeyResultSnapshot.org_id == current_user.org_id,
                )
            )
            .order_by(KeyResultSnapshot.snapshot_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

    items = (await session.execute(stmt)).scalars().all()
    total = len(items) if latest_only else (
        await session.scalar(
            select(func.count(KeyResultSnapshot.id)).where(
                and_(
                    KeyResultSnapshot.objective_id == objective_id,
                    KeyResultSnapshot.org_id == current_user.org_id,
                )
            )
        ) or 0
    )

    return KeyResultSnapshotListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/key-results/{key_result_id}/snapshots", response_model=KeyResultSnapshotListResponse)
async def list_key_result_snapshots(
    key_result_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    await check_organization_access(session, current_user.org_id, current_user)

    kr = await session.scalar(
        select(KeyResult).join(Objective).where(
            and_(
                KeyResult.id == key_result_id,
                Objective.org_id == current_user.org_id,
                KeyResult.deleted_at.is_(None),
                Objective.deleted_at.is_(None),
            )
        )
    )
    if not kr:
        raise HTTPException(status_code=404, detail="Key result not found")

    total = await session.scalar(
        select(func.count(KeyResultSnapshot.id)).where(
            and_(
                KeyResultSnapshot.key_result_id == key_result_id,
                KeyResultSnapshot.org_id == current_user.org_id,
            )
        )
    ) or 0

    items = (await session.execute(
        select(KeyResultSnapshot)
        .where(
            and_(
                KeyResultSnapshot.key_result_id == key_result_id,
                KeyResultSnapshot.org_id == current_user.org_id,
            )
        )
        .order_by(KeyResultSnapshot.snapshot_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return KeyResultSnapshotListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/snapshots/refresh", response_model=Dict[str, int])
async def refresh_okr_snapshots(
    objective_id: Optional[UUID] = Query(None, description="Refresh only for this objective"),
    min_interval_hours: int = Query(12, ge=1, le=168, description="Skip snapshots newer than N hours"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    await check_organization_access(session, current_user.org_id, current_user)

    kr_stmt = (
        select(KeyResult)
        .join(Objective)
        .where(
            and_(
                Objective.org_id == current_user.org_id,
                Objective.deleted_at.is_(None),
                KeyResult.deleted_at.is_(None),
            )
        )
    )
    if objective_id:
        kr_stmt = kr_stmt.where(Objective.id == objective_id)

    key_results = (await session.execute(kr_stmt)).scalars().all()
    if not key_results:
        return {"created": 0, "skipped": 0}

    kr_ids = [kr.id for kr in key_results]
    latest_rows = await session.execute(
        select(
            KeyResultSnapshot.key_result_id,
            func.max(KeyResultSnapshot.snapshot_at).label("latest_at"),
        )
        .where(
            and_(
                KeyResultSnapshot.org_id == current_user.org_id,
                KeyResultSnapshot.key_result_id.in_(kr_ids),
            )
        )
        .group_by(KeyResultSnapshot.key_result_id)
    )
    latest_by_id = {row[0]: row[1] for row in latest_rows}

    now = datetime.now(timezone.utc)
    created = 0
    skipped = 0
    for kr in key_results:
        latest_at = latest_by_id.get(kr.id)
        if latest_at and (now - latest_at).total_seconds() < min_interval_hours * 3600:
            skipped += 1
            continue
        session.add(_build_snapshot(kr, current_user.org_id, now))
        created += 1

    if created:
        await session.commit()

    return {"created": created, "skipped": skipped}

# 🔹 Получить ключевые результаты цели
@router.get("/objectives/{objective_id}/key-results", response_model=List[KeyResultRead])
async def get_objective_key_results(
    objective_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    # Проверяем существование цели
    objective = await session.execute(
        select(Objective).where(
            and_(
                Objective.id == objective_id,
                Objective.org_id == current_user.org_id,
                Objective.deleted_at.is_(None)
            )
        )
    )
    if not objective.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Objective not found")

    # Получаем ключевые результаты
    result = await session.execute(
        select(KeyResult).where(
            and_(
                KeyResult.objective_id == objective_id,
                KeyResult.deleted_at.is_(None)
            )
        ).order_by(KeyResult.created_at)
    )
    return result.scalars().all()

# 🔹 Создать ключевой результат
@router.post("/objectives/{objective_id}/key-results", response_model=KeyResultRead)
async def create_key_result(
    objective_id: UUID,
    data: KeyResultCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    # Проверяем существование цели
    objective_result = await session.execute(
        select(Objective).where(
            and_(
                Objective.id == objective_id,
                Objective.org_id == current_user.org_id,
                Objective.deleted_at.is_(None)
            )
        )
    )
    objective = objective_result.scalar_one_or_none()
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")

    # Создаем ключевой результат
    payload = data.model_dump()
    await _ensure_metric_definition(session, current_user.org_id, payload.get("metric_def_id"))
    if not payload.get("owner_id"):
        payload["owner_id"] = objective.owner_id
    new_key_result = KeyResult(
        id=uuid4(),
        **payload,
        objective_id=objective_id,
        created_at=datetime.now(timezone.utc)
    )
    session.add(new_key_result)
    session.add(_build_snapshot(new_key_result, current_user.org_id, datetime.now(timezone.utc)))
    await session.commit()
    await session.refresh(new_key_result)
    return new_key_result

# 🔹 Обновить ключевой результат
@router.put("/key-results/{key_result_id}", response_model=KeyResultRead)
async def update_key_result(
    key_result_id: UUID,
    data: KeyResultUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    # Получаем ключевой результат и проверяем доступ через цель
    result = await session.execute(
        select(KeyResult).join(Objective).where(
            and_(
                KeyResult.id == key_result_id,
                Objective.org_id == current_user.org_id,
                KeyResult.deleted_at.is_(None),
                Objective.deleted_at.is_(None)
            )
        )
    )
    key_result = result.scalar_one_or_none()
    if not key_result:
        raise HTTPException(status_code=404, detail="Key result not found")

    # Обновляем поля
    payload = data.model_dump(exclude_unset=True)
    await _ensure_metric_definition(session, current_user.org_id, payload.get("metric_def_id"))
    for field, value in payload.items():
        setattr(key_result, field, value)
    key_result.updated_at = datetime.now(timezone.utc)

    session.add(_build_snapshot(key_result, current_user.org_id, datetime.now(timezone.utc)))
    await session.commit()
    await session.refresh(key_result)
    return key_result

# 🔹 Удалить ключевой результат
@router.delete("/key-results/{key_result_id}")
async def delete_key_result(
    key_result_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    # Получаем ключевой результат и проверяем доступ через цель
    result = await session.execute(
        select(KeyResult).join(Objective).where(
            and_(
                KeyResult.id == key_result_id,
                Objective.org_id == current_user.org_id,
                KeyResult.deleted_at.is_(None),
                Objective.deleted_at.is_(None)
            )
        )
    )
    key_result = result.scalar_one_or_none()
    if not key_result:
        raise HTTPException(status_code=404, detail="Key result not found")

    # Мягкое удаление
    key_result.deleted_at = datetime.now(timezone.utc)
    await session.commit()

    return {"detail": "Key result deleted successfully"}

# ==================== ADVANCED OKR FEATURES ====================

# 🔹 Получить прогресс по всем целям организации
@router.get("/progress-report", response_model=OKRProgressReport)
async def get_progress_report(
    start_date: Optional[datetime] = Query(None, description="Start date for report"),
    end_date: Optional[datetime] = Query(None, description="End date for report"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    # Устанавливаем даты по умолчанию (последние 30 дней)
    if not end_date:
        end_date = datetime.now(timezone.utc)
    if not start_date:
        start_date = end_date - timedelta(days=30)

    # Получаем все цели за период
    query = select(Objective).options(
        selectinload(Objective.key_results)
    ).where(
        and_(
            Objective.org_id == current_user.org_id,
            Objective.deleted_at.is_(None),
            Objective.created_at.between(start_date, end_date)
        )
    )
    result = await session.execute(query)
    objectives = result.scalars().all()

    # Подсчитываем статистику
    total_objectives = len(objectives)
    active_objectives = sum(1 for obj in objectives if obj.status == ObjectiveStatus.ACTIVE)
    completed_objectives = sum(1 for obj in objectives if obj.status == ObjectiveStatus.COMPLETED)

    # Просроченные цели
    overdue_objectives = sum(1 for obj in objectives
                           if obj.due_date and obj.due_date < datetime.now(timezone.utc)
                           and obj.status != ObjectiveStatus.COMPLETED)

    # Средний прогресс (вычисляется через схемы)
    if objectives:
        # Создаем ObjectiveRead для вычисления прогресса
        objective_reads = [ObjectiveRead.model_validate(obj) for obj in objectives]
        average_progress = sum(obj_read.overall_progress for obj_read in objective_reads) / len(objective_reads)
    else:
        average_progress = 0.0

    # Процент завершения
    completion_rate = (completed_objectives / total_objectives * 100) if total_objectives > 0 else 0

    # Группировка по статусам
    objectives_by_status = {}
    for status in ObjectiveStatus:
        objectives_by_status[status.value] = sum(1 for obj in objectives if obj.status == status)

    # Топ исполнители и риски
    objective_reads = [ObjectiveRead.model_validate(obj) for obj in objectives]
    top_performers = sorted(objective_reads, key=lambda x: x.overall_progress, reverse=True)[:10]
    at_risk_objectives = [obj for obj in objective_reads if obj.is_overdue or obj.overall_progress < 25.0][:10]

    return OKRProgressReport(
        organization_id=current_user.org_id,
        period_start=start_date,
        period_end=end_date,
        total_objectives=total_objectives,
        active_objectives=active_objectives,
        completed_objectives=completed_objectives,
        overdue_objectives=overdue_objectives,
        average_progress=average_progress,
        completion_rate=completion_rate,
        objectives_by_status=objectives_by_status,
        top_performers=top_performers,
        at_risk_objectives=at_risk_objectives
    )

# 🔹 Получить аналитику OKR
@router.get("/analytics", response_model=OKRAnalytics)
async def get_okr_analytics(
    months_back: int = Query(6, ge=1, le=24, description="Number of months to analyze"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    start_date = datetime.now(timezone.utc) - timedelta(days=30 * months_back)

    # Получаем все цели за период
    query = select(Objective).options(
        selectinload(Objective.key_results)
    ).where(
        and_(
            Objective.org_id == current_user.org_id,
            Objective.deleted_at.is_(None),
            Objective.created_at >= start_date
        )
    )
    result = await session.execute(query)
    objectives = result.scalars().all()

    # Общая статистика
    total_objectives = len(objectives)
    objectives_by_status = {}
    for status in ObjectiveStatus:
        objectives_by_status[status.value] = sum(1 for obj in objectives if obj.status == status)

    # Средний процент завершения
    if objectives:
        objective_reads = [ObjectiveRead.model_validate(obj) for obj in objectives]
        average_completion_rate = sum(obj_read.overall_progress for obj_read in objective_reads) / len(objective_reads)
    else:
        average_completion_rate = 0.0

    # Статистика ключевых результатов
    all_key_results = [kr for obj in objectives for kr in obj.key_results if not kr.deleted_at]
    key_results_stats = {
        "total": len(all_key_results),
        "completed": sum(1 for kr in all_key_results if kr.current_value >= kr.target_value),
        "average_progress": sum((kr.current_value - kr.start_value) /
                               (kr.target_value - kr.start_value) * 100
                               if kr.target_value != kr.start_value else 0
                               for kr in all_key_results) / len(all_key_results) if all_key_results else 0
    }

    # Месячные тренды (упрощенная версия)
    monthly_trends = []
    for i in range(months_back):
        month_start = datetime.now(timezone.utc) - timedelta(days=30 * (i + 1))
        month_end = datetime.now(timezone.utc) - timedelta(days=30 * i)
        month_objectives = [obj for obj in objectives if month_start <= obj.created_at < month_end]
        monthly_trends.append({
            "month": month_start.strftime("%Y-%m"),
            "objectives_created": len(month_objectives),
            "objectives_completed": sum(1 for obj in month_objectives if obj.status == ObjectiveStatus.COMPLETED)
        })

    # Инсайты
    performance_insights = []
    if completion_rate := (objectives_by_status.get('completed', 0) / total_objectives * 100) if total_objectives > 0 else 0:
        if completion_rate > 80:
            performance_insights.append("🎯 Отличная производительность! Большинство целей достигается.")
        elif completion_rate > 60:
            performance_insights.append("📈 Хорошая производительность, есть возможности для улучшения.")
        else:
            performance_insights.append("⚠️ Низкая производительность. Стоит пересмотреть стратегию.")

    if objectives_by_status.get('active', 0) > objectives_by_status.get('completed', 0) * 2:
        performance_insights.append("📋 Много активных целей. Рассмотрите фокусировку на приоритетных.")

    return OKRAnalytics(
        total_objectives=total_objectives,
        objectives_by_status=objectives_by_status,
        average_completion_rate=average_completion_rate,
        key_results_stats=key_results_stats,
        monthly_trends=monthly_trends,
        performance_insights=performance_insights
    )

# 🔹 Массовое обновление статуса целей
@router.patch("/objectives/batch-update-status")
async def batch_update_objectives_status(
    objective_ids: List[UUID],
    new_status: ObjectiveStatus,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    await check_organization_access(session, current_user.org_id, current_user)

    if len(objective_ids) > 100:
        raise HTTPException(status_code=400, detail="Cannot update more than 100 objectives at once")

    # Проверяем, что все цели принадлежат организации пользователя
    result = await session.execute(
        select(Objective).where(
            and_(
                Objective.id.in_(objective_ids),
                Objective.org_id == current_user.org_id,
                Objective.deleted_at.is_(None)
            )
        )
    )
    objectives = result.scalars().all()

    if len(objectives) != len(objective_ids):
        raise HTTPException(status_code=404, detail="Some objectives not found or access denied")

    # Обновляем статус
    updated_count = 0
    for objective in objectives:
        objective.status = new_status
        objective.updated_at = datetime.now(timezone.utc)
        updated_count += 1

    await session.commit()

    return {
        "detail": f"Updated status for {updated_count} objectives",
        "updated_count": updated_count,
        "new_status": new_status.value
    }

# ==================== LEGACY COMPATIBILITY ROUTES ====================

# Поддержка старых роутов для обратной совместимости
@router.get("/", response_model=list[ObjectiveRead])
async def get_okrs_legacy(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Legacy route - redirects to new objectives endpoint"""
    return await get_objectives(session=session, current_user=current_user)

@router.get("/{okr_id}", response_model=ObjectiveRead)
async def get_okr_legacy(
    okr_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """Legacy route - redirects to new objective endpoint"""
    return await get_objective(okr_id, session, current_user)
