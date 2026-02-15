"""
Trends Compare endpoints for Data Analytics v4
Source: dashboards.v5_bi_platform_daily
Overlay trends: current vs previous period (shifted)
"""
import logging
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User
from liderix_api.schemas.data_analytics import (
LeadsTrendCompareResponse,
    LeadsTrendCompareItem,
    SpendTrendCompareResponse,
    SpendTrendCompareItem,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/trend/leads/compare", response_model=LeadsTrendCompareResponse)
async def get_leads_trend_compare(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        "google,meta",
        description="Comma-separated platforms (google,meta,email)"
    ),
    prev_from: Optional[date] = Query(None, description="Previous period start (for custom mode)"),
    prev_to: Optional[date] = Query(None, description="Previous period end (for custom mode)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get daily leads trend with comparison overlay

    Returns: Array of {dt, leads_cur, leads_prev_shifted}
    Previous period is shifted to align with current period dates
    """
    try:
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND d.platform = ANY(:platforms)"
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

        # SQL from spec (section 2) - simplified CTEs
        query = text(f"""
            WITH cur AS (
                SELECT d.dt, SUM(d.leads) AS val
                FROM dashboards.v5_bi_platform_daily d
                WHERE d.dt BETWEEN :date_from AND :date_to
                    {platform_filter}
                GROUP BY d.dt
            ),
            prev AS (
                SELECT d.dt + (:days * INTERVAL '1 day') AS dt_align, SUM(d.leads) AS val
                FROM dashboards.v5_bi_platform_daily d
                WHERE d.dt BETWEEN :prev_from AND :prev_to
                    {platform_filter}
                GROUP BY 1
            )
            SELECT
                calendar.dt,
                COALESCE(c.val, 0) AS leads_cur,
                COALESCE(p.val, 0) AS leads_prev_shifted
            FROM (
                SELECT generate_series(
                    :date_from,
                    :date_to,
                    '1 day'
                )::date AS dt
            ) calendar
            LEFT JOIN cur c ON c.dt = calendar.dt
            LEFT JOIN prev p ON p.dt_align = calendar.dt
            ORDER BY calendar.dt
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "prev_from": prev_from_calc,
            "prev_to": prev_to_calc,
            "days": days,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            LeadsTrendCompareItem(
                dt=row[0],
                leads_cur=int(row[1] or 0),
                leads_prev_shifted=int(row[2] or 0)
            )
            for row in rows
        ]

        return LeadsTrendCompareResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching leads trend compare: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads trend compare: {str(e)}")


@router.get("/trend/spend/compare", response_model=SpendTrendCompareResponse)
async def get_spend_trend_compare(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        "google,meta",
        description="Comma-separated platforms (google,meta,email)"
    ),
    prev_from: Optional[date] = Query(None, description="Previous period start (for custom mode)"),
    prev_to: Optional[date] = Query(None, description="Previous period end (for custom mode)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get daily spend trend with comparison overlay

    Returns: Array of {dt, spend_cur, spend_prev_shifted}
    Previous period is shifted to align with current period dates
    """
    try:
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND d.platform = ANY(:platforms)"
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

        query = text(f"""
            WITH cur AS (
                SELECT d.dt, SUM(d.spend) AS val
                FROM dashboards.v5_bi_platform_daily d
                WHERE d.dt BETWEEN :date_from AND :date_to
                    {platform_filter}
                GROUP BY d.dt
            ),
            prev AS (
                SELECT d.dt + (:days * INTERVAL '1 day') AS dt_align, SUM(d.spend) AS val
                FROM dashboards.v5_bi_platform_daily d
                WHERE d.dt BETWEEN :prev_from AND :prev_to
                    {platform_filter}
                GROUP BY 1
            )
            SELECT
                calendar.dt,
                COALESCE(c.val, 0) AS spend_cur,
                COALESCE(p.val, 0) AS spend_prev_shifted
            FROM (
                SELECT generate_series(
                    :date_from,
                    :date_to,
                    '1 day'
                )::date AS dt
            ) calendar
            LEFT JOIN cur c ON c.dt = calendar.dt
            LEFT JOIN prev p ON p.dt_align = calendar.dt
            ORDER BY calendar.dt
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "prev_from": prev_from_calc,
            "prev_to": prev_to_calc,
            "days": days,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            SpendTrendCompareItem(
                dt=row[0],
                spend_cur=float(row[1] or 0.0),
                spend_prev_shifted=float(row[2] or 0.0)
            )
            for row in rows
        ]

        return SpendTrendCompareResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching spend trend compare: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch spend trend compare: {str(e)}")
