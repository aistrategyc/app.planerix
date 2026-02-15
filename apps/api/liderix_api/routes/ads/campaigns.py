"""
Campaigns endpoints - Campaign and ad-level performance data
"""
import logging
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.schemas.ads import (
    CampaignsResponse,
    CampaignPerformanceItem,
    AdsByCampaignResponse,
    AdPerformanceItem,
    AdCreativeInfo
)
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/campaigns", response_model=CampaignsResponse)
async def get_campaigns(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platform: Optional[str] = Query(None, description="facebook, google, or empty for both"),
    status: Optional[str] = Query(None, description="ACTIVE, PAUSED, ALL"),
    sort: Optional[str] = Query("spend", description="spend, leads, roas, cpl"),
    limit: Optional[int] = Query(100, description="Results limit"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get campaigns aggregated metrics for the period

    Returns: Array of campaigns with platform, campaign_id, campaign_name, metrics
    """
    try:
        # Build platform filter
        platform_filter = ""
        if platform and platform.lower() in ["facebook", "google"]:
            platform_filter = f"AND platform = '{platform.lower()}'"

        # Build status filter
        status_filter = ""
        if status and status.upper() != "ALL":
            status_filter = f"AND campaign_status = '{status.upper()}'"

        # Build sort clause
        sort_column = {
            "spend": "total_spend",
            "leads": "total_crm_leads",
            "roas": "roas",
            "cpl": "cpl"
        }.get(sort, "total_spend")

        query = text(f"""
            WITH all_campaigns AS (
                SELECT
                    CASE
                        WHEN platform = 'Meta' THEN 'facebook'
                        WHEN platform = 'Google Ads' THEN 'google'
                        ELSE LOWER(platform)
                    END as platform,
                    campaign_id,
                    campaign_name,
                    'ACTIVE' as campaign_status,
                    SUM(spend) as spend,
                    SUM(impressions) as impressions,
                    SUM(clicks) as clicks,
                    SUM(leads) as crm_leads,
                    SUM(ad_conversions) as platform_leads,
                    SUM(contracts) as contracts,
                    SUM(revenue) as revenue,
                    0 as ad_count
                FROM dashboards.v8_campaigns_daily_full
                WHERE dt BETWEEN :date_from AND :date_to
                    AND platform IN ('Meta', 'Google Ads')
                GROUP BY platform, campaign_id, campaign_name
            )
            SELECT
                platform,
                campaign_id,
                campaign_name,
                campaign_status,
                spend as total_spend,
                impressions as total_impressions,
                clicks as total_clicks,
                crm_leads as total_crm_leads,
                platform_leads as total_platform_leads,
                contracts as total_contracts,
                revenue as total_revenue,
                ad_count,
                CASE WHEN spend > 0 THEN revenue / spend END as roas,
                CASE WHEN crm_leads > 0 THEN spend / crm_leads END as cpl,
                CASE WHEN impressions > 0 THEN (100.0 * clicks / impressions) END as ctr,
                CASE WHEN crm_leads > 0 THEN (100.0 * contracts / crm_leads) END as conversion_rate,
                CASE WHEN platform_leads > 0 THEN (100.0 * crm_leads / platform_leads) END as match_rate
            FROM all_campaigns
            WHERE 1=1
                {platform_filter}
                {status_filter}
            ORDER BY {sort_column} DESC NULLS LAST
            LIMIT :limit
        """)

        result = await session.execute(query, {
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit
        })
        rows = result.fetchall()

        data = [
            CampaignPerformanceItem(
                platform=row[0],
                campaign_id=row[1],
                campaign_name=row[2],
                campaign_status=row[3],
                spend=float(row[4] or 0),
                impressions=int(row[5] or 0),
                clicks=int(row[6] or 0),
                crm_leads=int(row[7] or 0),
                platform_leads=int(row[8] or 0) if row[8] else None,
                contracts=int(row[9] or 0),
                revenue=float(row[10] or 0),
                ad_count=int(row[11] or 0) if row[11] else None,
                roas=float(row[12]) if row[12] is not None else None,
                cpl=float(row[13]) if row[13] is not None else None,
                ctr=float(row[14]) if row[14] is not None else None,
                conversion_rate=float(row[15]) if row[15] is not None else None,
                match_rate=float(row[16]) if row[16] is not None else None
            )
            for row in rows
        ]

        return CampaignsResponse(data=data, total=len(data))

    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch campaigns: {str(e)}")


@router.get("/campaigns/{campaign_id}/ads", response_model=AdsByCampaignResponse)
async def get_ads_by_campaign(
    campaign_id: str,
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platform: str = Query(..., description="facebook or google"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get ad-level breakdown for a specific campaign

    Returns: Campaign summary + array of ads with creative info
    """
    try:
        # First get campaign summary
        if platform.lower() == "facebook":
            campaign_query = text("""
                SELECT
                    'facebook' as platform,
                    campaign_id,
                    campaign_name,
                    campaign_status,
                    SUM(spend) as spend,
                    SUM(impressions) as impressions,
                    SUM(clicks) as clicks,
                    SUM(crm_leads) as crm_leads,
                    SUM(platform_leads) as platform_leads,
                    SUM(contracts) as contracts,
                    SUM(revenue) as revenue,
                    COUNT(DISTINCT ad_id) as ad_count
                FROM dashboards.v6_fb_ads_performance
                WHERE campaign_id = :campaign_id
                  AND dt BETWEEN :date_from AND :date_to
                GROUP BY campaign_id, campaign_name, campaign_status
            """)
        else:
            campaign_query = text("""
                SELECT
                    'google' as platform,
                    campaign_id,
                    campaign_name,
                    campaign_status,
                    SUM(spend) as spend,
                    SUM(impressions) as impressions,
                    SUM(clicks) as clicks,
                    SUM(crm_leads) as crm_leads,
                    0 as platform_leads,
                    SUM(contracts) as contracts,
                    SUM(revenue) as revenue,
                    0 as ad_count
                FROM dashboards.v6_google_ads_performance
                WHERE campaign_id = :campaign_id
                  AND dt BETWEEN :date_from AND :date_to
                GROUP BY campaign_id, campaign_name, campaign_status
            """)

        campaign_result = await session.execute(campaign_query, {
            "campaign_id": campaign_id,
            "date_from": date_from,
            "date_to": date_to
        })
        campaign_row = campaign_result.fetchone()

        if not campaign_row:
            raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")

        campaign = CampaignPerformanceItem(
            platform=campaign_row[0],
            campaign_id=campaign_row[1],
            campaign_name=campaign_row[2],
            campaign_status=campaign_row[3],
            spend=float(campaign_row[4] or 0),
            impressions=int(campaign_row[5] or 0),
            clicks=int(campaign_row[6] or 0),
            crm_leads=int(campaign_row[7] or 0),
            platform_leads=int(campaign_row[8] or 0) if campaign_row[8] else None,
            contracts=int(campaign_row[9] or 0),
            revenue=float(campaign_row[10] or 0),
            ad_count=int(campaign_row[11] or 0) if campaign_row[11] else None
        )

        # Now get ads for this campaign (only Facebook has ad-level data)
        ads_data = []
        if platform.lower() == "facebook":
            ads_query = text("""
                SELECT
                    ad_id,
                    ad_name,
                    ad_status,
                    adset_id,
                    adset_name,
                    campaign_id,
                    campaign_name,
                    SUM(spend) as spend,
                    SUM(impressions) as impressions,
                    SUM(clicks) as clicks,
                    SUM(crm_leads) as crm_leads,
                    SUM(platform_leads) as platform_leads,
                    SUM(contracts) as contracts,
                    SUM(revenue) as revenue,
                    AVG(roas) as roas,
                    AVG(cpl) as cpl,
                    AVG(ctr) as ctr,
                    AVG(conversion_rate) as conversion_rate,
                    AVG(match_rate) as match_rate,
                    MAX(ad_creative_id) as ad_creative_id,
                    MAX(media_image_src) as media_image_src,
                    MAX(thumbnail_url) as thumbnail_url,
                    MAX(video_id) as video_id,
                    MAX(permalink_url) as permalink_url,
                    MAX(creative_title) as creative_title,
                    MAX(creative_body) as creative_body,
                    MAX(creative_description) as creative_description,
                    MAX(cta_type) as cta_type,
                    MAX(link_url) as link_url
                FROM dashboards.v6_fb_ads_performance
                WHERE campaign_id = :campaign_id
                  AND dt BETWEEN :date_from AND :date_to
                GROUP BY ad_id, ad_name, ad_status, adset_id, adset_name, campaign_id, campaign_name
                ORDER BY SUM(crm_leads) DESC
            """)

            ads_result = await session.execute(ads_query, {
                "campaign_id": campaign_id,
                "date_from": date_from,
                "date_to": date_to
            })
            ads_rows = ads_result.fetchall()

            ads_data = [
                AdPerformanceItem(
                    ad_id=row[0],
                    ad_name=row[1],
                    ad_status=row[2],
                    adset_id=row[3],
                    adset_name=row[4],
                    campaign_id=row[5],
                    campaign_name=row[6],
                    spend=float(row[7] or 0),
                    impressions=int(row[8] or 0),
                    clicks=int(row[9] or 0),
                    crm_leads=int(row[10] or 0),
                    platform_leads=int(row[11] or 0) if row[11] else None,
                    contracts=int(row[12] or 0),
                    revenue=float(row[13] or 0),
                    roas=float(row[14]) if row[14] is not None else None,
                    cpl=float(row[15]) if row[15] is not None else None,
                    ctr=float(row[16]) if row[16] is not None else None,
                    conversion_rate=float(row[17]) if row[17] is not None else None,
                    match_rate=float(row[18]) if row[18] is not None else None,
                    creative=AdCreativeInfo(
                        ad_creative_id=row[19],
                        media_image_src=row[20],
                        thumbnail_url=row[21],
                        video_id=row[22],
                        permalink_url=row[23],
                        title=row[24],
                        body=row[25],
                        description=row[26],
                        cta_type=row[27],
                        link_url=row[28]
                    ) if row[19] else None
                )
                for row in ads_rows
            ]

        return AdsByCampaignResponse(
            campaign=campaign,
            ads=ads_data,
            total_ads=len(ads_data)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching ads by campaign: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch ads: {str(e)}")
