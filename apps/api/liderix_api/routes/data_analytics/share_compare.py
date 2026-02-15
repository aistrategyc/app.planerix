"""
Platform Share Compare endpoint for Data Analytics v4
Source: dashboards.v5_bi_platform_daily
Compares platform share with percentage points delta
"""
import logging
from typing import Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.schemas.data_analytics import PlatformShareCompareResponse, PlatformShareCompareItem
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/share/platforms/compare", response_model=PlatformShareCompareResponse)
async def get_platform_share_compare(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        None,
        description="Comma-separated platforms (google,meta,email) - if not provided, shows all"
    ),
    prev_from: Optional[date] = Query(None, description="Previous period start (for custom mode)"),
    prev_to: Optional[date] = Query(None, description="Previous period end (for custom mode)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get platform share with Period-over-Period comparison and percentage points delta

    Returns: Platform shares with current/previous percentages and p.p. delta
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        # Calculate prev dates in Python
        days = (date_to - date_from).days + 1
        if prev_from is None or prev_to is None:
            prev_from_calc = date_from - timedelta(days=days)
            prev_to_calc = date_from - timedelta(days=1)
        else:
            prev_from_calc = prev_from
            prev_to_calc = prev_to

        # SQL from spec (section 5)
        query = text(f"""
            WITH cur AS (
                SELECT platform, SUM(leads) AS leads
                FROM dashboards.v5_bi_platform_daily
                WHERE dt BETWEEN :date_from AND :date_to
                    {platform_filter}
                GROUP BY platform
            ),
            prev AS (
                SELECT platform, SUM(leads) AS leads
                FROM dashboards.v5_bi_platform_daily
                WHERE dt BETWEEN :prev_from AND :prev_to
                    {platform_filter}
                GROUP BY platform
            ),
            tot AS (
                SELECT
                    (SELECT COALESCE(SUM(leads), 0) FROM cur) AS cur_total,
                    (SELECT COALESCE(SUM(leads), 0) FROM prev) AS prev_total
            )
            SELECT
                COALESCE(c.platform, p.platform) AS platform,
                COALESCE(c.leads, 0) AS cur_leads,
                COALESCE(p.leads, 0) AS prev_leads,
                CASE WHEN tot.cur_total > 0
                    THEN COALESCE(c.leads, 0)::numeric * 100 / tot.cur_total
                END AS share_cur_pct,
                CASE WHEN tot.prev_total > 0
                    THEN COALESCE(p.leads, 0)::numeric * 100 / tot.prev_total
                END AS share_prev_pct,
                CASE WHEN tot.cur_total > 0 AND tot.prev_total > 0
                    THEN (COALESCE(c.leads, 0)::numeric * 100 / tot.cur_total) -
                         (COALESCE(p.leads, 0)::numeric * 100 / tot.prev_total)
                END AS share_diff_pp
            FROM cur c
            FULL JOIN prev p USING(platform)
            CROSS JOIN tot
            ORDER BY cur_leads DESC
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "prev_from": prev_from_calc,
            "prev_to": prev_to_calc,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            PlatformShareCompareItem(
                platform=row[0],
                cur_leads=int(row[1] or 0),
                prev_leads=int(row[2] or 0),
                share_cur_pct=float(row[3]) if row[3] is not None else None,
                share_prev_pct=float(row[4]) if row[4] is not None else None,
                share_diff_pp=float(row[5]) if row[5] is not None else None,
            )
            for row in rows
        ]

        return PlatformShareCompareResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching platform share compare: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch platform share compare: {str(e)}")
