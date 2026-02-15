"""
Top Movers (Winners/Losers/Watch) endpoint for Data Analytics v4
Source: Based on campaigns compare data
Classifies campaigns for quick marketing decisions
"""
import logging
from typing import Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.schemas.data_analytics import TopMoversResponse, TopMoverCampaign
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/campaigns/top-movers", response_model=TopMoversResponse)
async def get_top_movers(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        "google,meta",
        description="Comma-separated platforms (google,meta,email)"
    ),
    min_spend: Optional[float] = Query(0.0, description="Minimum spend filter"),
    n: Optional[int] = Query(10, description="Number of campaigns per category"),
    target_roas: Optional[float] = Query(3.0, description="Target ROAS for winners"),
    kill_roas: Optional[float] = Query(0.8, description="Kill ROAS for losers"),
    target_cpl: Optional[float] = Query(None, description="Target CPL for winners"),
    min_leads: Optional[int] = Query(5, description="Minimum leads for winners"),
    prev_from: Optional[date] = Query(None, description="Previous period start (for custom mode)"),
    prev_to: Optional[date] = Query(None, description="Previous period end (for custom mode)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get top movers: Winners (scale), Losers (pause), Watch

    Logic:
    - Winners: roas_cur >= target_roas OR cpl_cur <= target_cpl, leads_cur >= min_leads, leads_diff >= 0
    - Losers: (roas_cur < kill_roas OR leads_cur = 0) AND spend_cur >= min_spend
    - Watch: everything else
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

        # Get all campaigns with metrics - classification will be done in Python
        query = text(f"""
            WITH cur AS (
                SELECT
                    platform, campaign_id, campaign_name,
                    SUM(leads) AS leads_cur,
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
                    SUM(leads) AS leads_prev
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
                    THEN (COALESCE(c.leads_cur, 0) - p.leads_prev)::numeric * 100 / p.leads_prev
                END AS leads_diff_pct,
                COALESCE(c.spend_cur, 0) AS spend_cur,
                CASE WHEN COALESCE(c.leads_cur, 0) > 0
                    THEN c.spend_cur::numeric / NULLIF(c.leads_cur, 0)
                END AS cpl_cur,
                CASE WHEN COALESCE(c.spend_cur, 0) > 0
                    THEN c.revenue_cur::numeric / NULLIF(c.spend_cur, 0)
                END AS roas_cur
            FROM cur c
            FULL JOIN prev p USING (platform, campaign_id, campaign_name)
            WHERE COALESCE(c.spend_cur, 0) >= :min_spend
               OR COALESCE(p.leads_prev, 0) > 0
            ORDER BY leads_cur DESC
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "prev_from": prev_from_calc,
            "prev_to": prev_to_calc,
            "min_spend": min_spend or 0.0,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        # Classify campaigns in Python
        winners = []
        losers = []
        watch = []

        for row in rows:
            platform, campaign_id, campaign_name = row[0], row[1], row[2]
            leads_cur = int(row[3] or 0)
            leads_diff = int(row[5] or 0)
            leads_diff_pct = float(row[6]) if row[6] is not None else None
            spend_cur = float(row[7] or 0.0)
            cpl_cur = float(row[8]) if row[8] is not None else None
            roas_cur = float(row[9]) if row[9] is not None else None

            item = TopMoverCampaign(
                platform=platform,
                campaign_id=campaign_id,
                campaign_name=campaign_name,
                leads_cur=leads_cur,
                roas_cur=roas_cur,
                cpl_cur=cpl_cur,
                spend_cur=spend_cur,
                leads_diff=leads_diff,
                leads_diff_pct=leads_diff_pct,
            )

            # Classification logic
            is_winner = False
            is_loser = False

            # Winners: high performance + positive trend
            if leads_cur >= (min_leads or 5) and leads_diff >= 0:
                if target_roas is not None and roas_cur is not None and roas_cur >= target_roas:
                    is_winner = True
                elif target_cpl is not None and cpl_cur is not None and cpl_cur <= target_cpl:
                    is_winner = True

            # Losers: poor performance or no leads
            if spend_cur >= (min_spend or 0.0):
                if leads_cur == 0:
                    is_loser = True
                elif kill_roas is not None and (roas_cur is None or roas_cur < kill_roas):
                    is_loser = True

            if is_winner:
                winners.append(item)
            elif is_loser:
                losers.append(item)
            else:
                watch.append(item)

        # Sort and limit
        winners = sorted(winners, key=lambda x: (x.roas_cur or 0, x.leads_cur), reverse=True)[:n or 10]
        losers = sorted(losers, key=lambda x: (x.spend_cur, -x.leads_cur), reverse=True)[:n or 10]
        watch = sorted(watch, key=lambda x: x.leads_cur, reverse=True)[:n or 10]

        return TopMoversResponse(
            winners=winners,
            losers=losers,
            watch=watch
        )

    except Exception as e:
        logger.error(f"Error fetching top movers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch top movers: {str(e)}")
