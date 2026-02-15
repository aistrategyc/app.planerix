"""
Campaigns Compare endpoint for Data Analytics v4
Source: dashboards.v5_leads_campaign_daily
Compares campaigns performance: current vs previous period
"""
import logging
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.schemas.data_analytics import CampaignsCompareResponse, CampaignCompareItem
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/campaigns/compare", response_model=CampaignsCompareResponse)
async def get_campaigns_compare(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        "google,meta",
        description="Comma-separated platforms (google,meta,email)"
    ),
    min_spend: Optional[float] = Query(0.0, description="Minimum spend filter"),
    limit: Optional[int] = Query(500, description="Results limit"),
    prev_from: Optional[date] = Query(None, description="Previous period start (for custom mode)"),
    prev_to: Optional[date] = Query(None, description="Previous period end (for custom mode)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get campaigns with Period-over-Period comparison

    Returns: Campaigns with current vs previous metrics
    Sorted by leads_cur DESC by default
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        # Build platform filter
        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        # Calculate prev dates in Python to avoid CTE complexity
        from datetime import timedelta
        days = (date_to - date_from).days + 1
        if prev_from is None or prev_to is None:
            prev_from_calc = date_from - timedelta(days=days)
            prev_to_calc = date_from - timedelta(days=1)
        else:
            prev_from_calc = prev_from
            prev_to_calc = prev_to

        # SQL query from spec (section 3) - simplified CTEs
        query = text(f"""
            WITH cur AS (
                SELECT
                    platform, campaign_id, campaign_name,
                    SUM(leads) AS leads_cur,
                    SUM(n_contracts) AS n_contracts_cur,
                    SUM(sum_contracts) AS revenue_cur,
                    SUM(spend) AS spend_cur
                FROM dashboards.v5_leads_campaign_daily
                WHERE dt BETWEEN :date_from AND :date_to
                    {platform_filter}
                GROUP BY 1, 2, 3
            ),
            prev AS (
                SELECT
                    platform, campaign_id, campaign_name,
                    SUM(leads) AS leads_prev,
                    SUM(n_contracts) AS n_contracts_prev,
                    SUM(sum_contracts) AS revenue_prev,
                    SUM(spend) AS spend_prev
                FROM dashboards.v5_leads_campaign_daily
                WHERE dt BETWEEN :prev_from AND :prev_to
                    {platform_filter}
                GROUP BY 1, 2, 3
            )
            SELECT
                COALESCE(c.platform, p.platform) AS platform,
                COALESCE(c.campaign_id, p.campaign_id) AS campaign_id,
                COALESCE(c.campaign_name, p.campaign_name) AS campaign_name,

                COALESCE(c.leads_cur, 0) AS leads_cur,
                COALESCE(p.leads_prev, 0) AS leads_prev,
                (COALESCE(c.leads_cur, 0) - COALESCE(p.leads_prev, 0)) AS leads_diff,
                CASE WHEN COALESCE(p.leads_prev, 0) > 0
                    THEN (COALESCE(c.leads_cur, 0) - p.leads_prev)::numeric * 100 / p.leads_prev END AS leads_diff_pct,

                COALESCE(c.n_contracts_cur, 0) AS n_contracts_cur,
                COALESCE(p.n_contracts_prev, 0) AS n_contracts_prev,

                COALESCE(c.revenue_cur, 0) AS revenue_cur,
                COALESCE(p.revenue_prev, 0) AS revenue_prev,

                COALESCE(c.spend_cur, 0) AS spend_cur,
                COALESCE(p.spend_prev, 0) AS spend_prev,

                CASE WHEN COALESCE(c.leads_cur, 0) > 0
                    THEN c.spend_cur::numeric / NULLIF(c.leads_cur, 0) END AS cpl_cur,
                CASE WHEN COALESCE(p.leads_prev, 0) > 0
                    THEN p.spend_prev::numeric / NULLIF(p.leads_prev, 0) END AS cpl_prev,

                CASE WHEN COALESCE(c.spend_cur, 0) > 0
                    THEN c.revenue_cur::numeric / NULLIF(c.spend_cur, 0) END AS roas_cur,
                CASE WHEN COALESCE(p.spend_prev, 0) > 0
                    THEN p.revenue_prev::numeric / NULLIF(p.spend_prev, 0) END AS roas_prev
            FROM cur c
            FULL JOIN prev p USING (platform, campaign_id, campaign_name)
            WHERE COALESCE(c.spend_cur, 0) >= :min_spend
                OR COALESCE(p.spend_prev, 0) >= :min_spend
            ORDER BY leads_cur DESC
            LIMIT :limit
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "min_spend": min_spend or 0.0,
            "limit": limit or 500,
            "prev_from": prev_from_calc,
            "prev_to": prev_to_calc,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            CampaignCompareItem(
                platform=row[0],
                campaign_id=row[1],
                campaign_name=row[2],
                leads_cur=int(row[3] or 0),
                leads_prev=int(row[4] or 0),
                leads_diff=int(row[5] or 0),
                leads_diff_pct=float(row[6]) if row[6] is not None else None,
                n_contracts_cur=int(row[7] or 0),
                n_contracts_prev=int(row[8] or 0),
                revenue_cur=float(row[9] or 0.0),
                revenue_prev=float(row[10] or 0.0),
                spend_cur=float(row[11] or 0.0),
                spend_prev=float(row[12] or 0.0),
                cpl_cur=float(row[13]) if row[13] is not None else None,
                cpl_prev=float(row[14]) if row[14] is not None else None,
                roas_cur=float(row[15]) if row[15] is not None else None,
                roas_prev=float(row[16]) if row[16] is not None else None,
            )
            for row in rows
        ]

        return CampaignsCompareResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching campaigns compare: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaigns compare: {str(e)}")
