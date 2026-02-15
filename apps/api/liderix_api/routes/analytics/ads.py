"""
Ads Analytics API - Sem views for Itstep analytics
Provides spend/campaign/ad/anomaly data from sem.* and sem_agent.* views.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_itstep_session
from liderix_api.routes.analytics.deprecation import mark_legacy_deprecated

router = APIRouter(deprecated=True, dependencies=[Depends(mark_legacy_deprecated)])


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in row.items():
        if isinstance(value, Decimal):
            normalized[key] = float(value)
        elif isinstance(value, (date, datetime)):
            normalized[key] = value.isoformat()
        else:
            normalized[key] = value
    return normalized


async def _resolve_date_range(
    session: AsyncSession,
    date_from: Optional[date],
    date_to: Optional[date],
    view: str,
    date_column: str = "date_key",
) -> tuple[date, date]:
    if date_from and date_to:
        return date_from, date_to

    max_date = await session.execute(text(f"SELECT max({date_column}) AS max_date FROM {view}"))
    latest = max_date.scalar()
    resolved_to = date_to or latest or date.today()
    resolved_from = date_from or (resolved_to - timedelta(days=6))
    return resolved_from, resolved_to


@router.get("/")
async def get_ads_analytics(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    city_id: Optional[int] = Query(default=None),
    platform: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    ad_id: Optional[int] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Return ads analytics datasets based on SEM views.

    Filters:
    - date_from/date_to: date_key range
    - city_id: id_city
    - platform: meta/gads (applies to campaign/ad tables)
    - channel: meta/gads (applies to spend trend)
    - ad_id: optional ad profile filter
    """

    date_from, date_to = await _resolve_date_range(session, date_from, date_to, "sem.ad_spend_daily_city")
    resolved_channel = channel or platform

    # Spend by day + channel
    spend_filters = ["date_key >= :date_from", "date_key <= :date_to"]
    spend_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to}
    if city_id is not None:
        spend_filters.append("id_city = :city_id")
        spend_params["city_id"] = city_id
    if resolved_channel:
        spend_filters.append("channel = :channel")
        spend_params["channel"] = resolved_channel

    spend_query = text(
        f"""
        SELECT date_key, id_city, channel, spend
        FROM sem.ad_spend_daily_city
        WHERE {' AND '.join(spend_filters)}
        ORDER BY date_key ASC
        """
    )
    spend_rows = (await session.execute(spend_query, spend_params)).mappings().all()

    # Campaigns daily
    campaign_filters = ["date_key >= :date_from", "date_key <= :date_to"]
    campaign_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to, "limit": limit}
    if city_id is not None:
        campaign_filters.append("id_city = :city_id")
        campaign_params["city_id"] = city_id
    if platform:
        campaign_filters.append("platform = :platform")
        campaign_params["platform"] = platform

    campaigns_query = text(
        f"""
        SELECT
          date_key,
          id_city,
          platform,
          campaign_id,
          campaign_name,
          impressions,
          clicks,
          spend,
          conversions,
          cpc,
          cpm,
          ctr
        FROM sem.ads_campaigns_daily
        WHERE {' AND '.join(campaign_filters)}
        ORDER BY spend DESC NULLS LAST
        LIMIT :limit
        """
    )
    campaign_rows = (await session.execute(campaigns_query, campaign_params)).mappings().all()

    # Ads daily
    ads_filters = ["date_key >= :date_from", "date_key <= :date_to"]
    ads_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to, "limit": limit}
    if city_id is not None:
        ads_filters.append("id_city = :city_id")
        ads_params["city_id"] = city_id
    if platform:
        ads_filters.append("platform = :platform")
        ads_params["platform"] = platform

    ads_query = text(
        f"""
        SELECT
          date_key,
          id_city,
          platform,
          campaign_id,
          campaign_name,
          adset_id,
          adset_name,
          ad_id,
          ad_name,
          link_url,
          permalink_url,
          object_type,
          creative_title,
          creative_body,
          impressions,
          clicks,
          spend,
          conversions,
          cpc,
          ctr
        FROM sem.ads_ads_daily
        WHERE {' AND '.join(ads_filters)}
        ORDER BY spend DESC NULLS LAST
        LIMIT :limit
        """
    )
    ads_rows = (await session.execute(ads_query, ads_params)).mappings().all()

    # Ad profile (optional)
    ad_profile_rows: list[dict[str, Any]] = []
    if ad_id is not None:
        profile_filters = ["date_key >= :date_from", "date_key <= :date_to", "ad_id = :ad_id"]
        profile_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to, "ad_id": ad_id}
        if city_id is not None:
            profile_filters.append("id_city = :city_id")
            profile_params["city_id"] = city_id
        if platform:
            profile_filters.append("platform = :platform")
            profile_params["platform"] = platform
        profile_query = text(
            f"""
            SELECT *
            FROM sem.ads_ad_profile_daily
            WHERE {' AND '.join(profile_filters)}
            ORDER BY date_key DESC
            LIMIT :limit
            """
        )
        profile_params["limit"] = limit
        ad_profile_rows = (await session.execute(profile_query, profile_params)).mappings().all()

    # Ads anomalies
    anomaly_filters = ["1=1"]
    anomaly_params: dict[str, Any] = {"limit": limit}
    if city_id is not None:
        anomaly_filters.append("id_city = :city_id")
        anomaly_params["city_id"] = city_id
    if platform:
        anomaly_filters.append("platform = :platform")
        anomaly_params["platform"] = platform

    anomalies_query = text(
        f"""
        SELECT
          platform,
          id_city,
          ad_id,
          ad_name,
          spend_7d,
          spend_prev7d,
          clicks_7d,
          clicks_prev7d,
          conv_7d,
          conv_prev7d,
          spend_delta_pct,
          clicks_delta_pct,
          conv_delta_pct
        FROM sem_ui.ads_anomalies_7d_display
        WHERE {' AND '.join(anomaly_filters)}
        ORDER BY spend_delta_pct DESC NULLS LAST
        LIMIT :limit
        """
    )
    anomalies_rows = (await session.execute(anomalies_query, anomaly_params)).mappings().all()

    # Fast blocks from sem_agent (optional)
    fast_meta_rows: list[dict[str, Any]] = []
    fast_gads_rows: list[dict[str, Any]] = []
    if city_id is not None:
        meta_query = text(
            """
            SELECT *
            FROM sem_agent.top_meta_ads_daily_city_mv
            WHERE id_city = :city_id
              AND date_key >= :date_from
              AND date_key <= :date_to
            ORDER BY date_key DESC
            LIMIT :limit
            """
        )
        gads_query = text(
            """
            SELECT *
            FROM sem_agent.top_gads_campaigns_daily_city_mv
            WHERE id_city = :city_id
              AND date_key >= :date_from
              AND date_key <= :date_to
            ORDER BY date_key DESC
            LIMIT :limit
            """
        )
        params = {"city_id": city_id, "date_from": date_from, "date_to": date_to, "limit": limit}
        fast_meta_rows = (await session.execute(meta_query, params)).mappings().all()
        fast_gads_rows = (await session.execute(gads_query, params)).mappings().all()
    else:
        meta_query = text(
            """
            SELECT *
            FROM sem_agent.top_meta_ads_daily_mv
            WHERE date_key >= :date_from
              AND date_key <= :date_to
            ORDER BY date_key DESC
            LIMIT :limit
            """
        )
        gads_query = text(
            """
            SELECT *
            FROM sem_agent.top_gads_campaigns_daily_mv
            WHERE date_key >= :date_from
              AND date_key <= :date_to
            ORDER BY date_key DESC
            LIMIT :limit
            """
        )
        params = {"date_from": date_from, "date_to": date_to, "limit": limit}
        fast_meta_rows = (await session.execute(meta_query, params)).mappings().all()
        fast_gads_rows = (await session.execute(gads_query, params)).mappings().all()

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "spend_daily": [_normalize_row(row) for row in spend_rows],
        "campaigns_daily": [_normalize_row(row) for row in campaign_rows],
        "ads_daily": [_normalize_row(row) for row in ads_rows],
        "ad_profile": [_normalize_row(row) for row in ad_profile_rows],
        "anomalies": [_normalize_row(row) for row in anomalies_rows],
        "top_meta_ads": [_normalize_row(row) for row in fast_meta_rows],
        "top_gads_campaigns": [_normalize_row(row) for row in fast_gads_rows],
    }
