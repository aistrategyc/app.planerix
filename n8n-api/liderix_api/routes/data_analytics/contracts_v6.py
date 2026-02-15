# apps/api/liderix_api/routes/data_analytics/contracts_v6.py
"""
Contracts Attribution endpoints v6 for Data Analytics dashboard
Real ITstep data - Attribution coverage, detail, by creative/campaign, timeline
Updated: October 14, 2025
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, date
from typing import Optional

from liderix_api.db import get_itstep_session

router = APIRouter(tags=["Data Analytics v6 - Contracts"])


def parse_date(date_str: str) -> date:
    """Convert string date 'YYYY-MM-DD' to date object for asyncpg"""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


@router.get("/attribution/coverage")
async def get_attribution_coverage(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_itstep_session)
):
    """
    Get attribution coverage statistics
    Shows % of contracts/leads with full attribution
    """
    try:
        coverage_query = text("""
            SELECT
                -- Total counts
                COUNT(*) as total_leads,
                COUNT(CASE WHEN contract_amount > 0 THEN 1 END) as total_contracts,

                -- Platform attribution
                COUNT(CASE WHEN dominant_platform IS NOT NULL THEN 1 END) as with_platform,
                COUNT(CASE WHEN utm_source IS NOT NULL THEN 1 END) as with_utm,

                -- Meta attribution levels
                COUNT(CASE WHEN meta_campaign_id IS NOT NULL THEN 1 END) as with_meta_campaign,
                COUNT(CASE WHEN meta_adset_id IS NOT NULL THEN 1 END) as with_meta_adset,
                COUNT(CASE WHEN meta_ad_id IS NOT NULL THEN 1 END) as with_meta_ad,
                COUNT(CASE WHEN meta_creative_id IS NOT NULL THEN 1 END) as with_meta_creative,

                -- Google attribution levels
                COUNT(CASE WHEN google_campaign_id IS NOT NULL THEN 1 END) as with_google_campaign,
                COUNT(CASE WHEN google_ad_group_id IS NOT NULL THEN 1 END) as with_google_adgroup,
                COUNT(CASE WHEN google_keyword_text IS NOT NULL THEN 1 END) as with_google_keyword,

                -- Contract attribution
                COUNT(CASE WHEN contract_amount > 0 AND meta_creative_id IS NOT NULL THEN 1 END) as contracts_with_creative,
                COUNT(CASE WHEN contract_amount > 0 AND meta_campaign_id IS NOT NULL THEN 1 END) as contracts_with_meta,
                COUNT(CASE WHEN contract_amount > 0 AND google_campaign_id IS NOT NULL THEN 1 END) as contracts_with_google

            FROM dashboards.fact_leads
            WHERE created_date_txt::date >= :date_from
              AND created_date_txt::date <= :date_to
        """)

        result = await db.execute(
            coverage_query,
            {
                "date_from": parse_date(date_from),
                "date_to": parse_date(date_to)
            }
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="No data found")

        total_leads = row.total_leads or 1  # Prevent division by zero
        total_contracts = row.total_contracts or 1

        return {
            "totals": {
                "leads": int(row.total_leads or 0),
                "contracts": int(row.total_contracts or 0),
            },
            "leads_coverage": {
                "with_platform": int(row.with_platform or 0),
                "with_platform_pct": round(100.0 * (row.with_platform or 0) / total_leads, 2),
                "with_utm": int(row.with_utm or 0),
                "with_utm_pct": round(100.0 * (row.with_utm or 0) / total_leads, 2),
                "with_meta_campaign": int(row.with_meta_campaign or 0),
                "with_meta_campaign_pct": round(100.0 * (row.with_meta_campaign or 0) / total_leads, 2),
                "with_meta_creative": int(row.with_meta_creative or 0),
                "with_meta_creative_pct": round(100.0 * (row.with_meta_creative or 0) / total_leads, 2),
                "with_google_campaign": int(row.with_google_campaign or 0),
                "with_google_campaign_pct": round(100.0 * (row.with_google_campaign or 0) / total_leads, 2),
            },
            "contracts_coverage": {
                "with_creative": int(row.contracts_with_creative or 0),
                "with_creative_pct": round(100.0 * (row.contracts_with_creative or 0) / total_contracts, 2),
                "with_meta_campaign": int(row.contracts_with_meta or 0),
                "with_meta_campaign_pct": round(100.0 * (row.contracts_with_meta or 0) / total_contracts, 2),
                "with_google_campaign": int(row.contracts_with_google or 0),
                "with_google_campaign_pct": round(100.0 * (row.contracts_with_google or 0) / total_contracts, 2),
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Attribution coverage query failed: {str(e)}")


@router.get("/contracts/detail")
async def get_contracts_detail(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    platform: Optional[str] = Query(None, description="Filter by platform: meta, google, direct"),
    limit: int = Query(100, le=500, description="Max results"),
    db: AsyncSession = Depends(get_itstep_session)
):
    """
    Get detailed contracts with full attribution chain
    Returns: List of contracts with platform, Meta/Google attribution, lead form info
    """
    try:
        platform_filter = ""
        if platform:
            platform_filter = f"AND fl.dominant_platform = '{platform}'"

        contracts_query = text(f"""
            SELECT
                fl.id_source,
                fl.created_date_txt::date as contract_date,
                fl.contract_amount,

                -- Platform attribution
                fl.dominant_platform,
                fl.utm_source,
                fl.utm_campaign,
                fl.utm_medium,
                fl.is_paid,

                -- Meta attribution
                fl.meta_campaign_id,
                fl.meta_campaign_name,
                fl.meta_adset_id,
                fl.meta_adset_name,
                fl.meta_ad_id,
                fl.meta_ad_name,
                fl.meta_creative_id,

                -- Google attribution
                fl.google_campaign_id,
                fl.google_campaign_name,
                fl.google_ad_group_id,
                fl.google_ad_group_name,
                fl.google_keyword_text,

                -- Lead form data
                fl.form_name,
                fl.request_type,

                -- Attribution completeness flags
                CASE WHEN fl.meta_creative_id IS NOT NULL THEN true ELSE false END as has_creative_attr,
                CASE WHEN fl.meta_campaign_id IS NOT NULL THEN true ELSE false END as has_meta_campaign_attr,
                CASE WHEN fl.google_campaign_id IS NOT NULL THEN true ELSE false END as has_google_campaign_attr

            FROM dashboards.fact_leads fl
            WHERE fl.contract_amount > 0
                AND fl.created_date_txt::date >= :date_from
                AND fl.created_date_txt::date <= :date_to
                {platform_filter}
            ORDER BY fl.contract_amount DESC, fl.created_date_txt DESC
            LIMIT :limit
        """)

        result = await db.execute(
            contracts_query,
            {
                "date_from": parse_date(date_from),
                "date_to": parse_date(date_to),
                "limit": limit
            }
        )
        rows = result.fetchall()

        return [
            {
                "id_source": row.id_source,
                "contract_date": row.contract_date.isoformat(),
                "contract_amount": float(row.contract_amount or 0),
                "platform": row.dominant_platform,
                "utm_source": row.utm_source,
                "utm_campaign": row.utm_campaign,
                "utm_medium": row.utm_medium,
                "is_paid": row.is_paid,

                # Meta attribution chain
                "meta": {
                    "campaign_id": row.meta_campaign_id,
                    "campaign_name": row.meta_campaign_name,
                    "adset_id": row.meta_adset_id,
                    "adset_name": row.meta_adset_name,
                    "ad_id": row.meta_ad_id,
                    "ad_name": row.meta_ad_name,
                    "creative_id": row.meta_creative_id,
                } if row.meta_campaign_id else None,

                # Google attribution chain
                "google": {
                    "campaign_id": row.google_campaign_id,
                    "campaign_name": row.google_campaign_name,
                    "ad_group_id": row.google_ad_group_id,
                    "ad_group_name": row.google_ad_group_name,
                    "keyword": row.google_keyword_text,
                } if row.google_campaign_id else None,

                # Lead form
                "form_name": row.form_name,
                "request_type": row.request_type,

                # Attribution flags
                "attribution": {
                    "has_creative": row.has_creative_attr,
                    "has_meta_campaign": row.has_meta_campaign_attr,
                    "has_google_campaign": row.has_google_campaign_attr,
                }
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contracts detail query failed: {str(e)}")


@router.get("/contracts/by-creative")
async def get_contracts_by_creative(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    limit: int = Query(50, le=200, description="Max results"),
    db: AsyncSession = Depends(get_itstep_session)
):
    """
    Get contracts aggregated by creative (Meta only)
    Shows which specific creatives generated contracts
    """
    try:
        creative_contracts_query = text("""
            SELECT
                fl.meta_creative_id as creative_id,
                fl.meta_ad_name as ad_name,
                fl.meta_campaign_name,

                COUNT(*) as contracts_count,
                SUM(fl.contract_amount) as total_revenue,
                ROUND(AVG(fl.contract_amount), 2) as avg_contract_value,

                -- Also get lead stats
                (SELECT COUNT(*) FROM dashboards.fact_leads
                 WHERE meta_creative_id = fl.meta_creative_id
                   AND created_date_txt::date >= :date_from
                   AND created_date_txt::date <= :date_to
                ) as total_leads,

                MIN(fl.created_date_txt::date) as first_contract_date,
                MAX(fl.created_date_txt::date) as last_contract_date

            FROM dashboards.fact_leads fl
            WHERE fl.contract_amount > 0
                AND fl.meta_creative_id IS NOT NULL
                AND fl.created_date_txt::date >= :date_from
                AND fl.created_date_txt::date <= :date_to
            GROUP BY fl.meta_creative_id, fl.meta_ad_name, fl.meta_campaign_name
            ORDER BY total_revenue DESC
            LIMIT :limit
        """)

        result = await db.execute(
            creative_contracts_query,
            {
                "date_from": parse_date(date_from),
                "date_to": parse_date(date_to),
                "limit": limit
            }
        )
        rows = result.fetchall()

        return [
            {
                "creative_id": row.creative_id,
                "ad_name": row.ad_name,
                "campaign_name": row.meta_campaign_name,
                "contracts_count": int(row.contracts_count or 0),
                "total_revenue": float(row.total_revenue or 0),
                "avg_contract_value": float(row.avg_contract_value or 0),
                "total_leads": int(row.total_leads or 0),
                "cvr": round(100.0 * (row.contracts_count or 0) / (row.total_leads or 1), 2),
                "first_contract_date": row.first_contract_date.isoformat() if row.first_contract_date else None,
                "last_contract_date": row.last_contract_date.isoformat() if row.last_contract_date else None,
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contracts by creative query failed: {str(e)}")


@router.get("/contracts/by-campaign")
async def get_contracts_by_campaign(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    limit: int = Query(50, le=200, description="Max results"),
    db: AsyncSession = Depends(get_itstep_session)
):
    """
    Get contracts aggregated by campaign (all platforms)
    Shows which campaigns generated contracts with revenue details
    """
    try:
        platform_filter = ""
        if platform:
            platform_filter = f"AND fl.dominant_platform = '{platform}'"

        campaign_contracts_query = text(f"""
            WITH campaign_leads AS (
                SELECT
                    dominant_platform,
                    COALESCE(meta_campaign_name, google_campaign_name, 'Unknown') as campaign_name,
                    COUNT(*) as total_leads
                FROM dashboards.fact_leads
                WHERE created_date_txt::date >= :date_from
                  AND created_date_txt::date <= :date_to
                GROUP BY dominant_platform, COALESCE(meta_campaign_name, google_campaign_name, 'Unknown')
            )
            SELECT
                fl.dominant_platform as platform,
                COALESCE(fl.meta_campaign_name, fl.google_campaign_name, 'Unknown') as campaign_name,

                COUNT(*) as contracts_count,
                SUM(fl.contract_amount) as total_revenue,
                ROUND(AVG(fl.contract_amount), 2) as avg_contract_value,

                -- Lead stats from CTE
                COALESCE(cl.total_leads, 0) as total_leads,

                MIN(fl.created_date_txt::date) as first_contract_date,
                MAX(fl.created_date_txt::date) as last_contract_date

            FROM dashboards.fact_leads fl
            LEFT JOIN campaign_leads cl
                ON cl.dominant_platform = fl.dominant_platform
                AND cl.campaign_name = COALESCE(fl.meta_campaign_name, fl.google_campaign_name, 'Unknown')
            WHERE fl.contract_amount > 0
                AND fl.created_date_txt::date >= :date_from
                AND fl.created_date_txt::date <= :date_to
                {platform_filter}
            GROUP BY fl.dominant_platform, COALESCE(fl.meta_campaign_name, fl.google_campaign_name, 'Unknown'), cl.total_leads
            ORDER BY total_revenue DESC
            LIMIT :limit
        """)

        result = await db.execute(
            campaign_contracts_query,
            {
                "date_from": parse_date(date_from),
                "date_to": parse_date(date_to),
                "limit": limit
            }
        )
        rows = result.fetchall()

        return [
            {
                "platform": row.platform,
                "campaign_name": row.campaign_name,
                "contracts_count": int(row.contracts_count or 0),
                "total_revenue": float(row.total_revenue or 0),
                "avg_contract_value": float(row.avg_contract_value or 0),
                "total_leads": int(row.total_leads or 0),
                "cvr": round(100.0 * (row.contracts_count or 0) / (row.total_leads or 1), 2),
                "first_contract_date": row.first_contract_date.isoformat() if row.first_contract_date else None,
                "last_contract_date": row.last_contract_date.isoformat() if row.last_contract_date else None,
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contracts by campaign query failed: {str(e)}")


@router.get("/contracts/timeline")
async def get_contracts_timeline(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_itstep_session)
):
    """
    Get daily contracts timeline with revenue
    For trend visualization
    """
    try:
        timeline_query = text("""
            SELECT
                created_date_txt::date as date,
                COUNT(*) as contracts_count,
                SUM(contract_amount) as daily_revenue,
                ROUND(AVG(contract_amount), 2) as avg_contract_value,

                -- By platform breakdown
                COUNT(CASE WHEN dominant_platform = 'meta' THEN 1 END) as meta_contracts,
                COUNT(CASE WHEN dominant_platform = 'google' THEN 1 END) as google_contracts,
                COUNT(CASE WHEN dominant_platform = 'direct' THEN 1 END) as direct_contracts

            FROM dashboards.fact_leads
            WHERE contract_amount > 0
                AND created_date_txt::date >= :date_from
                AND created_date_txt::date <= :date_to
            GROUP BY created_date_txt::date
            ORDER BY date
        """)

        result = await db.execute(
            timeline_query,
            {
                "date_from": parse_date(date_from),
                "date_to": parse_date(date_to)
            }
        )
        rows = result.fetchall()

        return [
            {
                "date": row.date.isoformat(),
                "contracts_count": int(row.contracts_count or 0),
                "daily_revenue": float(row.daily_revenue or 0),
                "avg_contract_value": float(row.avg_contract_value or 0),
                "meta_contracts": int(row.meta_contracts or 0),
                "google_contracts": int(row.google_contracts or 0),
                "direct_contracts": int(row.direct_contracts or 0),
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contracts timeline query failed: {str(e)}")
