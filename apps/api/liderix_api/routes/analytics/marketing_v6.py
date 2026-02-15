"""
Marketing analytics - SEM-based views for Itstep.
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
async def get_marketing_overview(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    city_id: Optional[int] = Query(default=None),
    platform: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Return marketing overview datasets: campaigns, channel mix, spend vs contracts.
    """

    date_from, date_to = await _resolve_date_range(session, date_from, date_to, "sem.ads_campaigns_daily")

    # Campaigns aggregated across date range
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
          platform,
          campaign_id,
          campaign_name,
          SUM(spend) as spend,
          SUM(clicks) as clicks,
          SUM(impressions) as impressions,
          SUM(conversions) as conversions,
          CASE WHEN SUM(impressions) > 0
            THEN SUM(clicks)::float / SUM(impressions)
            ELSE NULL
          END as ctr,
          CASE WHEN SUM(clicks) > 0
            THEN SUM(spend) / SUM(clicks)
            ELSE NULL
          END as cpc,
          CASE WHEN SUM(impressions) > 0
            THEN (SUM(spend) / SUM(impressions)) * 1000
            ELSE NULL
          END as cpm
        FROM sem.ads_campaigns_daily
        WHERE {' AND '.join(campaign_filters)}
        GROUP BY platform, campaign_id, campaign_name
        ORDER BY spend DESC NULLS LAST
        LIMIT :limit
        """
    )
    campaigns_rows = (await session.execute(campaigns_query, campaign_params)).mappings().all()
    campaigns = []
    for row in campaigns_rows:
        data = _normalize_row(row)
        conversions = data.get("conversions") or 0
        spend = data.get("spend") or 0
        data["cpa"] = spend / conversions if conversions else None
        campaigns.append(data)

    # Channel mix
    channel_filters = ["date_key >= :date_from", "date_key <= :date_to"]
    channel_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to}
    if city_id is not None:
        channel_filters.append("id_city = :city_id")
        channel_params["city_id"] = city_id

    channel_query = text(
        f"""
        SELECT
          channel,
          SUM(spend) as spend,
          SUM(contracts_cnt) as contracts_cnt,
          AVG(spend_share) as spend_share,
          AVG(contracts_share) as contracts_share
        FROM sem.channel_mix_daily_city
        WHERE {' AND '.join(channel_filters)}
        GROUP BY channel
        ORDER BY spend DESC NULLS LAST
        """
    )
    channel_rows = (await session.execute(channel_query, channel_params)).mappings().all()

    # Spend vs contracts time series
    svc_filters = ["date_key >= :date_from", "date_key <= :date_to"]
    svc_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to}
    if city_id is not None:
        svc_filters.append("id_city = :city_id")
        svc_params["city_id"] = city_id

    svc_query = text(
        f"""
        SELECT
          date_key,
          city_name,
          contracts_all,
          contracts_meta,
          contracts_gads,
          contracts_offline,
          spend_all,
          spend_meta,
          spend_gads
        FROM sem.ad_spend_vs_contracts_daily_city
        WHERE {' AND '.join(svc_filters)}
        ORDER BY date_key ASC
        """
    )
    svc_rows = (await session.execute(svc_query, svc_params)).mappings().all()

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "campaigns": [data for data in campaigns],
        "channel_mix": [_normalize_row(row) for row in channel_rows],
        "spend_vs_contracts": [_normalize_row(row) for row in svc_rows],
    }
