"""
UTM Sources endpoint for Data Analytics
Source: dashboards.v7_contracts_with_attribution (includes ALL leads + contract attribution)
"""
import logging
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.schemas.data_analytics import UTMSourcesResponse, UTMSourceItem
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/utm-sources", response_model=UTMSourcesResponse)
async def get_utm_sources(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        "google,meta,email",
        description="Comma-separated platforms (google,meta,email)"
    ),
    limit: Optional[int] = Query(1000, description="Results limit"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get UTM sources aggregated metrics for the period

    Returns: Array of utm sources with platform, utm_source, leads, contracts, revenue, spend
    Note: spend is typically 0 for UTM sources by design
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        query = text(f"""
            WITH lead_counts AS (
                SELECT
                    COALESCE(platform, 'Unknown') as platform,
                    COALESCE(utm_source, 'direct') as utm_source,
                    COUNT(DISTINCT id_source) AS leads,
                    COUNT(DISTINCT contract_id) AS n_contracts,
                    SUM(COALESCE(contract_amount, 0)) AS revenue
                FROM dashboards.v7_contracts_with_attribution
                WHERE request_date BETWEEN :date_from AND :date_to
                    {platform_filter}
                GROUP BY COALESCE(platform, 'Unknown'), COALESCE(utm_source, 'direct')
            )
            SELECT
                platform,
                utm_source,
                leads,
                n_contracts,
                revenue,
                0.0 AS spend
            FROM lead_counts
            WHERE leads > 0
            ORDER BY leads DESC
            LIMIT :limit
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit or 1000,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            UTMSourceItem(
                platform=row[0],
                utm_source=row[1],
                leads=int(row[2] or 0),
                n_contracts=int(row[3] or 0),
                revenue=float(row[4] or 0.0),
                spend=float(row[5] or 0.0),
            )
            for row in rows
        ]

        return UTMSourcesResponse(data=data)

    except Exception as e:
        logger.error(f"Error fetching UTM sources: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch UTM sources: {str(e)}")
