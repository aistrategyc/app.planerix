"""
Campaigns endpoints for Data Analytics
Sources:
- dashboards.v8_campaigns_daily_full (campaigns aggregated, ALL sources + full ad metrics)
"""
import logging
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.services.auth import get_current_user
from liderix_api.models.users import User
from liderix_api.db import get_itstep_session
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User
from liderix_api.schemas.data_analytics import (
    CampaignsResponse,
    CampaignItem,
    WoWCampaignsResponse,
    WoWCampaignItem,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=CampaignsResponse)
async def get_campaigns(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        None,
        description="Comma-separated platforms (google,meta,direct,organic,email,other) or empty for all"
    ),
    min_spend: Optional[float] = Query(0.0, description="Minimum spend filter"),
    limit: Optional[int] = Query(500, description="Results limit"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get campaigns aggregated metrics for the period (ALL sources)

    Returns: Array of campaigns with platform, campaign_id, campaign_name, leads, contracts, revenue, spend, CPL, ROAS
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        query = text(f"""
            SELECT
                platform,
                campaign_id,
                campaign_name,
                SUM(leads) AS leads,
                SUM(contracts) AS n_contracts,
                SUM(revenue) AS revenue,
                SUM(spend) AS spend,
                CASE WHEN SUM(leads) > 0
                    THEN SUM(spend)::numeric / NULLIF(SUM(leads), 0)
                END AS cpl,
                CASE WHEN SUM(spend) > 0
                    THEN SUM(revenue)::numeric / NULLIF(SUM(spend), 0)
                END AS roas
            FROM dashboards.v8_campaigns_daily_full
            WHERE dt BETWEEN :date_from AND :date_to
                {platform_filter}
            GROUP BY platform, campaign_id, campaign_name
            HAVING SUM(spend) >= :min_spend
            ORDER BY leads DESC
            LIMIT :limit
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "min_spend": min_spend or 0.0,
            "limit": limit or 500,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            CampaignItem(
                platform=row[0],
                campaign_id=row[1],
                campaign_name=row[2],
                leads=int(row[3] or 0),
                n_contracts=int(row[4] or 0),
                revenue=float(row[5] or 0.0),
                spend=float(row[6] or 0.0),
                cpl=float(row[7]) if row[7] is not None else None,
                roas=float(row[8]) if row[8] is not None else None,
            )
            for row in rows
        ]

        return CampaignsResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaigns: {str(e)}")


@router.get("/wow", response_model=WoWCampaignsResponse)
async def get_wow_campaigns(
    platforms: Optional[str] = Query(
        None,
        description="Comma-separated platforms (google,meta,direct,organic,email,other) or empty for all"
    ),
    limit: Optional[int] = Query(200, description="Results limit"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get week-over-week campaigns comparison (ALL sources)

    Returns: Array of campaigns with current week vs previous week metrics
    Source: dashboards.v8_campaigns_daily_full (dynamic WoW calculation)
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        # Dynamic WoW calculation from v6_campaign_daily_full
        query = text(f"""
            WITH week_bounds AS (
                SELECT
                    DATE_TRUNC('week', CURRENT_DATE)::date AS cur_start,
                    CURRENT_DATE AS cur_end,
                    DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')::date AS prev_start,
                    (DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 day')::date AS prev_end
            ),
            cur_week AS (
                SELECT
                    platform,
                    campaign_id,
                    campaign_name,
                    SUM(leads) as leads,
                    SUM(spend) as spend,
                    SUM(n_contracts) as contracts
                FROM dashboards.v8_campaigns_daily_full, week_bounds
                WHERE dt BETWEEN cur_start AND cur_end
                    {platform_filter}
                GROUP BY platform, campaign_id, campaign_name
            ),
            prev_week AS (
                SELECT
                    platform,
                    campaign_id,
                    campaign_name,
                    SUM(leads) as leads,
                    SUM(spend) as spend
                FROM dashboards.v8_campaigns_daily_full, week_bounds
                WHERE dt BETWEEN prev_start AND prev_end
                    {platform_filter}
                GROUP BY platform, campaign_id, campaign_name
            )
            SELECT
                COALESCE(c.platform, p.platform) as platform,
                COALESCE(c.campaign_id, p.campaign_id) as campaign_id,
                COALESCE(c.campaign_name, p.campaign_name) as campaign_name,
                COALESCE(c.leads, 0) as leads_cur,
                COALESCE(p.leads, 0) as leads_prev,
                (COALESCE(c.leads, 0) - COALESCE(p.leads, 0)) AS leads_diff,
                CASE WHEN COALESCE(p.leads, 0) > 0
                    THEN (COALESCE(c.leads, 0) - COALESCE(p.leads, 0))::numeric * 100.0 / p.leads
                    ELSE NULL
                END AS leads_diff_pct,
                COALESCE(c.spend, 0.0) as spend_cur,
                COALESCE(p.spend, 0.0) as spend_prev,
                (COALESCE(c.spend, 0.0) - COALESCE(p.spend, 0.0)) AS spend_diff,
                CASE WHEN COALESCE(p.spend, 0.0) > 0
                    THEN (COALESCE(c.spend, 0.0) - COALESCE(p.spend, 0.0))::numeric * 100.0 / p.spend
                    ELSE NULL
                END AS spend_diff_pct,
                CASE WHEN COALESCE(c.leads, 0) > 0
                    THEN c.spend / NULLIF(c.leads, 0)
                    ELSE NULL
                END as cpl_cur,
                CASE WHEN COALESCE(p.leads, 0) > 0
                    THEN p.spend / NULLIF(p.leads, 0)
                    ELSE NULL
                END as cpl_prev
            FROM cur_week c
            FULL OUTER JOIN prev_week p USING (platform, campaign_id, campaign_name)
            WHERE COALESCE(c.leads, 0) > 0 OR COALESCE(p.leads, 0) > 0
            ORDER BY (COALESCE(c.leads, 0) - COALESCE(p.leads, 0)) DESC
            LIMIT :limit
        """)

        params = {
            "limit": limit or 200,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            WoWCampaignItem(
                platform=row[0],
                campaign_id=row[1],
                campaign_name=row[2],
                leads_cur=int(row[3] or 0),
                leads_prev=int(row[4] or 0),
                leads_diff=int(row[5] or 0),
                leads_diff_pct=float(row[6]) if row[6] is not None else None,
                spend_cur=float(row[7] or 0.0),
                spend_prev=float(row[8] or 0.0),
                spend_diff=float(row[9] or 0.0),
                spend_diff_pct=float(row[10]) if row[10] is not None else None,
                cpl_cur=float(row[11]) if row[11] is not None else None,
                cpl_prev=float(row[12]) if row[12] is not None else None,
            )
            for row in rows
        ]

        return WoWCampaignsResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching WoW campaigns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch WoW campaigns: {str(e)}")
