"""
Overview endpoint - Summary KPIs for ads across platforms
"""
import logging
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.schemas.ads import AdsOverviewResponse
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/overview", response_model=AdsOverviewResponse)
async def get_ads_overview(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platform: Optional[str] = Query(None, description="facebook, google, or empty for both"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get summary KPIs for ads across platforms

    Returns aggregated metrics: spend, impressions, clicks, leads, contracts, revenue, ROAS, CPL, CTR
    """
    try:
        platform_filter_sql = ""
        params = {
            "date_from": date_from,
            "date_to": date_to,
        }
        if platform and platform.lower() in {"facebook", "google"}:
            platform_filter_sql = "AND platform = :platform"
            params["platform"] = platform.lower()

        # Query from v8_campaigns_daily_full (includes Facebook, Google, and all other platforms)
        query = text(f"""
            WITH platform_agg AS (
                SELECT
                    SUM(spend) as total_spend,
                    SUM(impressions) as total_impressions,
                    SUM(clicks) as total_clicks,
                    SUM(leads) as crm_leads,
                    SUM(ad_conversions) as platform_leads,
                    SUM(contracts) as contracts,
                    SUM(revenue) as revenue
                FROM dashboards.v8_campaigns_daily_full
                WHERE dt BETWEEN :date_from AND :date_to
                    AND platform IN ('facebook', 'google')
                    {platform_filter_sql}
            )
            SELECT
                total_spend,
                total_impressions,
                total_clicks,
                crm_leads,
                platform_leads,
                contracts,
                revenue,
                CASE
                    WHEN total_spend > 0
                    THEN revenue / total_spend
                END as roas,
                CASE
                    WHEN crm_leads > 0
                    THEN total_spend / crm_leads
                END as cpl,
                CASE
                    WHEN total_impressions > 0
                    THEN (100.0 * total_clicks / total_impressions)
                END as ctr,
                CASE
                    WHEN crm_leads > 0
                    THEN (100.0 * contracts / crm_leads)
                END as conversion_rate,
                CASE
                    WHEN platform_leads > 0
                    THEN (100.0 * crm_leads / platform_leads)
                END as match_rate
            FROM platform_agg
        """)

        result = await session.execute(query, params)
        row = result.fetchone()

        if not row:
            return AdsOverviewResponse(
                total_spend=0.0,
                total_impressions=0,
                total_clicks=0,
                crm_leads=0,
                platform_leads=0,
                contracts=0,
                revenue=0.0,
                roas=None,
                cpl=None,
                ctr=None,
                conversion_rate=None,
                match_rate=None
            )

        return AdsOverviewResponse(
            total_spend=float(row[0] or 0),
            total_impressions=int(row[1] or 0),
            total_clicks=int(row[2] or 0),
            crm_leads=int(row[3] or 0),
            platform_leads=int(row[4] or 0),
            contracts=int(row[5] or 0),
            revenue=float(row[6] or 0),
            roas=float(row[7]) if row[7] is not None else None,
            cpl=float(row[8]) if row[8] is not None else None,
            ctr=float(row[9]) if row[9] is not None else None,
            conversion_rate=float(row[10]) if row[10] is not None else None,
            match_rate=float(row[11]) if row[11] is not None else None
        )

    except Exception as e:
        logger.error(f"Error fetching ads overview: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch ads overview: {str(e)}")
