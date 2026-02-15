"""
Share/Distribution endpoints for Data Analytics
Sources:
- dashboards.v8_platform_daily_full (platform shares with 90% data coverage)
- dashboards.v8_campaigns_daily_full (top campaigns with full metrics)
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
PlatformShareResponse,
    PlatformShareItem,
    TopCampaignsResponse,
    TopCampaignItem,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/platforms", response_model=PlatformShareResponse)
async def get_platform_share(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get platform leads distribution (for pie/donut chart)

    Returns: Array of {platform, leads} - shows share of leads by platform
    """
    try:
        query = text("""
            SELECT platform, SUM(leads) AS leads
            FROM dashboards.v8_platform_daily_full
            WHERE dt BETWEEN :date_from AND :date_to
            GROUP BY platform
            ORDER BY leads DESC
        """)

        result = await session.execute(
            query,
            {
                "date_from": date_from,
                "date_to": date_to,
            }
        )
        rows = result.fetchall()

        data = [
            PlatformShareItem(platform=row[0], leads=int(row[1] or 0))
            for row in rows
        ]

        return PlatformShareResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching platform share: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch platform share: {str(e)}")


@router.get("/top-campaigns", response_model=TopCampaignsResponse)
async def get_top_campaigns(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    limit: Optional[int] = Query(5, description="Number of top campaigns (default 5)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get top campaigns by leads (for pie/bar chart)

    Returns: Array of {campaign_name, leads} - top N campaigns by leads
    """
    try:
        query = text("""
            SELECT campaign_name, SUM(leads) AS leads
            FROM dashboards.v8_campaigns_daily_full
            WHERE dt BETWEEN :date_from AND :date_to
                AND campaign_name IS NOT NULL
            GROUP BY campaign_name
            ORDER BY leads DESC
            LIMIT :limit
        """)

        result = await session.execute(
            query,
            {
                "date_from": date_from,
                "date_to": date_to,
                "limit": limit or 5,
            }
        )
        rows = result.fetchall()

        data = [
            TopCampaignItem(campaign_name=row[0], leads=int(row[1] or 0))
            for row in rows
        ]

        return TopCampaignsResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching top campaigns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch top campaigns: {str(e)}")
