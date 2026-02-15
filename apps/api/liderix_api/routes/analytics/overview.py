"""
Analytics Overview Routes - SEM-based dashboard endpoints.
Legacy dm/dashboards sources were removed in favor of sem views.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
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
from liderix_api.schemas.analytics import (
    DashboardOverview,
    DateRangeFilter,
    RealTimeMetrics,
    PlatformPerformance,
    MetricBase,
)

router = APIRouter(deprecated=True, dependencies=[Depends(mark_legacy_deprecated)])


async def _sum_metrics(
    session: AsyncSession,
    view: str,
    start_date: date,
    end_date: date,
) -> dict[str, object]:
    columns = await get_view_columns(session, view)
    if not columns:
        return {
            "impressions": 0.0,
            "clicks": 0.0,
            "spend": 0.0,
            "conversions": 0.0,
            "revenue": 0.0,
            "leads": 0.0,
            "campaigns": set(),
            "creatives": set(),
        }
    date_column = "date_key" if "date_key" in columns else "date"
    filters = []
    params: dict[str, object] = {}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = (await session.execute(text(f"SELECT * FROM {view} {where_sql}"), params)).mappings().all()

    totals = {
        "impressions": 0.0,
        "clicks": 0.0,
        "spend": 0.0,
        "conversions": 0.0,
        "revenue": 0.0,
        "leads": 0.0,
        "campaigns": set(),
        "creatives": set(),
    }
    for raw_row in rows:
        row = normalize_row(raw_row)
        totals["impressions"] += pick_number(row, ["impressions", "impr"])
        totals["clicks"] += pick_number(row, ["clicks"])
        totals["spend"] += pick_number(row, ["spend", "cost"])
        totals["conversions"] += pick_number(row, ["conversions", "contracts", "paid_contracts"])
        totals["revenue"] += pick_number(row, ["revenue", "income"])
        totals["leads"] += pick_number(row, ["leads", "leads_cnt", "requests", "requests_cnt"])

        campaign_id = pick_first(row, ["campaign_id", "campaign_key"])
        if campaign_id is not None:
            totals["campaigns"].add(str(campaign_id))
        creative_id = pick_first(row, ["creative_id", "ad_id", "creative_key"])
        if creative_id is not None:
            totals["creatives"].add(str(creative_id))

    return totals


@router.get("/dashboard", response_model=DashboardOverview)
async def get_dashboard_overview(
    start_date: date = Query(..., description="Start date for analytics"),
    end_date: date = Query(..., description="End date for analytics"),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get main dashboard overview with key metrics from SEM views."""
    try:
        campaign_totals = await _sum_metrics(session, "sem.campaign_performance", start_date, end_date)
        creative_totals = await _sum_metrics(session, "sem.creative_performance", start_date, end_date)
        funnel_totals = await _sum_metrics(session, "sem.crm_funnel_daily", start_date, end_date)

        total_spend = float(campaign_totals["spend"])
        total_revenue = float(campaign_totals["revenue"])
        total_conversions = int(campaign_totals["conversions"])
        total_leads = int(funnel_totals["leads"])
        active_campaigns = len(campaign_totals["campaigns"])
        active_creatives = len(creative_totals["creatives"])

        roas = total_revenue / total_spend if total_spend > 0 else 0.0
        conversion_rate = (total_conversions / total_leads * 100) if total_leads > 0 else 0.0

        period_days = (end_date - start_date).days or 1
        prev_start = start_date - timedelta(days=period_days)
        prev_end = start_date - timedelta(days=1)
        prev_totals = await _sum_metrics(session, "sem.campaign_performance", prev_start, prev_end)
        prev_spend = float(prev_totals["spend"]) or 0.0
        prev_revenue = float(prev_totals["revenue"]) or 0.0
        prev_roas = (prev_revenue / prev_spend) if prev_spend > 0 else 0.0

        spend_trend = ((total_spend - prev_spend) / prev_spend * 100) if prev_spend > 0 else 0.0
        revenue_trend = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0.0
        roas_trend = ((roas - prev_roas) / prev_roas * 100) if prev_roas > 0 else 0.0

        return DashboardOverview(
            date_range=DateRangeFilter(start_date=start_date, end_date=end_date),
            total_spend=total_spend,
            total_revenue=total_revenue,
            total_conversions=total_conversions,
            total_leads=total_leads,
            roas=roas,
            conversion_rate=conversion_rate,
            active_campaigns=active_campaigns,
            active_creatives=active_creatives,
            spend_trend=spend_trend,
            revenue_trend=revenue_trend,
            roas_trend=roas_trend,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc


@router.get("/realtime", response_model=RealTimeMetrics)
async def get_realtime_metrics(
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get realtime metrics based on the latest SEM dates."""
    try:
        columns = await get_view_columns(session, "sem.campaign_performance")
        date_column = "date_key" if "date_key" in columns else "date"
        latest_date = await session.scalar(text(f"SELECT max({date_column}) FROM sem.campaign_performance"))
        latest_date = latest_date or date.today()

        totals = await _sum_metrics(session, "sem.campaign_performance", latest_date, latest_date)
        funnel_totals = await _sum_metrics(session, "sem.crm_funnel_daily", latest_date, latest_date)

        top_creative_query = text(
            """
            SELECT *
            FROM sem.creative_performance
            ORDER BY revenue DESC NULLS LAST, conversions DESC NULLS LAST
            LIMIT 1
            """
        )
        top_row = (await session.execute(top_creative_query)).mappings().first()
        top_creative = None
        if top_row:
            row = normalize_row(top_row)
            top_creative = pick_first(row, ["creative_name", "creative_title", "ad_name", "creative_id"])

        return RealTimeMetrics(
            active_sessions=0,
            new_leads_today=int(funnel_totals["leads"]),
            revenue_today=float(totals["revenue"]),
            conversions_today=int(totals["conversions"]),
            top_performing_creative=str(top_creative) if top_creative is not None else None,
            alerts=[],
            last_updated=datetime.now(),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc


@router.get("/platforms", response_model=List[PlatformPerformance])
async def get_platform_performance(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get performance by platform using SEM campaign performance."""
    view = "sem.campaign_performance"
    columns = await get_view_columns(session, view)
    date_column = "date_key" if "date_key" in columns else "date"
    filters = []
    params: dict[str, object] = {}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = (await session.execute(text(f"SELECT * FROM {view} {where_sql}"), params)).mappings().all()

    grouped: dict[str, dict[str, object]] = {}
    for raw_row in rows:
        row = normalize_row(raw_row)
        platform_value = pick_first(row, ["platform", "channel"]) or "unknown"
        bucket = grouped.setdefault(
            str(platform_value),
            {
                "platform": platform_value,
                "campaigns": set(),
                "creatives": set(),
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
        campaign_id = pick_first(row, ["campaign_id", "campaign_key"])
        if campaign_id is not None:
            bucket["campaigns"].add(str(campaign_id))
        creative_id = pick_first(row, ["creative_id", "ad_id", "creative_key"])
        if creative_id is not None:
            bucket["creatives"].add(str(creative_id))

    total_spend = sum(bucket["spend"] for bucket in grouped.values())
    total_revenue = sum(bucket["revenue"] for bucket in grouped.values())
    performance = []
    for bucket in grouped.values():
        impressions = int(bucket["impressions"])
        clicks = int(bucket["clicks"])
        spend = float(bucket["spend"])
        conversions = int(bucket["conversions"])
        revenue = float(bucket["revenue"])
        metrics = MetricBase(
            impressions=impressions,
            clicks=clicks,
            spend=spend,
            conversions=conversions,
            revenue=revenue,
        )
        share_of_spend = (spend / total_spend) if total_spend else 0.0
        share_of_revenue = (revenue / total_revenue) if total_revenue else 0.0
        performance_score = metrics.roas * 10 if metrics.roas else 0.0
        performance.append(
            PlatformPerformance(
                platform=bucket["platform"],
                campaigns_count=len(bucket["campaigns"]),
                creatives_count=len(bucket["creatives"]),
                metrics=metrics,
                share_of_spend=share_of_spend,
                share_of_revenue=share_of_revenue,
                performance_score=performance_score,
            )
        )

    return performance


@router.get("/kpis")
async def get_kpis(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Return KPI cards from sem.commercial_kpi_cards."""
    view = "sem.commercial_kpi_cards"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"items": []}

    date_column = "date_key" if "date_key" in columns else "date"
    filters = []
    params: dict[str, object] = {}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = (await session.execute(text(f"SELECT * FROM {view} {where_sql}"), params)).mappings().all()
    return {"items": [normalize_row(row) for row in rows]}
