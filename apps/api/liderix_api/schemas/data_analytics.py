"""
Data Analytics schemas for ITstep client analytics
"""
from typing import Optional, List
from datetime import date
from pydantic import BaseModel, Field


# ============================================================================
# KPI Cards Schema
# ============================================================================
class KPICardsResponse(BaseModel):
    """KPI cards aggregated metrics"""
    leads: int
    n_contracts: int
    revenue: float
    spend: float
    cpl: Optional[float] = None
    roas: Optional[float] = None


class KPICompareResponse(BaseModel):
    """KPI cards with Period-over-Period comparison"""
    leads_cur: int
    leads_prev: int
    leads_diff: int
    leads_diff_pct: Optional[float] = None

    n_contracts_cur: int
    n_contracts_prev: int

    revenue_cur: float
    revenue_prev: float
    revenue_diff: float
    revenue_diff_pct: Optional[float] = None

    spend_cur: float
    spend_prev: float
    spend_diff: float
    spend_diff_pct: Optional[float] = None

    cpl_cur: Optional[float] = None
    cpl_prev: Optional[float] = None

    roas_cur: Optional[float] = None
    roas_prev: Optional[float] = None


# ============================================================================
# Trends Schemas
# ============================================================================
class LeadsTrendItem(BaseModel):
    """Single day leads trend"""
    dt: date
    leads: int


class SpendTrendItem(BaseModel):
    """Single day spend trend"""
    dt: date
    spend: float


class LeadsTrendResponse(BaseModel):
    """Leads trend response"""
    data: List[LeadsTrendItem]


class SpendTrendResponse(BaseModel):
    """Spend trend response"""
    data: List[SpendTrendItem]


class LeadsTrendCompareItem(BaseModel):
    """Single day leads trend with comparison"""
    dt: date
    leads_cur: int
    leads_prev_shifted: int


class SpendTrendCompareItem(BaseModel):
    """Single day spend trend with comparison"""
    dt: date
    spend_cur: float
    spend_prev_shifted: float


class LeadsTrendCompareResponse(BaseModel):
    """Leads trend compare response"""
    data: List[LeadsTrendCompareItem]


class SpendTrendCompareResponse(BaseModel):
    """Spend trend compare response"""
    data: List[SpendTrendCompareItem]


# ============================================================================
# Campaigns Schema
# ============================================================================
class CampaignItem(BaseModel):
    """Campaign aggregated metrics"""
    platform: str
    campaign_id: str
    campaign_name: str
    leads: int
    n_contracts: int
    revenue: float
    spend: float
    cpl: Optional[float] = None
    roas: Optional[float] = None


class CampaignsResponse(BaseModel):
    """Campaigns list response"""
    data: List[CampaignItem]


class CampaignCompareItem(BaseModel):
    """Campaign with Period-over-Period comparison"""
    platform: str
    campaign_id: str
    campaign_name: str

    leads_cur: int
    leads_prev: int
    leads_diff: int
    leads_diff_pct: Optional[float] = None

    n_contracts_cur: int
    n_contracts_prev: int

    revenue_cur: float
    revenue_prev: float

    spend_cur: float
    spend_prev: float

    cpl_cur: Optional[float] = None
    cpl_prev: Optional[float] = None

    roas_cur: Optional[float] = None
    roas_prev: Optional[float] = None


class CampaignsCompareResponse(BaseModel):
    """Campaigns compare response"""
    data: List[CampaignCompareItem]


# ============================================================================
# Week-over-Week Campaigns Schema
# ============================================================================
class WoWCampaignItem(BaseModel):
    """Week-over-week campaign comparison"""
    platform: Optional[str] = None
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    leads_cur: int
    leads_prev: int
    leads_diff: int
    leads_diff_pct: Optional[float] = None
    spend_cur: float
    spend_prev: float
    spend_diff: float
    spend_diff_pct: Optional[float] = None
    cpl_cur: Optional[float] = None
    cpl_prev: Optional[float] = None


class WoWCampaignsResponse(BaseModel):
    """Week-over-week campaigns response"""
    data: List[WoWCampaignItem]


# ============================================================================
# UTM Sources Schema
# ============================================================================
class UTMSourceItem(BaseModel):
    """UTM source aggregated metrics"""
    platform: str
    utm_source: str
    leads: int
    n_contracts: int
    revenue: float
    spend: float


class UTMSourcesResponse(BaseModel):
    """UTM sources list response"""
    data: List[UTMSourceItem]


# ============================================================================
# Share/Distribution Schemas
# ============================================================================
class PlatformShareItem(BaseModel):
    """Platform leads share"""
    platform: str
    leads: int


class PlatformShareResponse(BaseModel):
    """Platform share response"""
    data: List[PlatformShareItem]


class PlatformShareCompareItem(BaseModel):
    """Platform share with comparison and percentage points delta"""
    platform: str
    cur_leads: int
    prev_leads: int
    share_cur_pct: Optional[float] = None
    share_prev_pct: Optional[float] = None
    share_diff_pp: Optional[float] = None  # percentage points delta


class PlatformShareCompareResponse(BaseModel):
    """Platform share compare response"""
    data: List[PlatformShareCompareItem]


class TopCampaignItem(BaseModel):
    """Top campaign by leads"""
    campaign_name: str
    leads: int


class TopCampaignsResponse(BaseModel):
    """Top campaigns response"""
    data: List[TopCampaignItem]


# ============================================================================
# Top Movers (Winners/Losers) Schemas
# ============================================================================
class TopMoverCampaign(BaseModel):
    """Campaign in top movers list"""
    platform: str
    campaign_id: str
    campaign_name: str
    leads_cur: int
    roas_cur: Optional[float] = None
    cpl_cur: Optional[float] = None
    spend_cur: float
    leads_diff: int
    leads_diff_pct: Optional[float] = None


class TopMoversResponse(BaseModel):
    """Top movers (winners/losers/watch) response"""
    winners: List[TopMoverCampaign]
    losers: List[TopMoverCampaign]
    watch: List[TopMoverCampaign]


# ============================================================================
# Budget Recommendations Schema
# ============================================================================
class BudgetRecommendationItem(BaseModel):
    """Campaign with budget recommendation"""
    platform: str
    campaign_id: str
    campaign_name: str
    leads_cur: int
    spend_cur: float
    cpl_cur: Optional[float] = None
    roas_cur: Optional[float] = None
    leads_prev: int
    spend_prev: float
    cpl_prev: Optional[float] = None
    roas_prev: Optional[float] = None
    leads_diff: int
    leads_diff_pct: Optional[float] = None
    action: str  # 'scale' | 'pause' | 'watch'


class BudgetRecommendationsResponse(BaseModel):
    """Budget recommendations response"""
    data: List[BudgetRecommendationItem]


# ============================================================================
# Filters Schemas
# ============================================================================
class DataAnalyticsFilters(BaseModel):
    """Common filters for data analytics"""
    date_from: date = Field(..., description="Start date (required)")
    date_to: date = Field(..., description="End date (required)")
    platforms: Optional[List[str]] = Field(
        default=["google", "meta"],
        description="Platforms filter (multi-select)"
    )
    min_spend: Optional[float] = Field(
        default=0.0,
        description="Minimum spend filter for campaigns table"
    )

# ============================================================================
# Contracts Attribution Schemas (NEW)
# ============================================================================

class ContractPlatformItem(BaseModel):
    """Contract metrics by platform"""
    platform: str
    total_leads: int
    contracts: int
    revenue: float
    avg_contract_value: float
    conversion_rate: float


class ContractsByPlatformResponse(BaseModel):
    """Contracts breakdown by platform"""
    data: List[ContractPlatformItem]


class ContractSourceItem(BaseModel):
    """Contract metrics by traffic source"""
    platform: str
    traffic_source: str
    campaign: str
    total_leads: int
    contracts: int
    revenue: float
    avg_contract_value: float
    conversion_rate: float


class ContractsBySourceResponse(BaseModel):
    """Contracts breakdown by traffic source"""
    data: List[ContractSourceItem]


class ContractTimelineItem(BaseModel):
    """Contract metrics timeline item"""
    dt: date
    total_leads: int
    contracts: int
    revenue: float
    conversion_rate: float


class ContractsTimelineResponse(BaseModel):
    """Contracts timeline data"""
    data: List[ContractTimelineItem]


class ContractsAttributionSummary(BaseModel):
    """Contracts attribution summary"""
    data: List[dict]
    total_leads: int
    total_contracts: int
    total_revenue: float
    overall_conversion_rate: float
