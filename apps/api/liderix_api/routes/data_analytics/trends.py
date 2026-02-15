"""
Trends endpoints for Data Analytics
Source: dashboards.v8_platform_daily_full (includes ALL traffic sources + full ad metrics)
"""
import logging
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User
from liderix_api.schemas.data_analytics import (
LeadsTrendResponse,
    LeadsTrendItem,
    SpendTrendResponse,
    SpendTrendItem,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/leads", response_model=LeadsTrendResponse)
async def get_leads_trend(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        None,
        description="Comma-separated platforms (google,meta,direct,organic,email,other) or empty for all"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get daily leads trend for the period (ALL sources)

    Returns: Array of {dt, leads} by day
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        query = text(f"""
            SELECT dt, SUM(leads) AS leads
            FROM dashboards.v8_platform_daily_full
            WHERE dt BETWEEN :date_from AND :date_to
                {platform_filter}
            GROUP BY dt
            ORDER BY dt
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            LeadsTrendItem(dt=row[0], leads=int(row[1] or 0))
            for row in rows
        ]

        return LeadsTrendResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching leads trend: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads trend: {str(e)}")


@router.get("/spend", response_model=SpendTrendResponse)
async def get_spend_trend(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        None,
        description="Comma-separated platforms (google,meta,direct,organic,email,other) or empty for all"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get daily spend trend for the period (ALL sources)

    Returns: Array of {dt, spend} by day
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        query = text(f"""
            SELECT dt, SUM(spend) AS spend
            FROM dashboards.v8_platform_daily_full
            WHERE dt BETWEEN :date_from AND :date_to
                {platform_filter}
            GROUP BY dt
            ORDER BY dt
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            SpendTrendItem(dt=row[0], spend=float(row[1] or 0.0))
            for row in rows
        ]

        return SpendTrendResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching spend trend: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch spend trend: {str(e)}")
