"""
Marketing Campaigns API routes - Real data from ITstep analytics database.

This module provides endpoints for viewing marketing campaign performance
from the itstep_final database using SEM views (no legacy dashboards schema).
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List
from datetime import date, timedelta

from ..db import get_itstep_session
from ..schemas.ads import CampaignRead, CampaignMetrics, CampaignStatsResponse
from ..services.dependencies import get_current_user

router = APIRouter(prefix="/marketing-campaigns", tags=["marketing-campaigns"])


@router.get("", response_model=List[CampaignRead])
async def get_campaigns(
    date_from: date = Query(default=None, description="Start date for filtering campaigns"),
    date_to: date = Query(default=None, description="End date for filtering campaigns"),
    platform: str = Query(default="all", description="Platform filter: 'all', 'google', or 'meta'"),
    limit: int = Query(default=50, ge=1, le=500, description="Maximum number of campaigns to return"),
    session: AsyncSession = Depends(get_itstep_session),
    current_user = Depends(get_current_user)
):
    """
    Get list of marketing campaigns from ITstep analytics database.

    Returns real campaign data with daily aggregated metrics including
    impressions, clicks, spend, leads, CPL, and CTR.
    """
    # Default to last 30 days if no dates provided
    if date_from is None:
        date_from = date.today() - timedelta(days=30)
    if date_to is None:
        date_to = date.today()

    platform_filter = ""
    if platform != "all":
        platform_filter = "WHERE platform = :platform"

    query_text = f"""
        WITH gads AS (
            SELECT
                g.campaign_id::text as campaign_id,
                COALESCE(g.campaign_name, g.campaign_id::text) as campaign_name,
                'google' as platform,
                COUNT(DISTINCT g.date_key) as days_active,
                SUM(g.impressions) as total_impressions,
                SUM(g.clicks) as total_clicks,
                SUM(g.spend) as total_spend,
                0::bigint as total_leads,
                MAX(g.date_key) as last_date
            FROM sem.gads_spend_daily g
            WHERE g.date_key >= :date_from
              AND g.date_key <= :date_to
            GROUP BY g.campaign_id, g.campaign_name
        ),
        meta AS (
            SELECT
                fb.campaign_id::text as campaign_id,
                COALESCE(dim.campaign_name, fb.campaign_id::text) as campaign_name,
                'meta' as platform,
                COUNT(DISTINCT fb.date) as days_active,
                SUM(fb.impressions) as total_impressions,
                SUM(fb.clicks) as total_clicks,
                SUM(fb.spend) as total_spend,
                0::bigint as total_leads,
                MAX(fb.date) as last_date
            FROM sem.fb_ad_spend_daily fb
            LEFT JOIN sem.fb_ads_dim dim ON dim.campaign_id = fb.campaign_id
            WHERE fb.date >= :date_from
              AND fb.date <= :date_to
            GROUP BY fb.campaign_id, dim.campaign_name
        ),
        all_data AS (
            SELECT * FROM gads
            UNION ALL
            SELECT * FROM meta
        )
        SELECT *
        FROM all_data
        {platform_filter}
        ORDER BY total_spend DESC NULLS LAST
        LIMIT :limit
    """

    params = {
        "date_from": date_from,
        "date_to": date_to,
        "limit": limit
    }

    if platform != "all":
        params["platform"] = platform

    try:
        result = await session.execute(text(query_text), params)
        rows = result.fetchall()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database query failed: {str(e)}"
        )

    # Convert rows to CampaignRead objects
    campaigns = []
    for row in rows:
        ctr = 0.0
        if (row.total_impressions or 0) > 0:
            ctr = float(row.total_clicks or 0) / float(row.total_impressions) * 100
        cpl = 0.0
        if (row.total_leads or 0) > 0:
            cpl = float(row.total_spend or 0) / float(row.total_leads or 0)
        campaigns.append(CampaignRead(
            campaign_id=str(row.campaign_id),
            campaign_name=row.campaign_name or "Unnamed Campaign",
            platform=row.platform if row.platform in ['google', 'meta'] else 'meta',
            type='ppc',  # Most campaigns are PPC (pay-per-click)
            status='active',  # Assume active if in recent data
            days_active=int(row.days_active or 0),
            metrics=CampaignMetrics(
                impressions=int(row.total_impressions or 0),
                clicks=int(row.total_clicks or 0),
                spend=float(row.total_spend or 0),
                leads=int(row.total_leads or 0),
                cpl=float(cpl),
                ctr=float(ctr),
                conversions=int(row.total_leads or 0),  # Leads are conversions
                roas=0.0  # ROAS not available in current data
            ),
            budget=None,  # Budget not available in current data
            target_audience=None  # Target audience not available in current data
        ))

    return campaigns


@router.get("/stats", response_model=CampaignStatsResponse)
async def get_campaign_stats(
    date_from: date = Query(default=None, description="Start date for statistics"),
    date_to: date = Query(default=None, description="End date for statistics"),
    session: AsyncSession = Depends(get_itstep_session),
    current_user = Depends(get_current_user)
):
    """
    Get aggregated statistics for all marketing campaigns.

    Returns totals and averages across all campaigns in the specified date range.
    """
    # Default to last 30 days if no dates provided
    if date_from is None:
        date_from = date.today() - timedelta(days=30)
    if date_to is None:
        date_to = date.today()

    query_text = """
        WITH gads AS (
            SELECT
                g.campaign_id::text as campaign_id,
                COUNT(DISTINCT g.date_key) as days_active,
                SUM(g.impressions) as total_impressions,
                SUM(g.clicks) as total_clicks,
                SUM(g.spend) as total_spend,
                0::bigint as total_leads,
                MAX(g.date_key) as last_date
            FROM sem.gads_spend_daily g
            WHERE g.date_key >= :date_from
              AND g.date_key <= :date_to
            GROUP BY g.campaign_id
        ),
        meta AS (
            SELECT
                fb.campaign_id::text as campaign_id,
                COUNT(DISTINCT fb.date) as days_active,
                SUM(fb.impressions) as total_impressions,
                SUM(fb.clicks) as total_clicks,
                SUM(fb.spend) as total_spend,
                0::bigint as total_leads,
                MAX(fb.date) as last_date
            FROM sem.fb_ad_spend_daily fb
            WHERE fb.date >= :date_from
              AND fb.date <= :date_to
            GROUP BY fb.campaign_id
        ),
        all_data AS (
            SELECT * FROM gads
            UNION ALL
            SELECT * FROM meta
        )
        SELECT
            COUNT(DISTINCT campaign_id) as total_campaigns,
            COUNT(DISTINCT CASE
                WHEN last_date >= CURRENT_DATE - INTERVAL '7 days'
                THEN campaign_id
            END) as active_campaigns,
            SUM(total_spend) as total_spend,
            SUM(total_leads) as total_leads,
            ROUND(SUM(total_spend) / NULLIF(SUM(total_leads), 0), 2) as avg_cpl,
            ROUND(SUM(total_clicks)::numeric / NULLIF(SUM(total_impressions), 0) * 100, 2) as avg_ctr
        FROM all_data
    """

    try:
        result = await session.execute(
            text(query_text),
            {"date_from": date_from, "date_to": date_to}
        )
        row = result.fetchone()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database query failed: {str(e)}"
        )

    if not row:
        return CampaignStatsResponse(
            total_campaigns=0,
            active_campaigns=0,
            total_spend=0.0,
            total_leads=0,
            avg_cpl=0.0,
            avg_ctr=0.0
        )

    return CampaignStatsResponse(
        total_campaigns=int(row.total_campaigns or 0),
        active_campaigns=int(row.active_campaigns or 0),
        total_spend=float(row.total_spend or 0),
        total_leads=int(row.total_leads or 0),
        avg_cpl=float(row.avg_cpl or 0),
        avg_ctr=float(row.avg_ctr or 0)
    )
