from __future__ import annotations

from datetime import date
from typing import Optional, Any

from pydantic import BaseModel, ConfigDict


class AdsDailyRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    date_key: Optional[date] = None
    id_city: Optional[int] = None
    platform: Optional[str] = None
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    adset_id: Optional[str] = None
    adset_name: Optional[str] = None
    ad_id: Optional[str] = None
    ad_name: Optional[str] = None
    impressions: Optional[float] = None
    clicks: Optional[float] = None
    spend: Optional[float] = None
    conversions: Optional[float] = None
    cpc: Optional[float] = None
    ctr: Optional[float] = None


class AdsAnomaliesRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    platform: Optional[str] = None
    id_city: Optional[int] = None
    ad_id: Optional[str] = None
    ad_name: Optional[str] = None
    spend_7d: Optional[float] = None
    spend_prev7d: Optional[float] = None
    clicks_7d: Optional[float] = None
    clicks_prev7d: Optional[float] = None
    conv_7d: Optional[float] = None
    conv_prev7d: Optional[float] = None
    impr_7d: Optional[float] = None
    impr_prev7d: Optional[float] = None
    spend_delta_pct: Optional[float] = None
    clicks_delta_pct: Optional[float] = None
    conv_delta_pct: Optional[float] = None
    impr_delta_pct: Optional[float] = None
    baseline_days: Optional[int] = None


class AdsDailyResponse(BaseModel):
    widget_key: str
    items: list[AdsDailyRow]
    missing_view: Optional[bool] = None


class AdsAnomaliesResponse(BaseModel):
    widget_key: str
    items: list[AdsAnomaliesRow]
    missing_view: Optional[bool] = None


class BatchWidgetRequest(BaseModel):
    widget_key: str
    alias: Optional[str] = None
    filters: Optional[dict[str, Any]] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
    order_by: Optional[str] = None


class BatchWidgetsPayload(BaseModel):
    widgets: list[BatchWidgetRequest]
    global_filters: Optional[dict[str, Any]] = None
