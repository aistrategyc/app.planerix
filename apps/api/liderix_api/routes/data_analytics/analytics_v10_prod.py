"""
V10 Analytics API - PROD SCHEMA WITH FULL FUNNEL
Replaces V9 with complete customer journey and multi-touch attribution
Date: October 23, 2025
Author: Claude Code + Kirill

PROD Schema Features:
- Full customer funnel (ALL touches, not just first)
- Multi-touch attribution (first, last, last paid)
- 17,136 events vs 4,570 in V9 (3.75x more data)
- Email/Viber/Event preserved
- Platform-specific analytics

Endpoints:
1. /events/funnel - Full customer journey
2. /events/by-platform - Events breakdown by platform
3. /contracts/multi-touch - Contracts with multi-touch attribution
4. /platforms/touches - Platform touches analysis
5. /campaigns/facebook/funnel - Facebook full funnel
6. /campaigns/google/funnel - Google full funnel
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


# ============================================================================
# FULL FUNNEL ANALYTICS
# ============================================================================

@router.get("/events/funnel")
async def get_events_funnel(
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
    platform: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get full customer funnel with ALL touches (not just first!)

    Returns ALL 17,136 events including:
    - First touch, mid-funnel, last touch
    - Email events (non-first-touch)
    - Viber/Telegram in journey
    - Event platform touchpoints

    Source: prod.fact_events
    """
    try:
        if not start_date:
            start_date = date.today() - timedelta(days=90)
        if not end_date:
            end_date = date.today()

        platform_filter = ""
        params = {"start_date": start_date, "end_date": end_date}

        if platform:
            platform_filter = "AND platform = :platform"
            params["platform"] = platform

        query_text = f"""
            SELECT
                DATE(event_day) as dt,
                platform,
                channel,
                COUNT(*) as total_events,
                COUNT(DISTINCT client_id) as unique_clients,
                SUM(CASE WHEN is_first_touch THEN 1 ELSE 0 END) as first_touch_events,
                SUM(CASE WHEN is_last_touch THEN 1 ELSE 0 END) as last_touch_events,
                SUM(CASE WHEN is_contract THEN 1 ELSE 0 END) as contracts,
                SUM(COALESCE(contract_amount, 0)) as revenue,
                ROUND(AVG(touch_sequence_number), 1) as avg_touch_sequence
            FROM prod.fact_events
            WHERE event_day >= :start_date AND event_day <= :end_date
                {platform_filter}
            GROUP BY DATE(event_day), platform, channel
            ORDER BY dt DESC, total_events DESC
        """

        result = await session.execute(text(query_text), params)
        rows = result.fetchall()

        return [
            {
                "dt": str(row.dt),
                "platform": row.platform,
                "channel": row.channel,
                "total_events": row.total_events,
                "unique_clients": row.unique_clients,
                "first_touch_events": row.first_touch_events,
                "last_touch_events": row.last_touch_events,
                "contracts": row.contracts,
                "revenue": float(row.revenue) if row.revenue else 0.0,
                "avg_touch_sequence": float(row.avg_touch_sequence) if row.avg_touch_sequence else 0.0,
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"Error fetching events funnel: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch events funnel: {str(e)}")


@router.get("/contracts/multi-touch")
async def get_contracts_multi_touch(
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get contracts with multi-touch attribution

    Shows:
    - Attributed platform (last paid touch)
    - First touch platform
    - Total touches in journey
    - Days to convert
    - All platforms used in journey

    Source: prod.fact_contracts
    """
    try:
        if not start_date:
            start_date = date.today() - timedelta(days=90)
        if not end_date:
            end_date = date.today()

        query_text = """
            SELECT
                contract_day,
                client_id,
                contract_amount,
                attributed_platform,
                attributed_channel,
                attributed_campaign_name,
                first_touch_platform,
                first_touch_channel,
                total_touches,
                days_to_convert,
                platforms_in_journey
            FROM prod.fact_contracts
            WHERE contract_day >= :start_date AND contract_day <= :end_date
            ORDER BY contract_day DESC, contract_amount DESC
        """

        result = await session.execute(
            text(query_text),
            {"start_date": start_date, "end_date": end_date}
        )
        rows = result.fetchall()

        return [
            {
                "contract_day": str(row.contract_day),
                "client_id": row.client_id,
                "contract_amount": float(row.contract_amount),
                "attributed_platform": row.attributed_platform,
                "attributed_channel": row.attributed_channel,
                "attributed_campaign_name": row.attributed_campaign_name,
                "first_touch_platform": row.first_touch_platform,
                "first_touch_channel": row.first_touch_channel,
                "total_touches": row.total_touches,
                "days_to_convert": row.days_to_convert,
                "platforms_in_journey": row.platforms_in_journey if row.platforms_in_journey else [],
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"Error fetching contracts multi-touch: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch contracts: {str(e)}")


@router.get("/platforms/touches")
async def get_platforms_touches(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Platform touches analysis - how many touches lead to conversion

    Shows for each platform:
    - Total touches
    - Unique clients touched
    - Clients who converted
    - Conversion rate
    - Average touches per client
    - Revenue

    Source: prod.view_platform_touches_analysis
    """
    try:
        query_text = """
            SELECT
                platform,
                unique_clients,
                total_touches,
                avg_touches_per_client,
                clients_who_converted,
                conversion_rate_pct,
                total_revenue,
                avg_revenue_per_converted
            FROM prod.view_platform_touches_analysis
            ORDER BY total_revenue DESC NULLS LAST
        """

        result = await session.execute(text(query_text))
        rows = result.fetchall()

        return [
            {
                "platform": row.platform,
                "unique_clients": row.unique_clients,
                "total_touches": row.total_touches,
                "avg_touches_per_client": float(row.avg_touches_per_client) if row.avg_touches_per_client else 0.0,
                "clients_who_converted": row.clients_who_converted,
                "conversion_rate_pct": float(row.conversion_rate_pct) if row.conversion_rate_pct else 0.0,
                "total_revenue": float(row.total_revenue) if row.total_revenue else 0.0,
                "avg_revenue_per_converted": float(row.avg_revenue_per_converted) if row.avg_revenue_per_converted else 0.0,
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"Error fetching platforms touches: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch platforms touches: {str(e)}")


# ============================================================================
# FACEBOOK FULL FUNNEL
# ============================================================================

@router.get("/campaigns/facebook/funnel")
async def get_facebook_funnel(
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Facebook full funnel - ALL 564 Facebook events (not just 17 first-touch!)

    Shows:
    - All Facebook touchpoints in customer journey
    - Campaign-level breakdown
    - First touch vs mid-funnel vs last touch
    - Conversion metrics

    Source: prod.fact_events WHERE platform IN ('facebook', 'instagram')
    """
    try:
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()

        query_text = """
            SELECT
                DATE(event_day) as dt,
                platform,
                campaign_name,
                COUNT(*) as total_events,
                COUNT(DISTINCT client_id) as unique_clients,
                SUM(CASE WHEN is_first_touch THEN 1 ELSE 0 END) as first_touch,
                SUM(CASE WHEN NOT is_first_touch AND NOT is_last_touch THEN 1 ELSE 0 END) as mid_funnel,
                SUM(CASE WHEN is_last_touch THEN 1 ELSE 0 END) as last_touch,
                SUM(CASE WHEN is_contract THEN 1 ELSE 0 END) as contracts,
                SUM(COALESCE(contract_amount, 0)) as revenue
            FROM prod.fact_events
            WHERE event_day >= :start_date
                AND event_day <= :end_date
                AND platform IN ('facebook', 'instagram')
            GROUP BY DATE(event_day), platform, campaign_name
            ORDER BY dt DESC, total_events DESC
        """

        result = await session.execute(
            text(query_text),
            {"start_date": start_date, "end_date": end_date}
        )
        rows = result.fetchall()

        return [
            {
                "dt": str(row.dt),
                "platform": row.platform,
                "campaign_name": row.campaign_name,
                "total_events": row.total_events,
                "unique_clients": row.unique_clients,
                "first_touch": row.first_touch,
                "mid_funnel": row.mid_funnel,
                "last_touch": row.last_touch,
                "contracts": row.contracts,
                "revenue": float(row.revenue) if row.revenue else 0.0,
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"Error fetching Facebook funnel: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch Facebook funnel: {str(e)}")


# ============================================================================
# GOOGLE FULL FUNNEL
# ============================================================================

@router.get("/campaigns/google/funnel")
async def get_google_funnel(
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Google full funnel - ALL 84 Google events

    Shows:
    - All Google touchpoints in customer journey
    - Campaign-level breakdown
    - First touch vs mid-funnel vs last touch
    - Conversion metrics

    Source: prod.fact_events WHERE platform = 'google'
    """
    try:
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()

        query_text = """
            SELECT
                DATE(event_day) as dt,
                campaign_name,
                COUNT(*) as total_events,
                COUNT(DISTINCT client_id) as unique_clients,
                SUM(CASE WHEN is_first_touch THEN 1 ELSE 0 END) as first_touch,
                SUM(CASE WHEN NOT is_first_touch AND NOT is_last_touch THEN 1 ELSE 0 END) as mid_funnel,
                SUM(CASE WHEN is_last_touch THEN 1 ELSE 0 END) as last_touch,
                SUM(CASE WHEN is_contract THEN 1 ELSE 0 END) as contracts,
                SUM(COALESCE(contract_amount, 0)) as revenue
            FROM prod.fact_events
            WHERE event_day >= :start_date
                AND event_day <= :end_date
                AND platform = 'google'
            GROUP BY DATE(event_day), campaign_name
            ORDER BY dt DESC, total_events DESC
        """

        result = await session.execute(
            text(query_text),
            {"start_date": start_date, "end_date": end_date}
        )
        rows = result.fetchall()

        return [
            {
                "dt": str(row.dt),
                "campaign_name": row.campaign_name,
                "total_events": row.total_events,
                "unique_clients": row.unique_clients,
                "first_touch": row.first_touch,
                "mid_funnel": row.mid_funnel,
                "last_touch": row.last_touch,
                "contracts": row.contracts,
                "revenue": float(row.revenue) if row.revenue else 0.0,
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"Error fetching Google funnel: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch Google funnel: {str(e)}")


# ============================================================================
# SUMMARY STATS
# ============================================================================

@router.get("/summary/prod")
async def get_prod_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    PROD schema summary statistics

    Returns:
    - Total events, contracts, revenue
    - Platform breakdown
    - Full funnel vs first-touch comparison
    """
    try:
        query_text = """
            SELECT
                COUNT(*) as total_events,
                COUNT(DISTINCT client_id) as unique_clients,
                SUM(CASE WHEN is_first_touch THEN 1 ELSE 0 END) as first_touch_events,
                SUM(CASE WHEN is_contract THEN 1 ELSE 0 END) as contracts,
                SUM(COALESCE(contract_amount, 0)) as total_revenue,
                COUNT(DISTINCT platform) as unique_platforms
            FROM prod.fact_events
        """

        result = await session.execute(text(query_text))
        row = result.fetchone()

        return {
            "total_events": row.total_events,
            "unique_clients": row.unique_clients,
            "first_touch_events": row.first_touch_events,
            "mid_and_last_touch_events": row.total_events - row.first_touch_events,
            "contracts": row.contracts,
            "total_revenue": float(row.total_revenue) if row.total_revenue else 0.0,
            "unique_platforms": row.unique_platforms,
            "data_multiplier": round(row.total_events / row.first_touch_events, 2) if row.first_touch_events > 0 else 0,
        }

    except Exception as e:
        logger.error(f"Error fetching prod summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch prod summary: {str(e)}")
