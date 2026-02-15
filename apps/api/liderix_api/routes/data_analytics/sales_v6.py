# apps/api/liderix_api/routes/data_analytics/sales_v6.py
"""
Sales Analytics v6 endpoints for Data Analytics dashboard
Real ITstep data - Funnel, Organic vs Paid, Products
Updated: October 14, 2025
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, date
from typing import Optional

from liderix_api.db import get_itstep_session
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

router = APIRouter(tags=["Data Analytics v6 - Sales"])


def parse_date(date_str: str) -> date:
    """Convert string date 'YYYY-MM-DD' to date object for asyncpg"""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


@router.get("/funnel")
async def get_funnel_analysis(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    platform: Optional[str] = Query(None, description="Platform filter (Meta/Google/Direct)"),
    db: AsyncSession = Depends(get_itstep_session)
):
    """
    Get marketing funnel analysis: Impressions → Clicks → Leads → Contracts
    Frontend expects: [{ date, platform, impressions, clicks, leads, contracts, ctr, cvr, contract_rate }]
    """
    try:
        platform_filter = ""
        if platform:
            platform_filter = "AND platform = :platform"

        funnel_query = text(f"""
            SELECT
                date,
                platform,
                SUM(impressions) as impressions,
                SUM(clicks) as clicks,
                SUM(leads) as leads,
                SUM(contracts) as contracts,
                CASE WHEN SUM(impressions) > 0
                    THEN 100.0 * SUM(clicks) / SUM(impressions)
                    ELSE 0
                END as ctr,
                CASE WHEN SUM(clicks) > 0
                    THEN 100.0 * SUM(leads) / SUM(clicks)
                    ELSE 0
                END as cvr,
                CASE WHEN SUM(leads) > 0
                    THEN 100.0 * SUM(contracts) / SUM(leads)
                    ELSE 0
                END as contract_rate
            FROM dashboards.v6_funnel_daily
            WHERE date >= :date_from
              AND date <= :date_to
              {platform_filter}
            GROUP BY date, platform
            ORDER BY date DESC, platform
        """)

        params = {"date_from": parse_date(date_from), "date_to": parse_date(date_to)}
        if platform:
            params["platform"] = platform

        result = await db.execute(funnel_query, params)
        rows = result.fetchall()

        return [
            {
                "date": row.date.isoformat(),
                "platform": row.platform or "unknown",
                "impressions": int(row.impressions or 0),
                "clicks": int(row.clicks or 0),
                "leads": int(row.leads or 0),
                "contracts": int(row.contracts or 0),
                "ctr": float(row.ctr or 0),
                "cvr": float(row.cvr or 0),
                "contract_rate": float(row.contract_rate or 0)
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Funnel analysis query failed: {str(e)}")


@router.get("/funnel/aggregate")
async def get_funnel_aggregate(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_itstep_session)
):
    """
    Get aggregated funnel metrics by platform
    Frontend expects: [{ platform, impressions, clicks, leads, contracts, ctr, cvr, contract_rate }]
    """
    try:
        aggregate_query = text("""
            SELECT
                platform,
                SUM(impressions) as impressions,
                SUM(clicks) as clicks,
                SUM(leads) as leads,
                SUM(contracts) as contracts,
                CASE WHEN SUM(impressions) > 0
                    THEN 100.0 * SUM(clicks) / SUM(impressions)
                    ELSE 0
                END as ctr,
                CASE WHEN SUM(clicks) > 0
                    THEN 100.0 * SUM(leads) / SUM(clicks)
                    ELSE 0
                END as cvr,
                CASE WHEN SUM(leads) > 0
                    THEN 100.0 * SUM(contracts) / SUM(leads)
                    ELSE 0
                END as contract_rate
            FROM dashboards.v6_funnel_daily
            WHERE date >= :date_from
              AND date <= :date_to
            GROUP BY platform
            ORDER BY impressions DESC
        """)

        result = await db.execute(
            aggregate_query,
            {"date_from": parse_date(date_from), "date_to": parse_date(date_to)}
        )
        rows = result.fetchall()

        return [
            {
                "platform": row.platform or "unknown",
                "impressions": int(row.impressions or 0),
                "clicks": int(row.clicks or 0),
                "leads": int(row.leads or 0),
                "contracts": int(row.contracts or 0),
                "ctr": float(row.ctr or 0),
                "cvr": float(row.cvr or 0),
                "contract_rate": float(row.contract_rate or 0)
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Funnel aggregate query failed: {str(e)}")


@router.get("/traffic/organic-vs-paid")
async def get_organic_vs_paid_traffic(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_itstep_session)
):
    """
    Get organic vs paid traffic breakdown with contracts
    Frontend expects: [{ traffic_type, platform, leads, contracts, revenue, cvr }]
    """
    try:
        traffic_query = text("""
            SELECT
                CASE
                    WHEN is_paid = true THEN 'Paid'
                    WHEN is_paid = false THEN 'Organic'
                    ELSE 'Unknown'
                END as traffic_type,
                dominant_platform as platform,
                COUNT(DISTINCT sk_lead) as leads,
                COUNT(DISTINCT CASE WHEN contract_amount > 0 THEN sk_lead END) as contracts,
                COALESCE(SUM(contract_amount), 0) as revenue,
                CASE WHEN COUNT(DISTINCT sk_lead) > 0
                    THEN 100.0 * COUNT(DISTINCT CASE WHEN contract_amount > 0 THEN sk_lead END) / COUNT(DISTINCT sk_lead)
                    ELSE 0
                END as cvr
            FROM dashboards.fact_leads
            WHERE created_date_txt::date >= :date_from
              AND created_date_txt::date <= :date_to
            GROUP BY traffic_type, dominant_platform
            ORDER BY contracts DESC, leads DESC
        """)

        result = await db.execute(
            traffic_query,
            {"date_from": parse_date(date_from), "date_to": parse_date(date_to)}
        )
        rows = result.fetchall()

        return [
            {
                "traffic_type": row.traffic_type,
                "platform": row.platform or "unknown",
                "leads": int(row.leads or 0),
                "contracts": int(row.contracts or 0),
                "revenue": float(row.revenue or 0),
                "cvr": float(row.cvr or 0)
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Organic vs paid traffic query failed: {str(e)}")


@router.get("/products/performance")
async def get_products_performance(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    limit: int = Query(20, le=100, description="Limit results"),
    db: AsyncSession = Depends(get_itstep_session)
):
    """
    Get product performance statistics
    Frontend expects: [{ product_name, contracts, revenue, avg_value }]
    """
    try:
        products_query = text("""
            SELECT
                product_name,
                total_contracts,
                total_revenue,
                avg_contract_value
            FROM dashboards.v6_product_performance
            WHERE total_contracts > 0
            ORDER BY total_contracts DESC, total_revenue DESC
            LIMIT :limit
        """)

        result = await db.execute(
            products_query,
            {"limit": limit}
        )
        rows = result.fetchall()

        return [
            {
                "product_name": row.product_name,
                "contracts": int(row.total_contracts or 0),
                "revenue": float(row.total_revenue or 0),
                "avg_value": float(row.avg_contract_value or 0)
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Products performance query failed: {str(e)}")
