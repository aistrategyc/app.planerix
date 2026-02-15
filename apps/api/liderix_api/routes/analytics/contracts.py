"""
Contracts analytics - SEM-based views for Itstep.
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


async def _view_exists(session: AsyncSession, schema: str, table: str) -> bool:
    result = await session.execute(
        text(
            """
            SELECT 1
            FROM information_schema.views
            WHERE table_schema = :schema AND table_name = :table
            LIMIT 1
            """
        ),
        {"schema": schema, "table": table},
    )
    return result.first() is not None


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
async def get_contracts_analytics(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    city_id: Optional[int] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    platform: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Contracts analytics datasets from SEM views.
    """

    if date_from is None:
        date_from = start_date
    if date_to is None:
        date_to = end_date
    if channel is None and platform:
        channel = platform

    date_from, date_to = await _resolve_date_range(session, date_from, date_to, "sem_ui.contracts_daily_city")

    # Contracts trend by channel
    trend_filters = ["date_key >= :date_from", "date_key <= :date_to"]
    trend_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to}
    if city_id is not None:
        trend_filters.append("id_city = :city_id")
        trend_params["city_id"] = city_id
    if channel:
        trend_filters.append("channel = :channel")
        trend_params["channel"] = channel

    trend_query = text(
        f"""
        SELECT
          date_key,
          id_city,
          city_name,
          channel,
          contracts_cnt,
          revenue_total_cost,
          payments_sum
        FROM sem_ui.contracts_daily_city
        WHERE {' AND '.join(trend_filters)}
        ORDER BY date_key ASC
        """
    )
    trend_rows = (await session.execute(trend_query, trend_params)).mappings().all()

    # Attribution daily
    attr_rows: list[dict[str, Any]] = []
    if await _view_exists(session, "sem_ui", "contracts_attribution_daily_city"):
        attr_filters = ["date_key >= :date_from", "date_key <= :date_to"]
        attr_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to}
        if city_id is not None:
            attr_filters.append("id_city = :city_id")
            attr_params["city_id"] = city_id
        if channel:
            attr_filters.append("channel = :channel")
            attr_params["channel"] = channel

        attr_query = text(
            f"""
            SELECT
              date_key,
              id_city,
              channel,
              contracts_cnt
            FROM sem_ui.contracts_attribution_daily_city
            WHERE {' AND '.join(attr_filters)}
            ORDER BY date_key ASC
            """
        )
        attr_rows = (await session.execute(attr_query, attr_params)).mappings().all()
    else:
        bucket: dict[tuple[str | None, int | None, str | None], int] = {}
        for row in trend_rows:
            key = (row.get("date_key"), row.get("id_city"), row.get("channel"))
            bucket[key] = bucket.get(key, 0) + int(row.get("contracts_cnt") or 0)
        attr_rows = [
            {"date_key": k[0], "id_city": k[1], "channel": k[2], "contracts_cnt": v}
            for k, v in bucket.items()
        ]

    # Contracts attributed table
    contracts_filters = ["contract_date_key >= :date_from", "contract_date_key <= :date_to"]
    contracts_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to, "limit": limit}
    if city_id is not None:
        contracts_filters.append("id_city = :city_id")
        contracts_params["city_id"] = city_id
    if platform:
        contracts_filters.append("attributed_platform = :platform")
        contracts_params["platform"] = platform

    contracts_query = text(
        f"""
        SELECT
          contract_id,
          contract_date_key,
          id_city,
          city_name,
          attributed_platform,
          product,
          meta_campaign_name,
          meta_ad_name,
          gads_campaign_name,
          total_cost,
          payments_sum
        FROM sem_ui.contracts_attributed_detail_display
        WHERE {' AND '.join(contracts_filters)}
        ORDER BY contract_date_key DESC
        LIMIT :limit
        """
    )
    contracts_rows = (await session.execute(contracts_query, contracts_params)).mappings().all()

    # Attribution coverage
    coverage_filters = ["contract_date_key >= :date_from", "contract_date_key <= :date_to"]
    coverage_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to}
    if city_id is not None:
        coverage_filters.append("id_city = :city_id")
        coverage_params["city_id"] = city_id

    coverage_query = text(
        f"""
        SELECT
          COUNT(*) as total_contracts,
          COUNT(*) FILTER (WHERE attributed_platform IN ('meta', 'gads')) as paid_signal_cnt,
          COUNT(*) FILTER (WHERE attributed_platform IS NOT NULL) as attributed_cnt
        FROM sem_ui.contracts_attributed_detail_display
        WHERE {' AND '.join(coverage_filters)}
        """
    )
    coverage_row = (await session.execute(coverage_query, coverage_params)).mappings().first() or {}

    # Top campaigns
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
          SUM(contracts_cnt) as contracts_cnt,
          SUM(revenue_total_cost) as revenue_total_cost,
          SUM(payments_sum) as payments_sum
        FROM sem_ui.contracts_by_campaign_daily_city_display
        WHERE {' AND '.join(campaign_filters)}
        GROUP BY platform, campaign_id, campaign_name
        ORDER BY contracts_cnt DESC NULLS LAST
        LIMIT :limit
        """
    )
    campaigns_rows = (await session.execute(campaigns_query, campaign_params)).mappings().all()

    # Meta contracts by ad (daily)
    meta_filters = ["date_key >= :date_from", "date_key <= :date_to"]
    meta_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to, "limit": limit}
    if city_id is not None:
        meta_filters.append("id_city = :city_id")
        meta_params["city_id"] = city_id

    meta_query = text(
        f"""
        SELECT
          date_key,
          id_city,
          city_name,
          campaign_name,
          adset_name,
          ad_name,
          contracts_cnt
        FROM sem_ui.meta_contracts_by_ad_daily_city_display
        WHERE {' AND '.join(meta_filters)}
        ORDER BY contracts_cnt DESC NULLS LAST
        LIMIT :limit
        """
    )
    meta_rows = (await session.execute(meta_query, meta_params)).mappings().all()

    # GAds contracts by campaign (daily)
    gads_filters = ["date_key >= :date_from", "date_key <= :date_to"]
    gads_params: dict[str, Any] = {"date_from": date_from, "date_to": date_to, "limit": limit}
    if city_id is not None:
        gads_filters.append("id_city = :city_id")
        gads_params["city_id"] = city_id

    gads_query = text(
        f"""
        SELECT
          date_key,
          id_city,
          city_name,
          campaign_name,
          advertising_channel_type,
          contracts_cnt
        FROM sem_ui.gads_contracts_by_campaign_daily_city_display
        WHERE {' AND '.join(gads_filters)}
        ORDER BY contracts_cnt DESC NULLS LAST
        LIMIT :limit
        """
    )
    gads_rows = (await session.execute(gads_query, gads_params)).mappings().all()

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "contracts_daily": [_normalize_row(row) for row in trend_rows],
        "attribution_daily": [_normalize_row(row) for row in attr_rows],
        "contracts_attributed": [_normalize_row(row) for row in contracts_rows],
        "coverage": _normalize_row(coverage_row),
        "top_campaigns": [_normalize_row(row) for row in campaigns_rows],
        "meta_contracts_by_ad": [_normalize_row(row) for row in meta_rows],
        "gads_contracts_by_campaign": [_normalize_row(row) for row in gads_rows],
    }
