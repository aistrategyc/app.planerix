"""
Budget Recommendations endpoint for Data Analytics v4 (v6)
Source: Based on campaigns compare data
Rule-based budget recommendations
"""
import logging
from typing import Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.schemas.data_analytics import BudgetRecommendationsResponse, BudgetRecommendationItem
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/reco/budget", response_model=BudgetRecommendationsResponse)
async def get_budget_recommendations(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        "google,meta",
        description="Comma-separated platforms (google,meta,email)"
    ),
    min_spend: Optional[float] = Query(0.0, description="Minimum spend filter"),
    limit: Optional[int] = Query(200, description="Results limit"),
    target_roas: Optional[float] = Query(3.0, description="Target ROAS for scale action"),
    kill_roas: Optional[float] = Query(0.8, description="Kill ROAS for pause action"),
    target_cpl: Optional[float] = Query(None, description="Target CPL for scale action"),
    min_leads: Optional[int] = Query(5, description="Minimum leads for scale action"),
    prev_from: Optional[date] = Query(None, description="Previous period start (for custom mode)"),
    prev_to: Optional[date] = Query(None, description="Previous period end (for custom mode)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get budget recommendations with actions: scale, pause, watch

    Returns campaigns sorted by action priority and performance metrics
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        # Calculate prev dates
        days = (date_to - date_from).days + 1
        if prev_from is None or prev_to is None:
            prev_from_calc = date_from - timedelta(days=days)
            prev_to_calc = date_from - timedelta(days=1)
        else:
            prev_from_calc = prev_from
            prev_to_calc = prev_to

        # SQL from spec (section 10)
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
            ),
            cmp AS (
                SELECT
                    COALESCE(c.platform, p.platform) AS platform,
                    COALESCE(c.campaign_id, p.campaign_id) AS campaign_id,
                    COALESCE(c.campaign_name, p.campaign_name) AS campaign_name,

                    COALESCE(c.leads_cur, 0) AS leads_cur,
                    COALESCE(p.leads_prev, 0) AS leads_prev,
                    (COALESCE(c.leads_cur, 0) - COALESCE(p.leads_prev, 0)) AS leads_diff,
                    CASE WHEN COALESCE(p.leads_prev, 0) > 0
                        THEN (COALESCE(c.leads_cur, 0) - p.leads_prev)::numeric * 100 / p.leads_prev
                    END AS leads_diff_pct,

                    COALESCE(c.spend_cur, 0) AS spend_cur,
                    COALESCE(p.spend_prev, 0) AS spend_prev,

                    CASE WHEN COALESCE(c.leads_cur, 0) > 0
                        THEN c.spend_cur::numeric / NULLIF(c.leads_cur, 0)
                    END AS cpl_cur,
                    CASE WHEN COALESCE(p.leads_prev, 0) > 0
                        THEN p.spend_prev::numeric / NULLIF(p.leads_prev, 0)
                    END AS cpl_prev,

                    CASE WHEN COALESCE(c.spend_cur, 0) > 0
                        THEN c.revenue_cur::numeric / NULLIF(c.spend_cur, 0)
                    END AS roas_cur,
                    CASE WHEN COALESCE(p.spend_prev, 0) > 0
                        THEN p.revenue_prev::numeric / NULLIF(p.spend_prev, 0)
                    END AS roas_prev

                FROM cur c
                FULL JOIN prev p USING (platform, campaign_id, campaign_name)
            )
            SELECT
                platform, campaign_id, campaign_name,
                leads_cur, spend_cur, cpl_cur, roas_cur,
                leads_prev, spend_prev, cpl_prev, roas_prev,
                leads_diff, leads_diff_pct
            FROM cmp
            WHERE COALESCE(spend_cur, 0) >= :min_spend
               OR COALESCE(leads_prev, 0) > 0
            ORDER BY roas_cur DESC NULLS LAST, leads_cur DESC
            LIMIT :limit
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "prev_from": prev_from_calc,
            "prev_to": prev_to_calc,
            "min_spend": min_spend or 0.0,
            "limit": limit or 200,
            "target_roas": target_roas,
            "kill_roas": kill_roas,
            "target_cpl": target_cpl,
            "min_leads": min_leads or 5,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        # Classify and create items with action in Python
        data = []
        for row in rows:
            platform, campaign_id, campaign_name = row[0], row[1], row[2]
            leads_cur = int(row[3] or 0)
            spend_cur = float(row[4] or 0.0)
            cpl_cur = float(row[5]) if row[5] is not None else None
            roas_cur = float(row[6]) if row[6] is not None else None
            leads_prev = int(row[7] or 0)
            spend_prev = float(row[8] or 0.0)
            cpl_prev = float(row[9]) if row[9] is not None else None
            roas_prev = float(row[10]) if row[10] is not None else None
            leads_diff = int(row[11] or 0)
            leads_diff_pct = float(row[12]) if row[12] is not None else None

            # Determine action
            action = 'watch'  # default

            # Scale: high performance + positive trend
            if spend_cur >= (min_spend or 0.0) and leads_cur >= (min_leads or 5) and leads_diff >= 0:
                if target_roas is not None and roas_cur is not None and roas_cur >= target_roas:
                    action = 'scale'
                elif target_cpl is not None and cpl_cur is not None and cpl_cur <= target_cpl:
                    action = 'scale'

            # Pause: poor performance or no leads
            if spend_cur >= (min_spend or 0.0):
                if leads_cur == 0:
                    action = 'pause'
                elif kill_roas is not None and (roas_cur is None or roas_cur < kill_roas):
                    action = 'pause'

            data.append(BudgetRecommendationItem(
                platform=platform,
                campaign_id=campaign_id,
                campaign_name=campaign_name,
                leads_cur=leads_cur,
                spend_cur=spend_cur,
                cpl_cur=cpl_cur,
                roas_cur=roas_cur,
                leads_prev=leads_prev,
                spend_prev=spend_prev,
                cpl_prev=cpl_prev,
                roas_prev=roas_prev,
                leads_diff=leads_diff,
                leads_diff_pct=leads_diff_pct,
                action=action,
            ))

        # Sort by action priority
        data = sorted(data, key=lambda x: (
            {'scale': 1, 'watch': 2, 'pause': 3}[x.action],
            -(x.roas_cur or 0),
            -x.leads_cur
        ))

        return BudgetRecommendationsResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching budget recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch budget recommendations: {str(e)}")
