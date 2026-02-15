"""
Creatives endpoint - Creative library with images
"""
import logging
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.schemas.ads import CreativeLibraryResponse, CreativeLibraryItem
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/creatives", response_model=CreativeLibraryResponse)
async def get_creatives(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platform: Optional[str] = Query("facebook", description="facebook or google"),
    campaign_id: Optional[str] = Query(None, description="Filter by campaign"),
    has_image: Optional[bool] = Query(None, description="true to show only ads with images"),
    sort: Optional[str] = Query("best_roas", description="best_roas, most_leads, lowest_cpl, recent"),
    limit: Optional[int] = Query(50, description="Results limit"),
    offset: Optional[int] = Query(0, description="Results offset for pagination"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get creative library with images

    Returns: Array of ads with creative images and performance metrics
    """
    try:
        # Only Facebook has creative images
        if platform.lower() != "facebook":
            return CreativeLibraryResponse(data=[], total=0, has_more=False)

        # Build filters
        campaign_filter = ""
        if campaign_id:
            campaign_filter = "AND campaign_id = :campaign_id"

        image_filter = ""
        if has_image:
            image_filter = "AND media_image_src IS NOT NULL"

        # Build sort clause
        sort_column = {
            "best_roas": "roas DESC NULLS LAST",
            "most_leads": "crm_leads DESC",
            "lowest_cpl": "cpl ASC NULLS LAST",
            "recent": "dt DESC"
        }.get(sort, "roas DESC NULLS LAST")

        query = text(f"""
            WITH ad_aggregates AS (
                SELECT
                    ad_id,
                    ad_name,
                    campaign_id,
                    campaign_name,
                    MAX(media_image_src) as media_image_src,
                    MAX(thumbnail_url) as thumbnail_url,
                    MAX(creative_title) as title,
                    SUM(crm_leads) as crm_leads,
                    SUM(contracts) as contracts,
                    SUM(revenue) as revenue,
                    SUM(spend) as spend,
                    AVG(roas) as roas,
                    AVG(cpl) as cpl,
                    MAX(dt) as dt
                FROM dashboards.v6_fb_ads_performance
                WHERE dt BETWEEN :date_from AND :date_to
                    {campaign_filter}
                    {image_filter}
                GROUP BY ad_id, ad_name, campaign_id, campaign_name
            )
            SELECT
                ad_id,
                ad_name,
                campaign_name,
                campaign_id,
                media_image_src,
                thumbnail_url,
                title,
                crm_leads,
                contracts,
                revenue,
                spend,
                roas,
                cpl
            FROM ad_aggregates
            ORDER BY {sort_column}
            LIMIT :limit
            OFFSET :offset
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit,
            "offset": offset
        }
        if campaign_id:
            params["campaign_id"] = campaign_id

        result = await session.execute(query, params)
        rows = result.fetchall()

        data = [
            CreativeLibraryItem(
                ad_id=row[0],
                ad_name=row[1],
                campaign_name=row[2],
                campaign_id=row[3],
                media_image_src=row[4],
                thumbnail_url=row[5],
                title=row[6],
                crm_leads=int(row[7] or 0),
                contracts=int(row[8] or 0),
                revenue=float(row[9] or 0),
                spend=float(row[10] or 0),
                roas=float(row[11]) if row[11] is not None else None,
                cpl=float(row[12]) if row[12] is not None else None
            )
            for row in rows
        ]

        # Get total count for pagination
        count_query = text(f"""
            SELECT COUNT(DISTINCT ad_id)
            FROM dashboards.v6_fb_ads_performance
            WHERE dt BETWEEN :date_from AND :date_to
                {campaign_filter}
                {image_filter}
        """)

        count_params = {
            "date_from": date_from,
            "date_to": date_to
        }
        if campaign_id:
            count_params["campaign_id"] = campaign_id

        count_result = await session.execute(count_query, count_params)
        total_count = count_result.scalar() or 0

        return CreativeLibraryResponse(
            data=data,
            total=int(total_count),
            has_more=(offset + len(data)) < total_count
        )

    except Exception as e:
        logger.error(f"Error fetching creatives: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch creatives: {str(e)}")
