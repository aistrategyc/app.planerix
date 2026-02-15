"""
Analytics Schemas - Complete schemas for ITstep Analytics Dashboard
Based on real ITstep database structure and requirements
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


# ==================== ENUMS ====================

class PlatformType(str, Enum):
    FACEBOOK = "Facebook"
    GOOGLE = "Google"
    INSTAGRAM = "Instagram"
    YOUTUBE = "YouTube"
    OTHER = "Other"


class CampaignStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"


class CreativeType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    CAROUSEL = "carousel"
    TEXT = "text"


class CreativeTheme(str, Enum):
    CAREER = "Кар'єра"
    MONEY = "Гроші"
    CHANGE = "Зміни"
    CERTIFICATES = "Сертифікати"
    GUARANTEES = "Гарантії"
    FROM_ZERO = "Навчання з нуля"
    EMOTIONAL = "Емоційна підтримка"


class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    CONVERTED = "converted"
    LOST = "lost"


class Temperature(str, Enum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"


# ==================== BASE SCHEMAS ====================

class DateRangeFilter(BaseModel):
    start_date: date
    end_date: date

    class Config:
        schema_extra = {
            "example": {
                "start_date": "2025-09-01",
                "end_date": "2025-09-30"
            }
        }


class MetricBase(BaseModel):
    """Base model for all metrics"""
    impressions: int = 0
    clicks: int = 0
    spend: Decimal = Field(default=0, decimal_places=6)
    conversions: int = 0
    revenue: Decimal = Field(default=0, decimal_places=2)

    @property
    def ctr(self) -> float:
        return (self.clicks / self.impressions * 100) if self.impressions > 0 else 0

    @property
    def cpc(self) -> float:
        return float(self.spend / self.clicks) if self.clicks > 0 else 0

    @property
    def cpm(self) -> float:
        return float(self.spend / self.impressions * 1000) if self.impressions > 0 else 0

    @property
    def cvr(self) -> float:
        return (self.conversions / self.clicks * 100) if self.clicks > 0 else 0

    @property
    def cpa(self) -> float:
        return float(self.spend / self.conversions) if self.conversions > 0 else 0

    @property
    def roas(self) -> float:
        return float(self.revenue / self.spend) if self.spend > 0 else 0


# ==================== CAMPAIGNS ====================

class Campaign(BaseModel):
    """Campaign information"""
    id: str
    name: str
    platform: PlatformType
    product_key: Optional[str] = None
    branch_id: Optional[int] = None
    status: CampaignStatus = CampaignStatus.ACTIVE
    first_seen: Optional[date] = None
    last_active_date: Optional[date] = None


class CampaignMetrics(MetricBase):
    """Campaign daily metrics"""
    campaign_id: str
    campaign_name: str
    date: date
    platform: PlatformType
    reach: Optional[int] = None
    frequency: Optional[float] = None

    # Share metrics
    share_cost_in_platform: Optional[float] = None
    share_revenue_in_platform: Optional[float] = None
    share_contracts_in_platform: Optional[float] = None


# ==================== CREATIVES ====================

class Creative(BaseModel):
    """Creative information"""
    id: str
    name: str
    campaign_id: Optional[str] = None
    type: CreativeType = CreativeType.IMAGE
    platform: PlatformType = PlatformType.FACEBOOK
    title: Optional[str] = None
    theme: Optional[CreativeTheme] = None
    is_personalized: bool = False
    fb_creative_id: Optional[str] = None
    creative_url: Optional[str] = None
    status: CampaignStatus = CampaignStatus.ACTIVE


class CreativeMetrics(MetricBase):
    """Creative daily metrics"""
    creative_id: str
    creative_name: str
    date: date
    campaign_key: Optional[str] = None
    reach: Optional[int] = None
    frequency: Optional[float] = None

    # Allocation metrics
    cost_alloc_by_revenue: Optional[Decimal] = None
    cost_alloc_by_contracts: Optional[Decimal] = None


class CreativeBurnout(BaseModel):
    """Creative burnout analysis"""
    creative_id: str
    creative_name: str
    days_active: int
    initial_ctr: float
    current_ctr: float
    burnout_score: float  # 0-100, higher = more burned out
    status: str  # "fresh", "declining", "burned_out"

    @property
    def needs_refresh(self) -> bool:
        return self.burnout_score > 70 or (self.days_active > 14 and self.current_ctr < self.initial_ctr * 0.5)


# ==================== DASHBOARD RESPONSES ====================

class DashboardOverview(BaseModel):
    """Main dashboard overview"""
    date_range: DateRangeFilter
    total_spend: Decimal
    total_revenue: Decimal
    total_conversions: int
    total_leads: int
    roas: float
    conversion_rate: float
    active_campaigns: int
    active_creatives: int

    # Trends (compared to previous period)
    spend_trend: float  # % change
    revenue_trend: float
    roas_trend: float


class PlatformPerformance(BaseModel):
    """Platform performance summary"""
    platform: PlatformType
    campaigns_count: int
    creatives_count: int
    metrics: MetricBase
    share_of_spend: float
    share_of_revenue: float
    performance_score: float  # 0-100


class FunnelStage(BaseModel):
    """Funnel stage data"""
    stage: str
    count: int
    conversion_rate: float
    avg_time_in_stage: Optional[float] = None  # hours
    drop_off_rate: float


class FunnelAnalysis(BaseModel):
    """Complete funnel analysis"""
    date_range: DateRangeFilter
    stages: List[FunnelStage]
    overall_conversion_rate: float
    total_drop_offs: int
    bottleneck_stage: str


class RealTimeMetrics(BaseModel):
    """Real-time metrics for dashboard"""
    active_sessions: int
    new_leads_today: int
    revenue_today: Decimal
    conversions_today: int
    top_performing_creative: Optional[str] = None
    alerts: List[str] = []
    last_updated: datetime


class AnalyticsFilters(BaseModel):
    """Common filters for analytics endpoints"""
    date_range: DateRangeFilter
    platforms: Optional[List[PlatformType]] = None
    campaigns: Optional[List[str]] = None
    products: Optional[List[str]] = None
    branches: Optional[List[int]] = None

    # Pagination
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)

    # Sorting
    sort_by: str = "spend"
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")


class TimeSeriesPoint(BaseModel):
    """Time series data point"""
    date: date
    value: float
    metric: str


# ==================== LEGACY COMPATIBILITY ====================

class KPIMetrics(BaseModel):
    revenue: float
    profit: float
    cr: float   # Conversion Rate
    cac: float  # Customer Acquisition Cost


class RevenueItem(BaseModel):
    date: date
    revenue: float


class AdsPerformanceItem(BaseModel):
    report_date: date
    campaign_id: str
    impressions: float
    clicks: float
    conversions: float
    cost: float
    cpc: Optional[float] = None
    cpa: Optional[float] = None
    ctr: Optional[float] = None


class TopCreativeItem(BaseModel):
    date: date
    creative_id: str
    campaign_id: str
    impressions: float
    clicks: float
    spend: float
    ctr: float
    cpc: float


class DeviceItem(BaseModel):
    device_category: str
    sessions: int
    users: int
    conversions: int
    conversion_rate: float

# 👤 Клиентская метрика
class CustomerMetricsItem(BaseModel):
    report_date: date
    new_customers: int
    returning_customers: int
    avg_check: float
    clv: float

# 📊 ROAS по кампаниям
class CampaignROASItem(BaseModel):
    campaign_id: str
    campaign_name: str
    spend: float
    revenue: float
    roas: float

# 🌐 Трафик по каналам
class TrafficItem(BaseModel):
    date: date
    channel: str
    total_sessions: int
    total_users: int
    new_users: int
    engaged_sessions: int
    avg_session_duration: float
    avg_bounce_rate: float
    avg_engagement_rate: float

# 🔍 AI-инсайты
class AIInsight(BaseModel):
    summary: str
    insights: List[str]
    recommendations: List[str]

# 🔮 Прогноз
class ForecastItem(BaseModel):
    metric: str
    value: float
    predicted_value: float
    delta: float

# 🧩 Воронка
class FunnelStep(BaseModel):
    step_name: str
    users: int
    conversion_rate: float

# 📈 Удержание
class RetentionCohort(BaseModel):
    cohort_week: str
    week_0: int
    week_1: Optional[int] = None
    week_2: Optional[int] = None
    week_3: Optional[int] = None
    week_4: Optional[int] = None