"""
Paid vs Organic Split endpoints
Analyzes paid advertising vs organic traffic
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from liderix_api.db import get_itstep_session
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

router = APIRouter()


@router.get("/platforms")
async def get_paid_split_platforms(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get paid vs organic split by platform.

    Data sources:
    - Paid: dashboards.v5_bi_platform_daily
    - Organic: dashboards.fact_leads (where spend = 0 or utm_source is organic)
    """

    query = text("""
        WITH paid_leads AS (
            SELECT
                platform,
                SUM(leads) as leads,
                'paid' as source_type
            FROM dashboards.v5_bi_platform_daily
            WHERE dt >= :date_from AND dt <= :date_to
            GROUP BY platform
        ),
        organic_leads AS (
            SELECT
                CASE
                    WHEN utm_medium ILIKE '%organic%' OR utm_source ILIKE '%organic%' THEN 'google'
                    WHEN utm_source ILIKE '%facebook%' OR utm_source ILIKE '%instagram%' THEN 'meta'
                    ELSE 'other'
                END as platform,
                COUNT(*) as leads,
                'organic' as source_type
            FROM dashboards.fact_leads
            WHERE row_created_at::date >= :date_from
              AND row_created_at::date <= :date_to
              AND (
                  utm_medium ILIKE '%organic%'
                  OR utm_source ILIKE '%organic%'
                  OR (utm_campaign IS NULL AND utm_source IS NULL)
              )
            GROUP BY
                CASE
                    WHEN utm_medium ILIKE '%organic%' OR utm_source ILIKE '%organic%' THEN 'google'
                    WHEN utm_source ILIKE '%facebook%' OR utm_source ILIKE '%instagram%' THEN 'meta'
                    ELSE 'other'
                END
        ),
        combined AS (
            SELECT * FROM paid_leads
            UNION ALL
            SELECT * FROM organic_leads
        )
        SELECT
            platform,
            source_type,
            SUM(leads) as leads
        FROM combined
        WHERE platform IN ('google', 'meta')
        GROUP BY platform, source_type
        ORDER BY platform, source_type
    """)

    result = await session.execute(query, {"date_from": date_from, "date_to": date_to})
    rows = result.mappings().all()

    # Calculate totals and percentages
    platform_totals = {}
    for row in rows:
        platform = row["platform"]
        if platform not in platform_totals:
            platform_totals[platform] = {"paid": 0, "organic": 0}
        platform_totals[platform][row["source_type"]] = row["leads"]

    data = []
    for platform, values in platform_totals.items():
        total = values["paid"] + values["organic"]
        paid_pct = (values["paid"] / total * 100) if total > 0 else 0
        organic_pct = (values["organic"] / total * 100) if total > 0 else 0

        data.append({
            "platform": platform,
            "paid_leads": values["paid"],
            "organic_leads": values["organic"],
            "total_leads": total,
            "paid_pct": round(paid_pct, 2),
            "organic_pct": round(organic_pct, 2),
        })

    return {"data": sorted(data, key=lambda x: x["total_leads"], reverse=True)}


@router.get("/campaigns")
async def get_paid_split_campaigns(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platform: str = Query(..., description="Platform (google/meta)"),
    limit: int = Query(20, description="Limit results"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get paid vs organic split by campaigns for a specific platform.

    Data sources:
    - Paid: dashboards.v5_leads_campaign_daily
    - Organic: dashboards.fact_leads grouped by utm_campaign
    """

    if platform.lower() not in ["google", "meta"]:
        return {"data": []}

    # Calculate limit value in Python to avoid parameter binding issue
    query_limit = limit * 2

    query = text(f"""
        WITH paid_campaigns AS (
            SELECT
                platform,
                campaign_id,
                campaign_name,
                SUM(leads) as leads,
                SUM(spend) as spend,
                'paid' as source_type
            FROM dashboards.v5_leads_campaign_daily
            WHERE dt >= :date_from
              AND dt <= :date_to
              AND platform = :platform
            GROUP BY platform, campaign_id, campaign_name
        ),
        organic_campaigns AS (
            SELECT
                :platform as platform,
                COALESCE(utm_campaign, '(not set)') as campaign_id,
                COALESCE(utm_campaign, '(not set)') as campaign_name,
                COUNT(*) as leads,
                0.0 as spend,
                'organic' as source_type
            FROM dashboards.fact_leads
            WHERE row_created_at::date >= :date_from
              AND row_created_at::date <= :date_to
              AND (
                  utm_medium ILIKE '%organic%'
                  OR (utm_campaign IS NOT NULL AND utm_source ILIKE :source_pattern)
              )
            GROUP BY utm_campaign
        )
        SELECT
            platform,
            campaign_id,
            campaign_name,
            source_type,
            leads,
            spend
        FROM paid_campaigns
        UNION ALL
        SELECT
            platform,
            campaign_id,
            campaign_name,
            source_type,
            leads,
            spend
        FROM organic_campaigns
        ORDER BY leads DESC
        LIMIT {query_limit}
    """)

    source_pattern = "%facebook%" if platform.lower() == "meta" else "%google%"

    result = await session.execute(
        query,
        {
            "date_from": date_from,
            "date_to": date_to,
            "platform": platform.lower(),
            "source_pattern": source_pattern,
        },
    )
    rows = result.mappings().all()

    return {
        "data": [
            {
                "platform": row["platform"],
                "campaign_id": row["campaign_id"],
                "campaign_name": row["campaign_name"],
                "source_type": row["source_type"],
                "leads": row["leads"],
                "spend": float(row["spend"]) if row["spend"] else 0.0,
            }
            for row in rows[:limit]
        ]
    }
