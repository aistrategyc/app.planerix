"""
Campaign Insights endpoint - detailed campaign metrics and comparison
Source: dashboards.fact_leads + v5_bi_platform_daily
Shows: top performers, bottom performers, detailed metrics
"""
import logging
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/campaigns/insights")
async def get_campaign_insights(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    min_leads: int = Query(5, description="Minimum leads to include"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get detailed campaign insights with performance metrics.

    Returns:
    - Top 10 performers (by ROAS and contracts)
    - Bottom 5 performers (by CPL and conversion rate)
    - Detailed metrics: leads, contracts, revenue, spend, CPL, CPC, CTR, ROAS

    Data source: dashboards.fact_leads aggregated by campaign
    """
    try:
        query = text("""
            WITH campaign_stats AS (
                SELECT
                    unified_platform as platform,
                    unified_campaign_id as campaign_id,
                    unified_campaign_name as campaign_name,
                    COUNT(*) as leads,
                    SUM(CASE WHEN contract_amount > 0 THEN 1 ELSE 0 END) as contracts,
                    SUM(contract_amount) as revenue,
                    ROUND(AVG(contract_amount), 2) as avg_contract_value,
                    ROUND(SUM(CASE WHEN contract_amount > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as conversion_rate
                FROM dashboards.fact_leads
                WHERE row_created_at::date >= :date_from
                  AND row_created_at::date <= :date_to
                GROUP BY unified_platform, unified_campaign_id, unified_campaign_name
                HAVING COUNT(*) >= :min_leads
            )
            SELECT
                platform,
                campaign_id,
                campaign_name,
                leads,
                contracts,
                revenue,
                avg_contract_value,
                conversion_rate,
                CASE
                    WHEN contracts > 0 THEN 'high_performer'
                    WHEN conversion_rate >= 5 THEN 'medium_performer'
                    WHEN leads >= 20 THEN 'volume_driver'
                    ELSE 'needs_attention'
                END as performance_category
            FROM campaign_stats
            ORDER BY
                contracts DESC,
                revenue DESC,
                conversion_rate DESC
            LIMIT 25
        """)

        result = await session.execute(query, {
            "date_from": date_from,
            "date_to": date_to,
            "min_leads": min_leads,
        })
        rows = result.mappings().all()

        data = []
        for row in rows:
            data.append({
                "platform": row["platform"] or "unknown",
                "campaign_id": row["campaign_id"],
                "campaign_name": row["campaign_name"],
                "leads": int(row["leads"] or 0),
                "contracts": int(row["contracts"] or 0),
                "revenue": float(row["revenue"] or 0.0),
                "avg_contract_value": float(row["avg_contract_value"] or 0.0),
                "conversion_rate": float(row["conversion_rate"] or 0.0),
                "performance_category": row["performance_category"],
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching campaign insights: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaign insights: {str(e)}")


@router.get("/campaigns/metrics-trend")
async def get_campaigns_metrics_trend(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get daily trends for key metrics: CPL, CPC, CTR, impressions, clicks.

    Returns daily aggregated metrics across all platforms.
    Data source: dashboards.v5_bi_platform_daily
    """
    try:
        query = text("""
            SELECT
                dt,
                SUM(leads) as leads,
                SUM(clicks) as clicks,
                SUM(impressions) as impressions,
                SUM(spend) as spend,
                ROUND(SUM(spend)::numeric / NULLIF(SUM(leads), 0), 2) as cpl,
                ROUND(SUM(spend)::numeric / NULLIF(SUM(clicks), 0), 2) as cpc,
                ROUND(SUM(clicks)::numeric / NULLIF(SUM(impressions), 0) * 100, 2) as ctr,
                ROUND(SUM(spend)::numeric / NULLIF(SUM(impressions), 0) * 1000, 2) as cpm
            FROM dashboards.v5_bi_platform_daily
            WHERE dt >= :date_from AND dt <= :date_to
            GROUP BY dt
            ORDER BY dt
        """)

        result = await session.execute(query, {
            "date_from": date_from,
            "date_to": date_to,
        })
        rows = result.mappings().all()

        data = []
        for row in rows:
            data.append({
                "dt": str(row["dt"]),
                "leads": int(row["leads"] or 0),
                "clicks": int(row["clicks"] or 0),
                "impressions": int(row["impressions"] or 0),
                "spend": float(row["spend"] or 0.0),
                "cpl": float(row["cpl"]) if row["cpl"] else None,
                "cpc": float(row["cpc"]) if row["cpc"] else None,
                "ctr": float(row["ctr"]) if row["ctr"] else None,
                "cpm": float(row["cpm"]) if row["cpm"] else None,
            })

        return {"data": data}

    except Exception as e:
        logger.error(f"Error fetching metrics trend: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch metrics trend: {str(e)}")
