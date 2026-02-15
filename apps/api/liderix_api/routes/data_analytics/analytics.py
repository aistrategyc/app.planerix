"""
Analytics endpoints for /data-analytics page
Uses v8 views: v8_campaigns_daily, v8_platform_daily, v8_attribution_summary
Date: October 19, 2025
"""
import logging
from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/campaigns/daily")
async def get_campaigns_daily(
    start_date: date = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(default=None, description="End date (YYYY-MM-DD)"),
    platform: Optional[str] = Query(default=None, description="Filter by platform: 'Google Ads', 'Meta', 'Direct'"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get daily campaign performance data

    Returns:
        List of campaigns with daily metrics (leads, contracts, revenue, avg_contract)
    """
    try:
        # Default to last 30 days if not specified
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()

        # Build query
        query_text = """
            SELECT
                dt,
                campaign_name,
                campaign_id,
                platform,
                leads,
                contracts,
                revenue,
                avg_contract
            FROM dashboards.v8_campaigns_daily
            WHERE dt >= :start_date AND dt <= :end_date
        """

        params = {"start_date": start_date, "end_date": end_date}

        if platform:
            query_text += " AND platform = :platform"
            params["platform"] = platform

        query_text += " ORDER BY dt DESC, leads DESC"

        result = await session.execute(text(query_text), params)
        rows = result.fetchall()

        return [
            {
                "dt": str(row.dt),
                "campaign_name": row.campaign_name,
                "campaign_id": row.campaign_id,
                "platform": row.platform,
                "leads": row.leads,
                "contracts": row.contracts,
                "revenue": float(row.revenue) if row.revenue else 0.0,
                "avg_contract": float(row.avg_contract) if row.avg_contract else 0.0,
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"Error fetching campaigns daily: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaigns daily: {str(e)}")


@router.get("/platforms/daily")
async def get_platforms_daily(
    start_date: date = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(default=None, description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get daily platform performance data

    Returns:
        List of platforms with daily metrics (leads, contracts, revenue, conversion_rate)
    """
    try:
        # Default to last 30 days if not specified
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()

        query = text("""
            SELECT
                dt,
                platform,
                leads,
                contracts,
                revenue,
                conversion_rate
            FROM dashboards.v8_platform_daily
            WHERE dt >= :start_date AND dt <= :end_date
            ORDER BY dt DESC, platform
        """)

        result = await session.execute(query, {"start_date": start_date, "end_date": end_date})
        rows = result.fetchall()

        return [
            {
                "dt": str(row.dt),
                "platform": row.platform,
                "leads": row.leads,
                "contracts": row.contracts,
                "revenue": float(row.revenue) if row.revenue else 0.0,
                "conversion_rate": float(row.conversion_rate) if row.conversion_rate else 0.0,
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"Error fetching platforms daily: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch platforms daily: {str(e)}")


@router.get("/attribution/summary")
async def get_attribution_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get attribution summary across all sources

    Returns:
        List of attribution types with total metrics (leads, contracts, revenue, avg_contract_value)
    """
    try:
        query = text("""
            SELECT
                attribution_type,
                total_leads,
                contracts,
                total_revenue,
                avg_contract_value
            FROM dashboards.v8_attribution_summary
            ORDER BY total_leads DESC
        """)

        result = await session.execute(query)
        rows = result.fetchall()

        return [
            {
                "attribution_type": row.attribution_type,
                "total_leads": row.total_leads,
                "contracts": row.contracts,
                "total_revenue": float(row.total_revenue) if row.total_revenue else 0.0,
                "avg_contract_value": float(row.avg_contract_value) if row.avg_contract_value else 0.0,
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"Error fetching attribution summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch attribution summary: {str(e)}")
