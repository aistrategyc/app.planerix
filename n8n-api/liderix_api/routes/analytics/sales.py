"""
Sales Analytics endpoints - SEM-based data for ITstep.
Legacy dashboards sources were removed in favor of sem views.
"""
from __future__ import annotations

from datetime import date
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

router = APIRouter(tags=["Sales Analytics"])

FIRST_SUM_KEYS = [
    "first_sum",
    "first_payment",
    "first_payment_sum",
    "first_sum_total",
    "total_first_sum",
]

PRODUCT_VIEW_CANDIDATES = [
    "sem_ui.contract_product_attribution_daily_city",
    "sem.campaign_performance",
]


async def _select_rows(
    session: AsyncSession,
    view: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    date_column: str = "date_key",
    extra_filters: Optional[list[str]] = None,
    params: Optional[dict[str, object]] = None,
):
    columns = await get_view_columns(session, view)
    if not columns:
        return []
    resolved_date_column = date_column if date_column in columns else ("date" if "date" in columns else None)
    filters: list[str] = []
    params = params or {}
    if resolved_date_column and date_from and date_to:
        filters.extend([f"{resolved_date_column} >= :date_from", f"{resolved_date_column} <= :date_to"])
        params.update({"date_from": date_from, "date_to": date_to})
    if extra_filters:
        filters.extend(extra_filters)
    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    query = text(f"SELECT * FROM {view} {where_sql}")
    return (await session.execute(query, params)).mappings().all()


@router.get("/revenue-trend")
async def get_revenue_trend(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Return daily revenue/contract trend based on SEM funnel views."""
    rows = await _select_rows(session, "sem.crm_funnel_daily", start_date, end_date)
    if not rows:
        rows = await _select_rows(session, "sem_ui.contracts_daily_city", start_date, end_date)

    data = []
    for raw_row in rows:
        row = normalize_row(raw_row)
        date_value = pick_first(row, ["date_key", "date"])
        data.append(
            {
                "date": date_value,
                "contracts": int(pick_number(row, ["contracts", "contracts_cnt", "paid_contracts"])),
                "revenue": pick_number(row, ["revenue", "total_revenue", "income"]),
                "first_sum": pick_number(row, ["first_sum", "first_payment", "first_payment_sum"]),
            }
        )

    return {"status": "success", "data": data}


@router.get("/by-products")
async def get_sales_by_products(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Return product performance using SEM campaign/product views."""
    view_name = None
    columns: set[str] = set()
    for candidate in PRODUCT_VIEW_CANDIDATES:
        candidate_columns = await get_view_columns(session, candidate)
        if not candidate_columns:
            continue
        if any(key in candidate_columns for key in ("product", "product_key", "product_name", "course_name")):
            view_name = candidate
            columns = candidate_columns
            break

    if not view_name:
        return []

    rows = await _select_rows(session, view_name, start_date, end_date)
    if not rows:
        return []

    has_first_sum = any(key in columns for key in FIRST_SUM_KEYS)
    grouped: dict[str, dict[str, object]] = {}
    for raw_row in rows:
        row = normalize_row(raw_row)
        product_key = pick_first(row, ["product", "product_key", "product_name"])
        if product_key is None:
            product_key = pick_first(row, ["course_name"])
        if product_key is None:
            continue
        key = str(product_key)
        bucket = grouped.setdefault(
            key,
            {
                "service_id": pick_first(row, ["product_id", "service_id"]) or 0,
                "product_name": product_key,
                "contracts": 0.0,
                "revenue": 0.0,
                "first_sum": 0.0,
                "avg_value": 0.0,
                "count": 0,
            },
        )
        bucket["contracts"] += pick_number(row, ["contracts", "conversions", "leads", "contracts_cnt"])
        bucket["revenue"] += pick_number(row, ["revenue", "income", "revenue_sum", "total_revenue"])
        if has_first_sum:
            bucket["first_sum"] += pick_number(row, FIRST_SUM_KEYS)
        bucket["count"] += 1

    data = []
    for bucket in grouped.values():
        revenue = bucket["revenue"]
        contracts = bucket["contracts"]
        first_sum = bucket.get("first_sum", 0.0) if has_first_sum else None
        data.append(
            {
                "service_id": bucket["service_id"],
                "product_name": bucket["product_name"],
                "contracts": int(contracts),
                "revenue": float(revenue),
                "avg_value": float(revenue / contracts) if contracts else 0.0,
                "first_sum": float(first_sum) if first_sum is not None else None,
                "avg_first_sum": float(first_sum / contracts) if first_sum and contracts else 0.0,
            }
        )
    return data


@router.get("/v6/products/timeline")
async def get_products_timeline(
    date_from: date = Query(...),
    date_to: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Return product timeline (daily revenue/contracts) for analytics/products."""
    view_name = None
    for candidate in PRODUCT_VIEW_CANDIDATES:
        candidate_columns = await get_view_columns(session, candidate)
        if not candidate_columns:
            continue
        if "date_key" in candidate_columns and any(
            key in candidate_columns for key in ("product", "product_key", "product_name", "course_name")
        ):
            view_name = candidate
            break

    if not view_name:
        return []

    rows = await _select_rows(session, view_name, date_from, date_to)
    if not rows:
        return []

    data = []
    for raw_row in rows:
        row = normalize_row(raw_row)
        product_key = pick_first(row, ["product", "product_key", "product_name"])
        if product_key is None:
            product_key = pick_first(row, ["course_name"])
        if product_key is None:
            continue
        date_value = pick_first(row, ["date_key", "date"])
        if not date_value:
            continue
        data.append(
            {
                "date": date_value,
                "product_key": str(product_key),
                "product_name": row.get("product_name") or row.get("course_name") or str(product_key),
                "contracts": int(pick_number(row, ["contracts", "contracts_cnt", "paid_contracts"])),
                "revenue": pick_number(row, ["revenue", "revenue_sum", "total_revenue", "income"]),
            }
        )
    return data


@router.get("/conversion-funnel")
async def get_conversion_funnel(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Return funnel stages based on SEM CRM funnel view."""
    rows = await _select_rows(session, "sem.crm_funnel_daily", start_date, end_date)
    if not rows:
        return {"status": "success", "data": []}

    totals = {"requests": 0.0, "leads": 0.0, "contracts": 0.0, "payments": 0.0}
    for raw_row in rows:
        row = normalize_row(raw_row)
        totals["requests"] += pick_number(row, ["requests", "requests_cnt"])
        totals["leads"] += pick_number(row, ["leads", "leads_cnt"])
        totals["contracts"] += pick_number(row, ["contracts", "contracts_cnt", "paid_contracts"])
        totals["payments"] += pick_number(row, ["payments", "payments_cnt"])

    stages = [
        {"stage": "requests", "count": int(totals["requests"])},
        {"stage": "leads", "count": int(totals["leads"])},
        {"stage": "contracts", "count": int(totals["contracts"])},
        {"stage": "payments", "count": int(totals["payments"])},
    ]
    return {"status": "success", "data": stages}


@router.get("/v5/utm-sources")
async def get_utm_sources(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(None, description="Platform filter"),
    limit: int = Query(50, le=200),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Get UTM/source breakdown from SEM revenue_by_source."""
    platform_list = None
    if platforms:
        platform_list = [p.strip() for p in platforms.split(",")]

    extra_filters: list[str] = []
    params: dict[str, object] = {"limit": limit}
    if platform_list:
        extra_filters.append("platform = ANY(:platforms)")
        params["platforms"] = platform_list

    view_name = "sem.revenue_by_source"
    columns = await get_view_columns(session, view_name)
    has_first_sum = any(key in columns for key in FIRST_SUM_KEYS)
    rows = await _select_rows(
        session,
        view_name,
        date_from,
        date_to,
        extra_filters=extra_filters,
        params=params,
    )

    data = []
    for raw_row in rows[:limit]:
        row = normalize_row(raw_row)
        first_sum_value = pick_number(row, FIRST_SUM_KEYS) if has_first_sum else None
        contracts_value = int(pick_number(row, ["contracts", "contracts_cnt", "paid_contracts"]))
        data.append(
            {
                "platform": pick_first(row, ["platform", "channel", "source_type"]) or "unknown",
                "utm_source": pick_first(row, ["source", "source_name", "utm_source"]) or "unknown",
                "utm_medium": pick_first(row, ["utm_medium", "medium"]) or "",
                "utm_campaign": pick_first(row, ["utm_campaign", "campaign_name"]) or "",
                "n_contracts": contracts_value,
                "revenue": pick_number(row, ["revenue", "total_revenue", "income"]),
                "first_sum": float(first_sum_value) if first_sum_value is not None else None,
                "avg_first_sum": float(first_sum_value / contracts_value) if first_sum_value and contracts_value else 0.0,
            }
        )

    return data


@router.get("/v6/branches/performance")
async def get_branches_performance(
    date_from: date = Query(...),
    date_to: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Return branch (city) performance using stg.crm_contracts + dwh.dim_city."""
    query = text(
        """
        SELECT
            c.id_city AS branch_sk,
            COALESCE(d.city_name, 'Unknown') AS branch_name,
            COUNT(*)::int AS contracts,
            SUM(c.total_cost) AS revenue,
            SUM(c.first_sum) AS first_sum
        FROM stg.crm_contracts c
        LEFT JOIN dwh.dim_city d ON d.id_city = c.id_city
        WHERE c.date_key >= :date_from
          AND c.date_key <= :date_to
        GROUP BY c.id_city, d.city_name
        ORDER BY revenue DESC NULLS LAST
        """
    )
    rows = (await session.execute(query, {"date_from": date_from, "date_to": date_to})).mappings().all()
    data = []
    for row in rows:
        contracts = int(row.get("contracts") or 0)
        revenue = float(row.get("revenue") or 0)
        first_sum = float(row.get("first_sum") or 0)
        data.append(
            {
                "branch_sk": row.get("branch_sk") or 0,
                "branch_name": row.get("branch_name") or "Unknown",
                "contracts": contracts,
                "revenue": revenue,
                "first_sum": first_sum,
                "avg_first_sum": float(first_sum / contracts) if first_sum and contracts else 0.0,
            }
        )
    return data


@router.get("/v6/funnel")
async def get_sales_funnel(
    date_from: date = Query(...),
    date_to: date = Query(...),
    city_id: Optional[int] = Query(None),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Return CRM funnel time series from sem.crm_funnel_daily."""
    extra_filters = []
    params: dict[str, object] = {}
    if city_id is not None:
        extra_filters.append("id_city = :city_id")
        params["city_id"] = city_id

    rows = await _select_rows(
        session,
        "sem.crm_funnel_daily",
        date_from,
        date_to,
        extra_filters=extra_filters,
        params=params,
    )
    return [normalize_row(row) for row in rows]


@router.get("/v6/traffic/organic-vs-paid")
async def get_organic_vs_paid(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Return paid vs organic split using SEM channel mix view."""
    rows = await _select_rows(session, "sem.channel_mix_daily_city", date_from, date_to)
    return [normalize_row(row) for row in rows]


@router.get("/v6/products/performance")
async def get_products_performance(
    date_from: date = Query(...),
    date_to: date = Query(...),
    session: AsyncSession = Depends(get_itstep_session),
):
    """Return product performance using SEM campaign performance view."""
    return await get_sales_by_products(date_from, date_to, session)
