from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class AdsDailyItem(BaseModel):
    date: date
    spend: float
    clicks: int
    impressions: int
    ctr: float
    cpc: float
    cpm: float


class AdsCampaignItem(BaseModel):
    campaign_id: str
    campaign_name: Optional[str]
    spend: float
    clicks: int
    conversions: int
    ctr: float
    cpc: float
    cpa: float


class AdsAdGroupItem(BaseModel):
    ad_group_id: str
    ad_group_name: str
    spend: float
    clicks: int
    conversions: int
    ctr: float
    cpc: float
    cpa: float


class AdsPlatformItem(BaseModel):
    platform: str
    spend: float
    impressions: int
    clicks: int
    conversions: int
    ctr: float
    cpc: float
    cpa: float


class AdsUtmItem(BaseModel):
    date: date
    utm_source: str
    utm_medium: str
    utm_campaign: str
    sessions: int
    conversions: int
    spend: float
    conv_rate: float
    cpa: Optional[float]
    cps: Optional[float]


class AdsAnalyticsResponse(BaseModel):
    daily: List[AdsDailyItem]
    campaigns: List[AdsCampaignItem]
    adGroups: List[AdsAdGroupItem]
    platforms: List[AdsPlatformItem]
    utm: List[AdsUtmItem]


# ============================================================================
# Schemas for real ads management from ITstep analytics database
# ============================================================================

from typing import Literal
from pydantic import Field


class AdMetrics(BaseModel):
    """Metrics for an individual advertisement."""
    impressions: int = Field(..., description="Total number of ad impressions")
    clicks: int = Field(..., description="Total number of ad clicks")
    spend: float = Field(..., description="Total ad spend in UAH")
    ctr: float = Field(..., description="Click-through rate as percentage")
    cpc: float = Field(..., description="Cost per click in UAH")
    conversions: Optional[int] = Field(0, description="Number of conversions")
    cpa: Optional[float] = Field(0.0, description="Cost per acquisition in UAH")
    roas: Optional[float] = Field(0.0, description="Return on ad spend multiplier")


class AdRead(BaseModel):
    """Advertisement data from ITstep analytics."""
    ad_id: str = Field(..., description="Unique ad identifier")
    ad_name: str = Field(..., description="Ad name/title")
    campaign_id: str = Field(..., description="Parent campaign ID")
    campaign_name: Optional[str] = Field(None, description="Parent campaign name")
    platform: Literal['google', 'meta'] = Field('meta', description="Advertising platform")
    type: Literal['search', 'display', 'video', 'shopping', 'social'] = Field(
        'social',
        description="Ad type"
    )
    status: Literal['active', 'paused', 'draft', 'expired'] = Field(
        'active',
        description="Current ad status"
    )
    metrics: AdMetrics = Field(..., description="Ad performance metrics")
    date_start: date = Field(..., description="Ad start date")
    date_stop: date = Field(..., description="Ad end date")


class AdStatsResponse(BaseModel):
    """Aggregated statistics for advertisements."""
    total_ads: int = Field(..., description="Total number of ads")
    total_campaigns: int = Field(..., description="Total number of campaigns")
    total_impressions: int = Field(..., description="Total impressions across all ads")
    total_clicks: int = Field(..., description="Total clicks across all ads")
    total_spend: float = Field(..., description="Total spend in UAH")
    avg_ctr: float = Field(..., description="Average CTR percentage")
    avg_cpc: float = Field(..., description="Average CPC in UAH")


class CampaignMetrics(BaseModel):
    """Metrics for a marketing campaign."""
    impressions: int = Field(..., description="Total impressions")
    clicks: int = Field(..., description="Total clicks")
    spend: float = Field(..., description="Total spend in UAH")
    leads: int = Field(..., description="Total leads generated")
    cpl: float = Field(..., description="Cost per lead in UAH")
    ctr: float = Field(..., description="Click-through rate as percentage")
    conversions: Optional[int] = Field(0, description="Number of conversions")
    roas: Optional[float] = Field(0.0, description="Return on ad spend")


class CampaignRead(BaseModel):
    """Marketing campaign data from ITstep analytics."""
    campaign_id: str = Field(..., description="Unique campaign identifier")
    campaign_name: str = Field(..., description="Campaign name")
    platform: Literal['google', 'meta'] = Field(..., description="Advertising platform")
    type: Literal['email', 'social', 'ppc', 'content', 'seo', 'influencer'] = Field(
        'ppc',
        description="Campaign type"
    )
    status: Literal['draft', 'active', 'paused', 'completed', 'cancelled'] = Field(
        'active',
        description="Current campaign status"
    )
    days_active: int = Field(..., description="Number of days campaign has been active")
    metrics: CampaignMetrics = Field(..., description="Campaign performance metrics")
    budget: Optional[float] = Field(None, description="Campaign budget in UAH")
    target_audience: Optional[str] = Field(None, description="Target audience description")


class CampaignStatsResponse(BaseModel):
    """Aggregated statistics for campaigns."""
    total_campaigns: int = Field(..., description="Total number of campaigns")
    active_campaigns: int = Field(..., description="Number of active campaigns")
    total_spend: float = Field(..., description="Total spend in UAH")
    total_leads: int = Field(..., description="Total leads generated")
    avg_cpl: float = Field(..., description="Average cost per lead in UAH")
    avg_ctr: float = Field(..., description="Average CTR percentage")


# ============================================================================
# New Ads Analytics Schemas (v6 with creative visualization)
# ============================================================================

class AdsOverviewResponse(BaseModel):
    """Summary KPIs for ads across platforms"""
    total_spend: float
    total_impressions: int
    total_clicks: int
    crm_leads: int
    platform_leads: int
    contracts: int
    revenue: float
    roas: Optional[float] = None
    cpl: Optional[float] = None
    ctr: Optional[float] = None
    conversion_rate: Optional[float] = None
    match_rate: Optional[float] = None


class CampaignPerformanceItem(BaseModel):
    """Campaign-level performance metrics"""
    platform: str
    campaign_id: str
    campaign_name: Optional[str] = None
    campaign_status: Optional[str] = None
    spend: float
    impressions: int
    clicks: int
    crm_leads: int
    platform_leads: Optional[int] = None
    contracts: int
    revenue: float
    roas: Optional[float] = None
    cpl: Optional[float] = None
    ctr: Optional[float] = None
    conversion_rate: Optional[float] = None
    match_rate: Optional[float] = None
    ad_count: Optional[int] = None


class CampaignsResponse(BaseModel):
    """List of campaigns with performance metrics"""
    data: List[CampaignPerformanceItem]
    total: int


class AdCreativeInfo(BaseModel):
    """Creative details for an ad"""
    ad_creative_id: Optional[str] = None
    media_image_src: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_id: Optional[str] = None
    permalink_url: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    description: Optional[str] = None
    cta_type: Optional[str] = None
    link_url: Optional[str] = None


class AdPerformanceItem(BaseModel):
    """Ad-level performance metrics"""
    ad_id: str
    ad_name: Optional[str] = None
    ad_status: Optional[str] = None
    adset_id: Optional[str] = None
    adset_name: Optional[str] = None
    campaign_id: str
    campaign_name: Optional[str] = None
    spend: float
    impressions: int
    clicks: int
    crm_leads: int
    platform_leads: Optional[int] = None
    contracts: int
    revenue: float
    roas: Optional[float] = None
    cpl: Optional[float] = None
    ctr: Optional[float] = None
    conversion_rate: Optional[float] = None
    match_rate: Optional[float] = None
    creative: Optional[AdCreativeInfo] = None


class AdsByCampaignResponse(BaseModel):
    """Ads grouped by campaign"""
    campaign: CampaignPerformanceItem
    ads: List[AdPerformanceItem]
    total_ads: int


class CreativeLibraryItem(BaseModel):
    """Creative card for library view"""
    ad_id: str
    ad_name: Optional[str] = None
    campaign_name: Optional[str] = None
    campaign_id: str
    media_image_src: Optional[str] = None
    thumbnail_url: Optional[str] = None
    title: Optional[str] = None
    crm_leads: int
    contracts: int
    revenue: float
    spend: float
    roas: Optional[float] = None
    cpl: Optional[float] = None


class CreativeLibraryResponse(BaseModel):
    """Creative library with pagination"""
    data: List[CreativeLibraryItem]
    total: int
    has_more: bool