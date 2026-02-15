"""
Analytics Creatives Routes - SEM-based creative analytics.
Legacy dm/dashboards sources were removed in favor of sem views.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_itstep_session
from liderix_api.routes.analytics.deprecation import mark_legacy_deprecated
from liderix_api.routes.analytics.sem_helpers import (
    get_view_columns,
    normalize_row,
    pick_first,
    pick_number,
)

router = APIRouter(deprecated=True, dependencies=[Depends(mark_legacy_deprecated)])


@router.get("/performance")
async def get_creative_performance(
    start_date: date = Query(...),
    end_date: date = Query(...),
    limit: int = Query(50, le=200),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get top performing creatives with metrics."""
    view = "sem.creative_performance"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "data": [], "total_count": 0}
    date_column = "date_key" if "date_key" in columns else "date"

    filters = []
    params: dict[str, object] = {"limit": limit}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    query = text(f"SELECT * FROM {view} {where_sql} LIMIT :limit")
    rows = (await session.execute(query, params)).mappings().all()

    grouped: dict[str, dict[str, object]] = {}
    for raw_row in rows:
        row = normalize_row(raw_row)
        creative_id = pick_first(row, ["creative_id", "ad_id", "creative_key"])
        if creative_id is None:
            continue
        creative_id = str(creative_id)
        bucket = grouped.setdefault(
            creative_id,
            {
                "creative_id": creative_id,
                "creative_name": pick_first(row, ["creative_name", "creative_title", "ad_name"]) or f"Creative {creative_id}",
                "campaign_key": pick_first(row, ["campaign_id", "campaign_key"]),
                "creative_url": pick_first(row, ["creative_url", "permalink_url", "link_url"]),
                "impressions": 0.0,
                "clicks": 0.0,
                "spend": 0.0,
                "conversions": 0.0,
                "revenue": 0.0,
            },
        )
        bucket["impressions"] += pick_number(row, ["impressions", "impr"])
        bucket["clicks"] += pick_number(row, ["clicks"])
        bucket["spend"] += pick_number(row, ["spend", "cost"])
        bucket["conversions"] += pick_number(row, ["conversions", "contracts", "leads"])
        bucket["revenue"] += pick_number(row, ["revenue"])

    creatives = []
    for bucket in grouped.values():
        impressions = int(bucket["impressions"])
        clicks = int(bucket["clicks"])
        spend = float(bucket["spend"])
        conversions = int(bucket["conversions"])
        revenue = float(bucket["revenue"])
        ctr = (clicks / impressions * 100) if impressions else 0.0
        cpc = (spend / clicks) if clicks else 0.0
        cpm = (spend / impressions * 1000) if impressions else 0.0
        roas = (revenue / spend) if spend else 0.0
        cvr = (conversions / clicks * 100) if clicks else 0.0
        creatives.append(
            {
                "creative_id": bucket["creative_id"],
                "creative_name": bucket["creative_name"],
                "campaign_key": bucket["campaign_key"],
                "impressions": impressions,
                "clicks": clicks,
                "spend": spend,
                "conversions": conversions,
                "revenue": revenue,
                "ctr": ctr,
                "cpc": cpc,
                "cpm": cpm,
                "roas": roas,
                "cvr": cvr,
                "creative_url": bucket["creative_url"],
            }
        )

    creatives = sorted(creatives, key=lambda x: x["revenue"], reverse=True)[:limit]
    return {"status": "success", "data": creatives, "total_count": len(creatives)}


@router.get("/burnout-analysis")
async def get_creative_burnout_analysis(
    days_back: int = Query(30, description="Days to analyze"),
    min_days_active: int = Query(7, description="Minimum days active to include"),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Analyze creative burnout based on SEM fatigue signals."""
    view = "sem.meta_creative_fatigue_7d"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "data": []}

    rows = (await session.execute(text(f"SELECT * FROM {view}"))).mappings().all()
    results = []
    for raw_row in rows:
        row = normalize_row(raw_row)
        creative_id = pick_first(row, ["creative_id", "ad_id", "creative_key"])
        if creative_id is None:
            continue
        creative_name = pick_first(row, ["creative_name", "creative_title", "ad_name"]) or f"Creative {creative_id}"
        days_active = int(pick_number(row, ["days_active", "active_days"], default=float(min_days_active)))
        initial_ctr = pick_number(row, ["ctr_prev7d", "ctr_prev", "ctr_baseline"])
        current_ctr = pick_number(row, ["ctr_7d", "ctr_recent", "ctr_current"])
        burnout_score = pick_number(row, ["fatigue_score", "burnout_score", "ctr_delta_pct"])
        status = "fresh"
        if burnout_score > 70:
            status = "burned_out"
        elif burnout_score > 30:
            status = "declining"
        results.append(
            {
                "creative_id": str(creative_id),
                "creative_name": creative_name,
                "days_active": days_active,
                "initial_ctr": initial_ctr,
                "current_ctr": current_ctr,
                "burnout_score": burnout_score,
                "status": status,
            }
        )

    results = sorted(results, key=lambda x: x["burnout_score"], reverse=True)
    return {"status": "success", "data": results}


@router.get("/top-performers")
async def get_top_creatives(
    start_date: date = Query(...),
    end_date: date = Query(...),
    metric: str = Query("revenue", description="Metric: revenue, conversions, roas, ctr"),
    limit: int = Query(10, le=50),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get top performing creatives by metric."""
    response = await get_creative_performance(start_date, end_date, limit=limit * 2, session=session)
    data = response.get("data", [])
    sort_key = {
        "conversions": lambda x: x["conversions"],
        "roas": lambda x: x["roas"],
        "ctr": lambda x: x["ctr"],
    }.get(metric, lambda x: x["revenue"])
    data = sorted(data, key=sort_key, reverse=True)[:limit]
    return {"status": "success", "metric": metric, "data": data}


@router.get("/themes-analysis")
async def get_creative_themes(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get creative type/theme breakdown from sem.creative_type_summary."""
    view = "sem.creative_type_summary"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "data": []}

    date_column = "date_key" if "date_key" in columns else "date"
    filters = []
    params: dict[str, object] = {}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = (await session.execute(text(f"SELECT * FROM {view} {where_sql}"), params)).mappings().all()
    data = [normalize_row(row) for row in rows]
    return {"status": "success", "data": data}


@router.get("/{creative_id}/details")
async def get_creative_details(
    creative_id: str,
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get detailed creative performance."""
    view = "sem.creative_performance"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "creative_id": creative_id, "data": []}
    date_column = "date_key" if "date_key" in columns else "date"
    creative_column = "creative_id" if "creative_id" in columns else "creative_key"

    filters = []
    params: dict[str, object] = {"creative_id": creative_id}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})
    if creative_column in columns:
        filters.append(f"{creative_column} = :creative_id")

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = (await session.execute(text(f"SELECT * FROM {view} {where_sql}"), params)).mappings().all()
    data = [normalize_row(row) for row in rows]
    return {"status": "success", "creative_id": creative_id, "data": data}
