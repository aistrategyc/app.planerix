"""
Analytics Campaigns Routes - SEM-based campaign analytics.
Legacy dm/dashboards sources were removed in favor of sem views.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_itstep_session
from liderix_api.routes.analytics.sem_helpers import (
    get_view_columns,
    normalize_row,
    pick_first,
    pick_number,
)

router = APIRouter()


@router.get("/performance")
async def get_campaign_performance(
    start_date: date = Query(...),
    end_date: date = Query(...),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    limit: int = Query(50, le=200),
    sort_by: str = Query("spend", description="Sort by: spend, revenue, roas, conversions"),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get campaign performance metrics from sem.campaign_performance."""
    view = "sem.campaign_performance"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "data": [], "total_count": 0, "filters": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat(), "platform": platform, "sort_by": sort_by}}
    date_column = "date_key" if "date_key" in columns else "date"

    filters = []
    params: dict[str, object] = {"limit": limit}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})
    if platform and "platform" in columns:
        filters.append("platform = :platform")
        params["platform"] = platform

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    query = text(f"SELECT * FROM {view} {where_sql} LIMIT :limit")
    rows = (await session.execute(query, params)).mappings().all()

    grouped: dict[tuple[str, Optional[str]], dict[str, object]] = {}
    for raw_row in rows:
        row = normalize_row(raw_row)
        campaign_id = pick_first(row, ["campaign_id", "campaign_key", "campaign"])
        if campaign_id is None:
            continue
        campaign_id = str(campaign_id)
        campaign_name = pick_first(row, ["campaign_name", "campaign_title", "campaign"])
        platform_value = pick_first(row, ["platform", "channel"])
        key = (campaign_id, str(platform_value) if platform_value is not None else None)
        bucket = grouped.setdefault(
            key,
            {
                "campaign_id": campaign_id,
                "campaign_name": campaign_name or campaign_id,
                "platform": platform_value,
                "impressions": 0.0,
                "clicks": 0.0,
                "spend": 0.0,
                "conversions": 0.0,
                "revenue": 0.0,
                "first_seen": None,
                "last_active": None,
                "days_active": set(),
                "cost_share": [],
                "revenue_share": [],
            },
        )

        bucket["impressions"] += pick_number(row, ["impressions", "impr", "impressions_cnt"])
        bucket["clicks"] += pick_number(row, ["clicks", "clicks_cnt"])
        bucket["spend"] += pick_number(row, ["spend", "cost"])
        bucket["conversions"] += pick_number(row, ["conversions", "contracts", "leads"])
        bucket["revenue"] += pick_number(row, ["revenue", "income"])

        cost_share = pick_first(row, ["share_cost_in_platform", "spend_share"])
        if cost_share is not None:
            bucket["cost_share"].append(float(cost_share))
        revenue_share = pick_first(row, ["share_revenue_in_platform", "revenue_share"])
        if revenue_share is not None:
            bucket["revenue_share"].append(float(revenue_share))

        date_value = pick_first(row, [date_column])
        if date_value:
            bucket["days_active"].add(date_value)
            if bucket["first_seen"] is None or date_value < bucket["first_seen"]:
                bucket["first_seen"] = date_value
            if bucket["last_active"] is None or date_value > bucket["last_active"]:
                bucket["last_active"] = date_value

    campaigns = []
    for data in grouped.values():
        impressions = int(data["impressions"])
        clicks = int(data["clicks"])
        spend = float(data["spend"])
        conversions = int(data["conversions"])
        revenue = float(data["revenue"])
        ctr = (clicks / impressions * 100) if impressions else 0.0
        cpc = (spend / clicks) if clicks else 0.0
        cpm = (spend / impressions * 1000) if impressions else 0.0
        roas = (revenue / spend) if spend else 0.0
        campaigns.append(
            {
                "campaign_id": data["campaign_id"],
                "campaign_name": data["campaign_name"],
                "platform": data["platform"],
                "total_metrics": {
                    "impressions": impressions,
                    "clicks": clicks,
                    "spend": spend,
                    "conversions": conversions,
                    "revenue": revenue,
                    "ctr": ctr,
                    "cpc": cpc,
                    "cpm": cpm,
                    "roas": roas,
                },
                "performance": {
                    "days_active": len(data["days_active"]),
                    "first_seen": data["first_seen"],
                    "last_active": data["last_active"],
                    "avg_cost_share": sum(data["cost_share"]) / len(data["cost_share"]) if data["cost_share"] else 0.0,
                    "avg_revenue_share": sum(data["revenue_share"]) / len(data["revenue_share"]) if data["revenue_share"] else 0.0,
                },
            }
        )

    sort_key = {
        "spend": lambda x: x["total_metrics"]["spend"],
        "revenue": lambda x: x["total_metrics"]["revenue"],
        "roas": lambda x: x["total_metrics"]["roas"],
        "conversions": lambda x: x["total_metrics"]["conversions"],
        "ctr": lambda x: x["total_metrics"]["ctr"],
    }.get(sort_by, lambda x: x["total_metrics"]["spend"])
    campaigns = sorted(campaigns, key=sort_key, reverse=True)[:limit]

    return {
        "status": "success",
        "data": campaigns,
        "total_count": len(campaigns),
        "filters": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "platform": platform,
            "sort_by": sort_by,
        },
    }


@router.get("/daily-trend")
async def get_campaign_daily_trend(
    campaign_id: str = Query(..., description="Campaign key"),
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get daily trend for a specific campaign."""
    view = "sem.campaign_performance"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "campaign_id": campaign_id, "data": []}
    date_column = "date_key" if "date_key" in columns else "date"
    campaign_column = "campaign_id" if "campaign_id" in columns else "campaign_key"

    filters = []
    params: dict[str, object] = {"campaign_id": campaign_id}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})
    if campaign_column in columns:
        filters.append(f"{campaign_column} = :campaign_id")

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    query = text(f"SELECT * FROM {view} {where_sql} ORDER BY {date_column} ASC")
    rows = (await session.execute(query, params)).mappings().all()

    daily_data = []
    for raw_row in rows:
        row = normalize_row(raw_row)
        date_value = pick_first(row, [date_column])
        impressions = int(pick_number(row, ["impressions", "impr"]))
        clicks = int(pick_number(row, ["clicks"]))
        spend = pick_number(row, ["spend", "cost"])
        conversions = int(pick_number(row, ["conversions", "contracts", "leads"]))
        revenue = pick_number(row, ["revenue"])
        ctr = (clicks / impressions * 100) if impressions else 0.0
        cpc = (spend / clicks) if clicks else 0.0
        cpm = (spend / impressions * 1000) if impressions else 0.0
        daily_data.append(
            {
                "date": date_value,
                "impressions": impressions,
                "clicks": clicks,
                "spend": spend,
                "conversions": conversions,
                "revenue": revenue,
                "ctr": ctr,
                "cpc": cpc,
                "cpm": cpm,
                "share_cost": pick_number(row, ["share_cost_in_platform", "spend_share"]),
                "share_revenue": pick_number(row, ["share_revenue_in_platform", "revenue_share"]),
            }
        )

    return {"status": "success", "campaign_id": campaign_id, "data": daily_data}


@router.get("/by-products")
async def get_campaigns_by_products(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get campaign performance grouped by products."""
    view = "sem.campaign_performance"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "data": []}
    date_column = "date_key" if "date_key" in columns else "date"
    product_column = "product" if "product" in columns else "product_key"
    if product_column not in columns:
        return {"status": "success", "data": []}

    filters = []
    params: dict[str, object] = {}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    query = text(f"SELECT * FROM {view} {where_sql}")
    rows = (await session.execute(query, params)).mappings().all()

    grouped: dict[tuple[str, Optional[str]], dict[str, object]] = {}
    for raw_row in rows:
        row = normalize_row(raw_row)
        product_value = pick_first(row, [product_column])
        if product_value is None:
            continue
        platform_value = pick_first(row, ["platform", "channel"])
        key = (str(product_value), str(platform_value) if platform_value is not None else None)
        bucket = grouped.setdefault(
            key,
            {
                "product_key": str(product_value),
                "platform": platform_value,
                "total_spend": 0.0,
                "total_conversions": 0.0,
                "total_revenue": 0.0,
                "campaign_count": set(),
            },
        )
        bucket["total_spend"] += pick_number(row, ["spend", "cost"])
        bucket["total_conversions"] += pick_number(row, ["conversions", "contracts", "leads"])
        bucket["total_revenue"] += pick_number(row, ["revenue"])
        campaign_id = pick_first(row, ["campaign_id", "campaign_key"])
        if campaign_id:
            bucket["campaign_count"].add(str(campaign_id))

    data = []
    for bucket in grouped.values():
        spend = bucket["total_spend"]
        revenue = bucket["total_revenue"]
        data.append(
            {
                "product_key": bucket["product_key"],
                "platform": bucket["platform"],
                "total_spend": spend,
                "total_conversions": int(bucket["total_conversions"]),
                "total_revenue": revenue,
                "campaign_count": len(bucket["campaign_count"]),
                "roas": revenue / spend if spend else 0.0,
            }
        )

    return {"status": "success", "data": data}


@router.get("/rolling-performance")
async def get_rolling_performance(
    days: int = Query(7, description="Rolling window in days"),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get rolling performance metrics for campaigns."""
    view = "sem.campaign_performance"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "data": [], "rolling_days": days}
    date_column = "date_key" if "date_key" in columns else "date"
    filters = []
    params: dict[str, object] = {}
    if date_column in columns:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = (await session.execute(text(f"SELECT * FROM {view} {where_sql}"), params)).mappings().all()

    grouped: dict[tuple[str, Optional[str]], dict[str, object]] = {}
    for raw_row in rows:
        row = normalize_row(raw_row)
        campaign_id = pick_first(row, ["campaign_id", "campaign_key"])
        if campaign_id is None:
            continue
        platform_value = pick_first(row, ["platform", "channel"])
        key = (str(campaign_id), str(platform_value) if platform_value is not None else None)
        bucket = grouped.setdefault(
            key,
            {
                "platform": platform_value,
                "campaign_key": str(campaign_id),
                "impressions_7d": 0.0,
                "clicks_7d": 0.0,
                "cost_7d": 0.0,
            },
        )
        bucket["impressions_7d"] += pick_number(row, ["impressions", "impr"])
        bucket["clicks_7d"] += pick_number(row, ["clicks"])
        bucket["cost_7d"] += pick_number(row, ["spend", "cost"])

    data = []
    for bucket in grouped.values():
        impressions = bucket["impressions_7d"]
        clicks = bucket["clicks_7d"]
        cost = bucket["cost_7d"]
        data.append(
            {
                "platform": bucket["platform"],
                "campaign_key": bucket["campaign_key"],
                "impressions_7d": int(impressions),
                "clicks_7d": int(clicks),
                "cost_7d": float(cost),
                "avg_ctr_7d": (clicks / impressions * 100) if impressions else 0.0,
                "avg_cpc_7d": (cost / clicks) if clicks else 0.0,
                "avg_cpm_7d": (cost / impressions * 1000) if impressions else 0.0,
            }
        )

    data = sorted(data, key=lambda x: x["cost_7d"], reverse=True)[:50]
    return {"status": "success", "data": data, "rolling_days": days}


@router.get("/summary")
async def get_campaigns_summary(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get overall campaigns summary statistics."""
    view = "sem.campaign_performance"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "summary": {"total_campaigns": 0, "platforms_count": 0, "total_impressions": 0, "total_clicks": 0, "total_spend": 0.0, "total_conversions": 0, "total_revenue": 0.0, "overall_roas": 0.0, "avg_ctr": 0.0}, "by_platform": []}
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
        platform_value = pick_first(row, ["platform", "channel"])
        key = str(platform_value) if platform_value is not None else "unknown"
        bucket = grouped.setdefault(
            key,
            {
                "platform": platform_value,
                "campaign_count": set(),
                "total_impressions": 0.0,
                "total_clicks": 0.0,
                "total_spend": 0.0,
                "total_conversions": 0.0,
                "total_revenue": 0.0,
            },
        )
        bucket["total_impressions"] += pick_number(row, ["impressions", "impr"])
        bucket["total_clicks"] += pick_number(row, ["clicks"])
        bucket["total_spend"] += pick_number(row, ["spend", "cost"])
        bucket["total_conversions"] += pick_number(row, ["conversions", "contracts", "leads"])
        bucket["total_revenue"] += pick_number(row, ["revenue"])
        campaign_id = pick_first(row, ["campaign_id", "campaign_key"])
        if campaign_id:
            bucket["campaign_count"].add(str(campaign_id))

    total_impressions = sum(bucket["total_impressions"] for bucket in grouped.values())
    total_clicks = sum(bucket["total_clicks"] for bucket in grouped.values())
    total_spend = sum(bucket["total_spend"] for bucket in grouped.values())
    total_conversions = sum(bucket["total_conversions"] for bucket in grouped.values())
    total_revenue = sum(bucket["total_revenue"] for bucket in grouped.values())

    by_platform = []
    for bucket in grouped.values():
        spend = bucket["total_spend"]
        revenue = bucket["total_revenue"]
        by_platform.append(
            {
                "platform": bucket["platform"],
                "campaigns": len(bucket["campaign_count"]),
                "spend": spend,
                "revenue": revenue,
                "roas": revenue / spend if spend else 0.0,
            }
        )

    return {
        "status": "success",
        "summary": {
            "total_campaigns": sum(len(bucket["campaign_count"]) for bucket in grouped.values()),
            "platforms_count": len(grouped),
            "total_impressions": int(total_impressions),
            "total_clicks": int(total_clicks),
            "total_spend": float(total_spend),
            "total_conversions": int(total_conversions),
            "total_revenue": float(total_revenue),
            "overall_roas": total_revenue / total_spend if total_spend else 0.0,
            "avg_ctr": (total_clicks / total_impressions * 100) if total_impressions else 0.0,
        },
        "by_platform": by_platform,
    }


@router.get("/{campaign_id}/creatives")
async def get_campaign_creatives(
    campaign_id: str,
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get all creatives for a specific campaign."""
    view = "sem.creative_performance"
    columns = await get_view_columns(session, view)
    if not columns:
        return {"status": "success", "campaign_id": campaign_id, "creatives": [], "total_creatives": 0}
    date_column = "date_key" if "date_key" in columns else "date"
    campaign_column = "campaign_id" if "campaign_id" in columns else "campaign_key"

    filters = []
    params: dict[str, object] = {"campaign_id": campaign_id}
    if date_column in columns:
        filters.extend([f"{date_column} >= :start_date", f"{date_column} <= :end_date"])
        params.update({"start_date": start_date, "end_date": end_date})
    if campaign_column in columns:
        filters.append(f"{campaign_column} = :campaign_id")

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = (await session.execute(text(f"SELECT * FROM {view} {where_sql}"), params)).mappings().all()

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
                "creative_url": pick_first(row, ["creative_url", "permalink_url", "link_url"]),
                "total_impressions": 0.0,
                "total_clicks": 0.0,
                "total_spend": 0.0,
                "total_conversions": 0.0,
                "total_revenue": 0.0,
                "days_active": set(),
            },
        )
        bucket["total_impressions"] += pick_number(row, ["impressions", "impr"])
        bucket["total_clicks"] += pick_number(row, ["clicks"])
        bucket["total_spend"] += pick_number(row, ["spend", "cost"])
        bucket["total_conversions"] += pick_number(row, ["conversions", "contracts", "leads"])
        bucket["total_revenue"] += pick_number(row, ["revenue"])
        date_value = pick_first(row, [date_column])
        if date_value:
            bucket["days_active"].add(date_value)

    creatives = []
    for bucket in grouped.values():
        spend = bucket["total_spend"]
        revenue = bucket["total_revenue"]
        impressions = bucket["total_impressions"]
        clicks = bucket["total_clicks"]
        creatives.append(
            {
                "creative_id": bucket["creative_id"],
                "creative_name": bucket["creative_name"],
                "creative_url": bucket["creative_url"],
                "metrics": {
                    "impressions": int(impressions),
                    "clicks": int(clicks),
                    "spend": float(spend),
                    "conversions": int(bucket["total_conversions"]),
                    "revenue": float(revenue),
                    "ctr": (clicks / impressions * 100) if impressions else 0.0,
                    "cpc": (spend / clicks) if clicks else 0.0,
                    "roas": (revenue / spend) if spend else 0.0,
                },
                "days_active": len(bucket["days_active"]),
            }
        )

    creatives = sorted(creatives, key=lambda x: x["metrics"]["revenue"], reverse=True)
    return {
        "status": "success",
        "campaign_id": campaign_id,
        "creatives": creatives,
        "total_creatives": len(creatives),
    }
