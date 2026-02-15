"""
Contracts Attribution Analysis - NEW endpoint for detailed contract source analysis
Source: dashboards.v7_contracts_with_attribution, dashboards.v8_attribution_summary
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
    ContractsAttributionSummary,
    ContractsBySourceResponse,
    ContractSourceItem,
    ContractsByPlatformResponse,
    ContractPlatformItem,
    ContractsTimelineResponse,
    ContractTimelineItem,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/attribution-summary", response_model=ContractsAttributionSummary)
async def get_contracts_attribution_summary(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get contracts attribution summary - shows conversion rates by source type

    Returns: Attribution types with leads, contracts, revenue, conversion rates
    """
    try:
        query = text("""
            SELECT
                attribution_type,
                total_leads,
                contracts,
                total_revenue,
                avg_contract_value,
                ROUND(100.0 * contracts / NULLIF(total_leads, 0), 2) as conversion_rate,
                CASE
                    WHEN contracts > 0 THEN total_revenue / contracts
                    ELSE 0
                END as actual_avg_contract
            FROM dashboards.v8_attribution_summary
            ORDER BY contracts DESC, total_leads DESC
        """)

        result = await session.execute(query)
        rows = result.fetchall()

        total_leads = sum(row[1] for row in rows)
        total_contracts = sum(row[2] for row in rows)
        total_revenue = sum(float(row[3] or 0) for row in rows)

        data = [
            {
                "attribution_type": row[0],
                "total_leads": int(row[1] or 0),
                "contracts": int(row[2] or 0),
                "revenue": float(row[3] or 0),
                "avg_contract_value": float(row[4] or 0),
                "conversion_rate": float(row[5] or 0),
                "lead_share_pct": round(100.0 * (row[1] or 0) / total_leads, 2) if total_leads > 0 else 0,
                "contract_share_pct": round(100.0 * (row[2] or 0) / total_contracts, 2) if total_contracts > 0 else 0,
            }
            for row in rows
        ]

        return ContractsAttributionSummary(
            data=data,
            total_leads=total_leads,
            total_contracts=total_contracts,
            total_revenue=total_revenue,
            overall_conversion_rate=round(100.0 * total_contracts / total_leads, 2) if total_leads > 0 else 0,
        )

    except Exception as e:
        logger.error(f"Error fetching contracts attribution summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch attribution summary: {str(e)}")


@router.get("/by-platform", response_model=ContractsByPlatformResponse)
async def get_contracts_by_platform(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get contracts breakdown by platform with detailed metrics
    Uses v8_platform_daily_full for accurate lead counts (includes Meta!)

    Returns: Platforms with leads, contracts, revenue, conversion rates
    """
    try:
        query = text("""
            SELECT
                platform,
                SUM(leads) as total_leads,
                SUM(contracts) as contracts,
                SUM(revenue) as revenue,
                CASE
                    WHEN SUM(contracts) > 0 THEN SUM(revenue) / SUM(contracts)
                    ELSE 0
                END as avg_contract_value,
                ROUND(100.0 * SUM(contracts) / NULLIF(SUM(leads), 0), 2) as conversion_rate
            FROM dashboards.v8_platform_daily_full
            WHERE dt BETWEEN :date_from AND :date_to
            GROUP BY platform
            ORDER BY contracts DESC, total_leads DESC
        """)

        result = await session.execute(query, {
            "date_from": date_from,
            "date_to": date_to,
        })
        rows = result.fetchall()

        data = [
            ContractPlatformItem(
                platform=row[0],
                total_leads=int(row[1] or 0),
                contracts=int(row[2] or 0),
                revenue=float(row[3] or 0),
                avg_contract_value=float(row[4] or 0),
                conversion_rate=float(row[5] or 0),
            )
            for row in rows
        ]

        return ContractsByPlatformResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching contracts by platform: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch contracts by platform: {str(e)}")


@router.get("/by-source", response_model=ContractsBySourceResponse)
async def get_contracts_by_source(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    limit: Optional[int] = Query(50, description="Results limit"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get contracts breakdown by traffic source (campaign-level)
    Uses v8_campaigns_daily_full for accurate campaign data

    Returns: Top sources with leads, contracts, revenue, conversion rates
    """
    try:
        platform_filter = "AND platform = :platform" if platform else ""

        query = text(f"""
            SELECT
                platform,
                COALESCE(campaign_name, 'N/A') as traffic_source,
                COALESCE(campaign_id, 'N/A') as campaign,
                SUM(leads) as total_leads,
                SUM(contracts) as contracts,
                SUM(revenue) as revenue,
                CASE
                    WHEN SUM(contracts) > 0 THEN SUM(revenue) / SUM(contracts)
                    ELSE 0
                END as avg_contract_value,
                ROUND(100.0 * SUM(contracts) / NULLIF(SUM(leads), 0), 2) as conversion_rate
            FROM dashboards.v8_campaigns_daily_full
            WHERE dt BETWEEN :date_from AND :date_to
                {platform_filter}
            GROUP BY platform, campaign_name, campaign_id
            HAVING SUM(leads) > 0
            ORDER BY contracts DESC, total_leads DESC
            LIMIT :limit
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit or 50,
        }
        if platform:
            params["platform"] = platform

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            ContractSourceItem(
                platform=row[0],
                traffic_source=row[1],
                campaign=row[2],
                total_leads=int(row[3] or 0),
                contracts=int(row[4] or 0),
                revenue=float(row[5] or 0),
                avg_contract_value=float(row[6] or 0) if row[6] else 0.0,
                conversion_rate=float(row[7] or 0),
            )
            for row in rows
        ]

        return ContractsBySourceResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching contracts by source: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch contracts by source: {str(e)}")


@router.get("/timeline", response_model=ContractsTimelineResponse)
async def get_contracts_timeline(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    group_by: Optional[str] = Query("day", description="Grouping: day, week, month"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get contracts timeline with conversion funnel
    Uses v8_platform_daily_full for accurate time-series data

    Returns: Daily/weekly/monthly breakdown of leads → contracts
    """
    try:
        # Determine grouping
        if group_by == "week":
            date_trunc = "DATE_TRUNC('week', dt)::date"
        elif group_by == "month":
            date_trunc = "DATE_TRUNC('month', dt)::date"
        else:
            date_trunc = "dt"

        platform_filter = "AND platform = :platform" if platform else ""

        query = text(f"""
            SELECT
                {date_trunc} as dt,
                SUM(leads) as total_leads,
                SUM(contracts) as contracts,
                SUM(revenue) as revenue,
                ROUND(100.0 * SUM(contracts) / NULLIF(SUM(leads), 0), 2) as conversion_rate
            FROM dashboards.v8_platform_daily_full
            WHERE dt BETWEEN :date_from AND :date_to
                {platform_filter}
            GROUP BY {date_trunc}
            ORDER BY dt
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
        }
        if platform:
            params["platform"] = platform

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            ContractTimelineItem(
                dt=row[0],
                total_leads=int(row[1] or 0),
                contracts=int(row[2] or 0),
                revenue=float(row[3] or 0),
                conversion_rate=float(row[4] or 0),
            )
            for row in rows
        ]

        return ContractsTimelineResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching contracts timeline: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch contracts timeline: {str(e)}")
