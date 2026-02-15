"""
Ads Manager API routes - Real data from ITstep analytics database.

This module provides endpoints for managing and viewing advertising data
from the itstep_final database using SEM views (no legacy dashboards schema).
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List
from datetime import date, timedelta

from ..db import get_itstep_session
from ..schemas.ads import AdRead, AdMetrics, AdStatsResponse
from ..services.dependencies import get_current_user

router = APIRouter(prefix="/ads-manager", tags=["ads-manager"])


@router.get("", response_model=List[AdRead], deprecated=True)
async def get_ads(
    date_from: date = Query(default=None, description="Start date for filtering ads"),
    date_to: date = Query(default=None, description="End date for filtering ads"),
    platform: str = Query(default="all", description="Platform filter: 'all', 'google', or 'meta'"),
    limit: int = Query(default=50, ge=1, le=500, description="Maximum number of ads to return"),
    session: AsyncSession = Depends(get_itstep_session),
    current_user = Depends(get_current_user)
):
    """
    Get list of advertising campaigns from ITstep analytics database.

    Returns ad-level data from SEM views (Meta ads + Google Ads campaigns).
    Data includes impressions, clicks, spend, CTR, and CPC metrics.
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
        WITH meta AS (
            SELECT
              fb.ad_id::text as ad_id,
              COALESCE(dim.ad_name, fb.ad_id::text) as ad_name,
              fb.campaign_id::text as campaign_id,
              COALESCE(dim.campaign_name, fb.campaign_id::text) as campaign_name,
              'meta'::text as platform,
              'social'::text as ad_type,
              MIN(fb.date) as date_start,
              MAX(fb.date) as date_stop,
              SUM(fb.impressions) as total_impressions,
              SUM(fb.clicks) as total_clicks,
              SUM(fb.spend) as total_spend,
              0::numeric as total_conversions
            FROM sem.fb_ad_spend_daily fb
            LEFT JOIN sem.fb_ads_dim dim ON dim.ad_id = fb.ad_id
            WHERE fb.date >= :date_from
              AND fb.date <= :date_to
            GROUP BY fb.ad_id, dim.ad_name, fb.campaign_id, dim.campaign_name
        ),
        gads AS (
            SELECT
              g.campaign_id::text as ad_id,
              COALESCE(g.campaign_name, g.campaign_id::text) as ad_name,
              g.campaign_id::text as campaign_id,
              g.campaign_name as campaign_name,
              'google'::text as platform,
              CASE
                WHEN g.advertising_channel_type ILIKE '%VIDEO%' THEN 'video'
                WHEN g.advertising_channel_type ILIKE '%SHOPPING%' THEN 'shopping'
                WHEN g.advertising_channel_type ILIKE '%DISPLAY%' THEN 'display'
                ELSE 'search'
              END as ad_type,
              MIN(g.date_key) as date_start,
              MAX(g.date_key) as date_stop,
              SUM(g.impressions) as total_impressions,
              SUM(g.clicks) as total_clicks,
              SUM(g.spend) as total_spend,
              SUM(g.conversions) as total_conversions
            FROM sem.gads_spend_daily g
            WHERE g.date_key >= :date_from
              AND g.date_key <= :date_to
            GROUP BY g.campaign_id, g.campaign_name, g.advertising_channel_type
        ),
        all_ads AS (
            SELECT * FROM meta
            UNION ALL
            SELECT * FROM gads
        )
        SELECT *
        FROM all_ads
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

    # Convert rows to AdRead objects
    ads = []
    for row in rows:
        impressions = int(row.total_impressions or 0)
        clicks = int(row.total_clicks or 0)
        spend = float(row.total_spend or 0)
        conversions = int(row.total_conversions or 0)
        ctr = (clicks / impressions * 100) if impressions else 0.0
        cpc = (spend / clicks) if clicks else 0.0
        ad_type = row.ad_type if row.ad_type in ['search', 'display', 'video', 'shopping', 'social'] else 'social'

        ads.append(AdRead(
            ad_id=str(row.ad_id),
            ad_name=row.ad_name or "Unnamed Ad",
            campaign_id=str(row.campaign_id) if row.campaign_id else "unknown",
            campaign_name=row.campaign_name,
            platform=row.platform if row.platform in ['google', 'meta'] else 'meta',
            type=ad_type,
            status='active',
            metrics=AdMetrics(
                impressions=impressions,
                clicks=clicks,
                spend=spend,
                ctr=ctr,
                cpc=cpc,
                conversions=conversions,
                cpa=0.0,
                roas=0.0
            ),
            date_start=row.date_start,
            date_stop=row.date_stop
        ))

    return ads


@router.get("/stats", response_model=AdStatsResponse, deprecated=True)
async def get_ads_stats(
    date_from: date = Query(default=None, description="Start date for statistics"),
    date_to: date = Query(default=None, description="End date for statistics"),
    session: AsyncSession = Depends(get_itstep_session),
    current_user = Depends(get_current_user)
):
    """
    Get aggregated statistics for all advertisements.

    Returns totals and averages across all ads in the specified date range.
    """
    # Default to last 30 days if no dates provided
    if date_from is None:
        date_from = date.today() - timedelta(days=30)
    if date_to is None:
        date_to = date.today()

    query_text = """
        WITH meta AS (
            SELECT
              fb.ad_id::text as ad_id,
              fb.campaign_id::text as campaign_id,
              SUM(fb.impressions) as impressions,
              SUM(fb.clicks) as clicks,
              SUM(fb.spend) as spend
            FROM sem.fb_ad_spend_daily fb
            WHERE fb.date >= :date_from
              AND fb.date <= :date_to
            GROUP BY fb.ad_id, fb.campaign_id
        ),
        gads AS (
            SELECT
              g.campaign_id::text as ad_id,
              g.campaign_id::text as campaign_id,
              SUM(g.impressions) as impressions,
              SUM(g.clicks) as clicks,
              SUM(g.spend) as spend
            FROM sem.gads_spend_daily g
            WHERE g.date_key >= :date_from
              AND g.date_key <= :date_to
            GROUP BY g.campaign_id
        ),
        all_ads AS (
            SELECT * FROM meta
            UNION ALL
            SELECT * FROM gads
        )
        SELECT
          COUNT(DISTINCT ad_id) as total_ads,
          COUNT(DISTINCT campaign_id) as total_campaigns,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(spend) as total_spend,
          ROUND(SUM(clicks)::numeric / NULLIF(SUM(impressions), 0) * 100, 2) as avg_ctr,
          ROUND(SUM(spend) / NULLIF(SUM(clicks), 0), 2) as avg_cpc
        FROM all_ads
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
        return AdStatsResponse(
            total_ads=0,
            total_campaigns=0,
            total_impressions=0,
            total_clicks=0,
            total_spend=0.0,
            avg_ctr=0.0,
            avg_cpc=0.0
        )

    return AdStatsResponse(
        total_ads=int(row.total_ads or 0),
        total_campaigns=int(row.total_campaigns or 0),
        total_impressions=int(row.total_impressions or 0),
        total_clicks=int(row.total_clicks or 0),
        total_spend=float(row.total_spend or 0),
        avg_ctr=float(row.avg_ctr or 0),
        avg_cpc=float(row.avg_cpc or 0)
    )
