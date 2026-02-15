from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time as dt_time
from typing import Dict, Optional, Tuple
import uuid

import time
import json
import hashlib
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_async_session, get_itstep_session
from liderix_api.services.auth import get_current_user
from liderix_api.models.users import User
from liderix_api.enums import MembershipStatus
from liderix_api.schemas.analytics_widgets import AdsAnomaliesResponse, AdsDailyResponse, BatchWidgetsPayload
from liderix_api.services.redis_client import get_redis_client

router = APIRouter()


@dataclass(frozen=True)
class WidgetConfig:
    view: str
    grain: Optional[str]
    entity_type: Optional[str]
    date_column: str = "date_key"
    entity_column: Optional[str] = None
    default_limit: int = 200
    default_filters: Optional[dict] = None
    default_order_by: Optional[str] = None
    supports_filters: Optional[dict] = None
    city_column: Optional[str] = None
    required_columns: Optional[list] = None


_WIDGET_CACHE: Dict[str, Tuple[WidgetConfig, float]] = {}
_COLUMNS_CACHE: Dict[str, Tuple[Dict[str, str], float]] = {}
_CACHE_TTL_SECONDS = 300
_CACHE_MAX_SIZE = 256
_CACHE_VERSION = "v6"

_ALLOWED_WIDGET_SCHEMAS = {"sem_ui", "sem", "sem_agent", "ai"}
_VIEW_NAME_RE = re.compile(r"^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$")

_DEFAULT_MONEY_META = {
    "currency_code": "UAH",
    "money_format": {
        "locale": "uk-UA",
        "currency_display": "symbol",
        "symbol_position": "after",
    },
}

_WIDGET_META_OVERRIDES: Dict[str, dict] = {
    "ads.kpi_total": {
        **_DEFAULT_MONEY_META,
        "metrics": {
            "spend": {"unit": "money", "aggregation": "total", "source": "platform"},
            "clicks": {"unit": "count", "aggregation": "total", "source": "platform"},
            "platform_leads": {"unit": "count", "aggregation": "total", "source": "platform", "is_fractional_allowed": True},
            "crm_requests_cnt": {"unit": "count", "aggregation": "total", "source": "crm"},
            # Full-funnel CRM outcomes for end-to-end analytics.
            "contracts_cnt": {"unit": "count", "aggregation": "total", "source": "crm"},
            "revenue_sum": {"unit": "money", "aggregation": "total", "source": "crm"},
            "payments_sum": {"unit": "money", "aggregation": "total", "source": "crm"},
            # Derived KPI columns (usually computed in sem_ui view).
            "cac": {"unit": "money", "aggregation": "ratio", "source": "derived"},
            "roas": {"unit": "ratio", "aggregation": "ratio", "source": "derived"},
            "payback_rate": {"unit": "ratio", "aggregation": "ratio", "source": "derived"},
        },
    },
    "ads.ads_daily": {**_DEFAULT_MONEY_META},
    "ads.ads_anomalies_7d": {**_DEFAULT_MONEY_META},
    "ads.ads_ad_profile_daily": {**_DEFAULT_MONEY_META},
    "ads.meta_creatives_daily": {**_DEFAULT_MONEY_META},
    "ads.meta_ads_top_daily": {**_DEFAULT_MONEY_META},
    "ads.meta_creative_fatigue_7d": {**_DEFAULT_MONEY_META},
    "ads.gads_keywords_daily": {**_DEFAULT_MONEY_META},
    "ads.gads_device_hour_daily": {**_DEFAULT_MONEY_META},
    "ads.gads_conversion_actions_daily": {**_DEFAULT_MONEY_META},
    "ads.gads.trend": {**_DEFAULT_MONEY_META},
    "ads.gads_pmax_daily": {**_DEFAULT_MONEY_META},
    "ads.creative_type_summary": {**_DEFAULT_MONEY_META},
}


async def _get_columns(
    session: AsyncSession,
    schema: str,
    table: str,
) -> Dict[str, str]:
    cache_key = f"{schema}.{table}"
    cached = _COLUMNS_CACHE.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[1] < _CACHE_TTL_SECONDS:
        return cached[0]

    result = await session.execute(
        text(
            """
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table
            """
        ),
        {"schema": schema, "table": table},
    )
    columns: Dict[str, str] = {}
    for row in result.fetchall():
        column_name = row[0]
        data_type = row[1]
        udt_name = row[2]
        if data_type == "USER-DEFINED" and udt_name:
            columns[column_name] = udt_name
        else:
            columns[column_name] = data_type
    _COLUMNS_CACHE[cache_key] = (columns, now)
    if len(_COLUMNS_CACHE) > _CACHE_MAX_SIZE:
        _COLUMNS_CACHE.pop(next(iter(_COLUMNS_CACHE)))
    return columns


def _split_view(view: str) -> tuple[str, str]:
    if "." not in view:
        return "public", view
    schema, table = view.split(".", 1)
    return schema, table


def _coerce_date_param(value: date, column_type: Optional[str]) -> object:
    if not column_type:
        return value.isoformat()
    normalized = column_type.lower()
    if normalized == "date":
        return value
    if "timestamp" in normalized or normalized.startswith("time"):
        return datetime.combine(value, dt_time.min)
    return value.isoformat()


def _validate_view_name(view: str) -> None:
    if not view:
        raise HTTPException(status_code=400, detail="Widget view is empty")
    if not _VIEW_NAME_RE.match(view):
        raise HTTPException(status_code=400, detail="Invalid widget view format")
    schema, _ = _split_view(view)
    if schema not in _ALLOWED_WIDGET_SCHEMAS:
        raise HTTPException(status_code=400, detail="Widget view schema is not allowed")


def _normalize_required_columns(value: object) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, tuple):
        return [str(item) for item in value]
    if isinstance(value, str):
        try:
            loaded = json.loads(value)
            if isinstance(loaded, list):
                return [str(item) for item in loaded]
        except Exception:
            pass
        return [value]
    return [str(value)]


def _available_filters(supports_filters: Optional[dict]) -> list[str]:
    if not supports_filters:
        return []
    return sorted([key for key, value in supports_filters.items() if value])


def _normalize_agent_keys(value: object) -> list[str]:
    if not value:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(item) for item in value if item]
    if isinstance(value, str):
        try:
            loaded = json.loads(value)
            if isinstance(loaded, list):
                return [str(item) for item in loaded if item]
        except Exception:
            pass
        return [value] if value else []
    return [str(value)]


async def _resolve_widget_insights_config(
    session: AsyncSession,
    widget_key: str,
) -> dict[str, object]:
    if not widget_key:
        return {"agent_keys": [], "insights_view": None}
    columns = await _get_columns(session, "ai", "widget_registry")
    if not columns:
        return {"agent_keys": [], "insights_view": None}
    select_fields = ["widget_key"]
    for field in (
        "agent_key",
        "agent_keys",
        "insights_view",
        "insights_source",
        "insights_enabled",
        "insights_date_column",
        "insights_city_column",
        "insights_severity_column",
        "insights_tenant_column",
    ):
        if field in columns:
            select_fields.append(field)
    query = text(
        f"""
        SELECT {', '.join(select_fields)}
        FROM ai.widget_registry
        WHERE widget_key = :widget_key
        LIMIT 1
        """
    )
    row = (await session.execute(query, {"widget_key": widget_key})).mappings().first()
    if not row:
        return {"agent_keys": [], "insights_view": None}
    if row.get("insights_enabled") is False:
        return {"agent_keys": [], "insights_view": None}

    agent_keys = _normalize_agent_keys(row.get("agent_keys"))
    if not agent_keys and row.get("agent_key"):
        agent_keys = [str(row["agent_key"])]

    insights_view = row.get("insights_view") or row.get("insights_source")
    if insights_view:
        try:
            _validate_view_name(insights_view)
        except HTTPException:
            insights_view = None

    return {
        "agent_keys": agent_keys,
        "insights_view": insights_view,
        "insights_date_column": row.get("insights_date_column"),
        "insights_city_column": row.get("insights_city_column"),
        "insights_severity_column": row.get("insights_severity_column"),
        "insights_tenant_column": row.get("insights_tenant_column"),
    }


def _resolve_entity_column(config: WidgetConfig) -> Optional[str]:
    if config.entity_column:
        return config.entity_column
    if config.entity_type:
        return f"{config.entity_type}_id"
    return None


def _supports_filter(config: WidgetConfig, key: str) -> bool:
    if not config.supports_filters:
        return True
    value = config.supports_filters.get(key)
    if value is None:
        return True
    return bool(value)


def _parse_entity_id(value: str, column_type: Optional[str]) -> object:
    if not column_type:
        return value
    if column_type in {"integer", "bigint", "smallint", "int2", "int4", "int8"}:
        try:
            return int(value)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid entity_id") from exc
    if column_type in {"numeric", "double precision", "real", "float4", "float8"}:
        try:
            return float(value)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid entity_id") from exc
    if column_type == "uuid":
        try:
            return str(uuid.UUID(value))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid entity_id") from exc
    return value


def _coerce_severity_param(value: str, column_type: Optional[str]) -> Optional[object]:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if not column_type:
        return value
    numeric_types = {"smallint", "integer", "bigint", "int2", "int4", "int8", "numeric", "decimal"}
    if column_type.lower() in numeric_types:
        if raw.isdigit() or (raw.startswith("-") and raw[1:].isdigit()):
            return int(raw)
        mapping = {
            "critical": 3,
            "high": 3,
            "warning": 2,
            "medium": 2,
            "warn": 2,
            "info": 1,
            "low": 1,
        }
        return mapping.get(raw.lower())
    return value

def _parse_column_value(value: object, column_type: Optional[str]) -> object:
    if value is None:
        return value
    if not column_type:
        return value
    if column_type in {"integer", "bigint", "smallint", "int2", "int4", "int8"}:
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Invalid filter value") from exc
    if column_type in {"numeric", "double precision", "real", "float4", "float8"}:
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Invalid filter value") from exc
    if column_type == "uuid":
        try:
            return str(uuid.UUID(str(value)))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid filter value") from exc
    return value


def _normalize_platform_filter(value: object, column_name: str) -> list[str]:
    if value is None:
        return []
    platform = str(value).strip().lower()
    if not platform:
        return []

    if platform in {"meta", "facebook", "instagram", "fb", "paidmeta", "paidfacebook"}:
        if column_name == "channel":
            return ["paid_meta", "meta"]
        return ["meta", "facebook", "instagram", "fb"]

    if platform in {"gads", "google", "google_ads", "adwords", "paidgads"}:
        if column_name == "channel":
            return ["paid_gads", "gads"]
        return ["gads", "google", "google_ads", "adwords"]

    return [platform]


def _parse_order_by(order_by: Optional[str], columns: Dict[str, str]) -> Optional[str]:
    if not order_by:
        return None
    raw = order_by.strip()
    if not raw:
        return None
    direction = "ASC"
    lowered = raw.lower()
    if raw.startswith("-"):
        direction = "DESC"
        raw = raw[1:].strip()
    elif lowered.endswith(" desc"):
        direction = "DESC"
        raw = raw[:-5].strip()
    elif lowered.endswith(" asc"):
        raw = raw[:-4].strip()
    if raw not in columns:
        raise HTTPException(status_code=400, detail="Invalid order_by")
    return f"{raw} {direction}"


async def _get_user_org_id(
    session: AsyncSession,
    current_user: User,
) -> Optional[str]:
    membership = await session.scalar(
        text(
            """
            SELECT org_id
            FROM memberships
            WHERE user_id = :user_id
              AND deleted_at IS NULL
              AND status = :status
            LIMIT 1
            """
        ),
        {"user_id": str(current_user.id), "status": MembershipStatus.ACTIVE.value},
    )
    return str(membership) if membership else None


async def _load_widget_config(
    session: AsyncSession,
    widget_key: str,
) -> WidgetConfig:
    cached = _WIDGET_CACHE.get(widget_key)
    now = time.monotonic()
    if cached and now - cached[1] < _CACHE_TTL_SECONDS:
        return cached[0]

    result = await session.execute(
        text(
            """
            SELECT widget_key,
                   sem_view,
                   grain,
                   entity_type,
                   default_filters,
                   default_limit,
                   default_sort,
                   date_column,
                   city_column,
                   supports_filters,
                   required_columns,
                   is_active
            FROM ai.widget_registry
            WHERE widget_key = :widget_key
            LIMIT 1
            """
        ),
        {"widget_key": widget_key},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Unknown widget_key")
    if row.get("is_active") is False:
        raise HTTPException(status_code=404, detail="Widget is inactive")
    if not row.get("sem_view"):
        raise HTTPException(status_code=400, detail="Widget is missing sem_view")
    _validate_view_name(row["sem_view"])

    config = WidgetConfig(
        view=row["sem_view"],
        grain=row.get("grain"),
        entity_type=row.get("entity_type"),
        default_filters=row.get("default_filters") or None,
        default_limit=row.get("default_limit") or 200,
        default_order_by=row.get("default_sort"),
        supports_filters=row.get("supports_filters") or None,
        date_column=row.get("date_column") or "date_key",
        city_column=row.get("city_column"),
        required_columns=row.get("required_columns") or None,
    )
    _WIDGET_CACHE[widget_key] = (config, now)
    if len(_WIDGET_CACHE) > _CACHE_MAX_SIZE:
        _WIDGET_CACHE.pop(next(iter(_WIDGET_CACHE)))
    return config


@router.get("/widgets/{widget_key}")
async def get_widget_data(
    widget_key: str,
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    id_city: Optional[int] = Query(default=None, alias="id_city"),
    city_id: Optional[int] = Query(default=None, alias="city_id"),
    product: Optional[str] = Query(default=None),
    branch: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    platform: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    device: Optional[str] = Query(default=None),
    conversion_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    objective: Optional[str] = Query(default=None),
    campaign_id: Optional[str] = Query(default=None),
    adset_id: Optional[str] = Query(default=None),
    ad_group_id: Optional[str] = Query(default=None),
    entity_id: Optional[str] = Query(default=None),
    limit: Optional[int] = Query(default=None, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    order_by: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
    core_session: AsyncSession = Depends(get_async_session),
):
    config = await _load_widget_config(core_session, widget_key)
    org_id = await _get_user_org_id(core_session, current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="User has no active organization")

    schema, table = _split_view(config.view)
    columns = await _get_columns(session, schema, table)
    if not columns:
        return {"widget_key": widget_key, "items": [], "missing_view": True}
    required_columns = _normalize_required_columns(config.required_columns)
    if required_columns:
        missing = [column for column in required_columns if column not in columns]
        if missing:
            return {
                "widget_key": widget_key,
                "items": [],
                "missing_columns": missing,
                "meta": {
                    "widget_key": widget_key,
                    "sem_view": config.view,
                    "grain": config.grain,
                    "supports_filters": config.supports_filters or {},
                    "available_filters": _available_filters(config.supports_filters),
                },
            }

    filters = []
    params: Dict[str, object] = {}
    default_filters = config.default_filters or {}
    applied_filters: Dict[str, object] = {}
    ignored_filters: Dict[str, str] = {}

    if "organization_id" in columns:
        filters.append("organization_id = :organization_id")
        params["organization_id"] = org_id
    elif "org_id" in columns:
        filters.append("org_id = :organization_id")
        params["organization_id"] = org_id

    date_column = config.date_column if config.date_column in columns else None
    if not date_column:
        for candidate in ("date", "day", "dt", "as_of_date", "contract_date_key"):
            if candidate in columns:
                date_column = candidate
                break

    date_supported = _supports_filter(config, "date")
    original_date_from = date_from if date_from is not None else start_date
    original_date_to = date_to if date_to is not None else end_date
    if date_from is None:
        date_from = start_date
    if date_to is None:
        date_to = end_date
    if not date_supported:
        if original_date_from is not None:
            ignored_filters["date_from"] = "unsupported"
        if original_date_to is not None:
            ignored_filters["date_to"] = "unsupported"
        date_from = None
        date_to = None
    else:
        if not date_from and date_column:
            date_from = default_filters.get("date_from") or default_filters.get("start_date")
        if not date_to and date_column:
            date_to = default_filters.get("date_to") or default_filters.get("end_date")

    if (date_from or date_to) and not date_column and date_supported:
        if date_from:
            ignored_filters["date_from"] = "missing_column"
        if date_to:
            ignored_filters["date_to"] = "missing_column"
        date_from = None
        date_to = None

    if date_from and date_column:
        filters.append(f"{date_column} >= :date_from")
        params["date_from"] = _coerce_date_param(date_from, columns.get(date_column))
        applied_filters["date_from"] = date_from
    if date_to and date_column:
        filters.append(f"{date_column} <= :date_to")
        params["date_to"] = _coerce_date_param(date_to, columns.get(date_column))
        applied_filters["date_to"] = date_to
    if id_city is None:
        id_city = city_id
    if id_city is None:
        id_city = default_filters.get("id_city") or default_filters.get("city_id")
    # Treat sentinel defaults like "all"/"" as "no filter" to avoid 400s
    # during first render (e.g. attribution pages before city default is applied).
    if isinstance(id_city, str):
        if not id_city.strip() or id_city.strip().lower() == "all":
            id_city = None
    city_column = None
    if config.city_column and config.city_column in columns:
        city_column = config.city_column
    elif "id_city" in columns:
        city_column = "id_city"
    elif "city_id" in columns:
        city_column = "city_id"
    if id_city is not None and city_column and _supports_filter(config, "city"):
        filters.append(f"{city_column} = :id_city")
        params["id_city"] = _parse_column_value(id_city, columns.get(city_column))
        applied_filters["id_city"] = params["id_city"]
    elif id_city is not None and not _supports_filter(config, "city"):
        ignored_filters["id_city"] = "unsupported"
    product_column = None
    if "product" in columns:
        product_column = "product"
    elif "product_name" in columns:
        product_column = "product_name"
    elif "course_name" in columns:
        product_column = "course_name"
    elif "first_course_name" in columns:
        product_column = "first_course_name"

    if not product and product_column:
        product = default_filters.get("product")
    if product and not _supports_filter(config, "product"):
        ignored_filters["product"] = "unsupported"
    elif product and product_column:
        filters.append(f"{product_column} = :product")
        params["product"] = product
        applied_filters["product"] = product
    elif product and not product_column:
        ignored_filters["product"] = "missing_column"
    branch_column = None
    if "branch" in columns:
        branch_column = "branch"
    elif "branch_name" in columns:
        branch_column = "branch_name"
    elif "city_name" in columns:
        branch_column = "city_name"
    elif "city" in columns:
        branch_column = "city"
    elif "id_city" in columns:
        branch_column = "id_city"

    if not branch and branch_column:
        branch = default_filters.get("branch")
    if branch and not _supports_filter(config, "branch"):
        ignored_filters["branch"] = "unsupported"
    elif branch and branch_column and not (branch_column == "id_city" and "id_city" in params):
        filters.append(f"{branch_column} = :branch")
        params["branch"] = _parse_column_value(branch, columns.get(branch_column))
        applied_filters["branch"] = params["branch"]
    elif branch and not branch_column:
        ignored_filters["branch"] = "missing_column"
    platform_column = None
    if "platform" in columns:
        platform_column = "platform"
    elif "attributed_platform" in columns:
        platform_column = "attributed_platform"
    elif "channel" in columns:
        platform_column = "channel"
    elif "advertising_channel_type" in columns:
        platform_column = "advertising_channel_type"
    channel_column = "channel" if "channel" in columns else None
    if not _supports_filter(config, "channel"):
        if channel is not None:
            ignored_filters["channel"] = "unsupported"
        channel = None
    if not _supports_filter(config, "platform"):
        if platform is not None:
            ignored_filters["platform"] = "unsupported"
        platform = None
    source_column = None
    if "source" in columns:
        source_column = "source"
    elif "source_name" in columns:
        source_column = "source_name"
    elif "source_type_name" in columns:
        source_column = "source_type_name"
    elif "source_type" in columns:
        source_column = "source_type"
    elif "source_user_name" in columns:
        source_column = "source_user_name"
    elif "source_owner" in columns:
        source_column = "source_owner"
    elif "source_owner_name" in columns:
        source_column = "source_owner_name"
    elif "utm_source" in columns:
        source_column = "utm_source"
    elif "first_utm_source" in columns:
        source_column = "first_utm_source"
    elif "id_source" in columns:
        source_value = str(source or "").strip()
        if source_value.isdigit():
            source_column = "id_source"
    elif "source_id" in columns:
        source_value = str(source or "").strip()
        if source_value.isdigit():
            source_column = "source_id"
    elif "channel" in columns:
        source_value = str(source or "").strip().lower()
        if source_value in {
            "meta",
            "facebook",
            "instagram",
            "fb",
            "paidmeta",
            "paidfacebook",
            "gads",
            "google",
            "google_ads",
            "adwords",
            "paidgads",
            "offline",
            "paid_meta",
            "paid_gads",
        }:
            source_column = "channel"

    if not source and source_column:
        source = default_filters.get("source") or default_filters.get("channel")
    if source and source_column == platform_column and not platform:
        platform = source
        source = None
    if source and source_column and source_column != platform_column:
        if not _supports_filter(config, "source"):
            ignored_filters["source"] = "unsupported"
            source = None
        if source:
            if source_column == "channel":
                channel_values = _normalize_platform_filter(source, source_column)
                if channel_values:
                    if len(channel_values) == 1:
                        filters.append(f"{source_column} = :source")
                        params["source"] = channel_values[0]
                    else:
                        placeholders = []
                        for idx, value in enumerate(channel_values):
                            key = f"source_{idx}"
                            placeholders.append(f":{key}")
                            params[key] = value
                        filters.append(f"{source_column} IN ({', '.join(placeholders)})")
                    applied_filters["source"] = channel_values
            else:
                filters.append(f"{source_column} = :source")
                params["source"] = _parse_column_value(source, columns.get(source_column))
                applied_filters["source"] = params["source"]
    elif source and not source_column:
        ignored_filters["source"] = "missing_column"

    if not channel and channel_column and _supports_filter(config, "channel"):
        channel = default_filters.get("channel")
    if channel and channel_column and channel_column != platform_column:
        channel_values = _normalize_platform_filter(channel, channel_column)
        if channel_values:
            if len(channel_values) == 1:
                filters.append(f"{channel_column} = :channel")
                params["channel"] = channel_values[0]
            else:
                placeholders = []
                for idx, value in enumerate(channel_values):
                    key = f"channel_{idx}"
                    placeholders.append(f":{key}")
                    params[key] = value
                filters.append(f"{channel_column} IN ({', '.join(placeholders)})")
            applied_filters["channel"] = channel_values
    elif channel and channel_column and channel_column == platform_column and not platform:
        platform = channel
    elif channel and not channel_column:
        ignored_filters["channel"] = "missing_column"

    if not platform and platform_column and _supports_filter(config, "platform"):
        platform = default_filters.get("platform") or default_filters.get("channel")
    if platform and platform_column:
        platform_values = _normalize_platform_filter(platform, platform_column)
        if platform_values:
            if len(platform_values) == 1:
                filters.append(f"{platform_column} = :platform")
                params["platform"] = platform_values[0]
            else:
                placeholders = []
                for idx, value in enumerate(platform_values):
                    key = f"platform_{idx}"
                    placeholders.append(f":{key}")
                    params[key] = value
                filters.append(f"{platform_column} IN ({', '.join(placeholders)})")
            applied_filters["platform"] = platform_values
    elif platform and not platform_column:
        ignored_filters["platform"] = "missing_column"

    status_column = None
    if "campaign_status" in columns:
        status_column = "campaign_status"
    elif "status" in columns:
        status_column = "status"
    elif "adset_status" in columns:
        status_column = "adset_status"
    elif "ad_group_status" in columns:
        status_column = "ad_group_status"

    if not _supports_filter(config, "status"):
        if status is not None:
            ignored_filters["status"] = "unsupported"
        status = None
    if not status and status_column:
        status = default_filters.get("status")
    if status and status_column:
        filters.append(f"{status_column} = :status")
        params["status"] = _parse_column_value(status, columns.get(status_column))
        applied_filters["status"] = params["status"]
    elif status and not status_column:
        ignored_filters["status"] = "missing_column"

    objective_column = None
    if "objective" in columns:
        objective_column = "objective"
    elif "campaign_objective" in columns:
        objective_column = "campaign_objective"
    elif "objective_type" in columns:
        objective_column = "objective_type"

    if not _supports_filter(config, "objective"):
        if objective is not None:
            ignored_filters["objective"] = "unsupported"
        objective = None
    if not objective and objective_column:
        objective = default_filters.get("objective")
    if objective and objective_column:
        filters.append(f"{objective_column} = :objective")
        params["objective"] = _parse_column_value(objective, columns.get(objective_column))
        applied_filters["objective"] = params["objective"]
    elif objective and not objective_column:
        ignored_filters["objective"] = "missing_column"

    campaign_column = "campaign_id" if "campaign_id" in columns else None
    if not campaign_id and campaign_column:
        campaign_id = default_filters.get("campaign_id")
    if campaign_id and campaign_column:
        if not _supports_filter(config, "campaign_id"):
            ignored_filters["campaign_id"] = "unsupported"
        else:
            filters.append(f"{campaign_column} = :campaign_id")
            params["campaign_id"] = _parse_column_value(campaign_id, columns.get(campaign_column))
            applied_filters["campaign_id"] = params["campaign_id"]
    elif campaign_id and not campaign_column:
        ignored_filters["campaign_id"] = "missing_column"

    adset_column = None
    if "adset_id" in columns:
        adset_column = "adset_id"
    elif "ad_set_id" in columns:
        adset_column = "ad_set_id"
    elif "adgroup_id" in columns:
        adset_column = "adgroup_id"

    if not adset_id and adset_column:
        adset_id = default_filters.get("adset_id") or default_filters.get("ad_set_id")
    if adset_id and adset_column:
        if not _supports_filter(config, "adset_id"):
            ignored_filters["adset_id"] = "unsupported"
        else:
            filters.append(f"{adset_column} = :adset_id")
            params["adset_id"] = _parse_column_value(adset_id, columns.get(adset_column))
            applied_filters["adset_id"] = params["adset_id"]
    elif adset_id and not adset_column:
        ignored_filters["adset_id"] = "missing_column"

    ad_group_column = None
    if "ad_group_id" in columns:
        ad_group_column = "ad_group_id"
    elif "adgroup_id" in columns:
        ad_group_column = "adgroup_id"

    if not ad_group_id and ad_group_column:
        ad_group_id = default_filters.get("ad_group_id")
    if ad_group_id and ad_group_column:
        if not _supports_filter(config, "ad_group_id"):
            ignored_filters["ad_group_id"] = "unsupported"
        else:
            filters.append(f"{ad_group_column} = :ad_group_id")
            params["ad_group_id"] = _parse_column_value(ad_group_id, columns.get(ad_group_column))
            applied_filters["ad_group_id"] = params["ad_group_id"]
    elif ad_group_id and not ad_group_column:
        ignored_filters["ad_group_id"] = "missing_column"
    device_column = None
    if "device" in columns:
        device_column = "device"
    elif "device_type" in columns:
        device_column = "device_type"
    elif "device_category" in columns:
        device_column = "device_category"

    if not _supports_filter(config, "device"):
        if device is not None:
            ignored_filters["device"] = "unsupported"
        device = None
    if not device and device_column:
        device = default_filters.get("device")
    if device and device_column:
        filters.append(f"{device_column} = :device")
        params["device"] = _parse_column_value(device, columns.get(device_column))
        applied_filters["device"] = params["device"]
    elif device and not device_column:
        ignored_filters["device"] = "missing_column"

    conversion_column = None
    if "conversion_type" in columns:
        conversion_column = "conversion_type"
    elif "conv_type" in columns:
        conversion_column = "conv_type"
    elif "event_type" in columns:
        conversion_column = "event_type"
    elif "metric_key" in columns:
        conversion_column = "metric_key"

    if not _supports_filter(config, "conversion_type"):
        if conversion_type is not None:
            ignored_filters["conversion_type"] = "unsupported"
        conversion_type = None
    if not conversion_type and conversion_column:
        conversion_type = default_filters.get("conversion_type") or default_filters.get("metric_key")
    if conversion_type and conversion_column:
        filters.append(f"{conversion_column} = :conversion_type")
        params["conversion_type"] = _parse_column_value(conversion_type, columns.get(conversion_column))
        applied_filters["conversion_type"] = params["conversion_type"]
    elif conversion_type and not conversion_column:
        ignored_filters["conversion_type"] = "missing_column"
    entity_column = _resolve_entity_column(config)
    if entity_id and entity_column and entity_column in columns:
        if not _supports_filter(config, "entity_id"):
            ignored_filters["entity_id"] = "unsupported"
        else:
            filters.append(f"{entity_column} = :entity_id")
            params["entity_id"] = _parse_entity_id(entity_id, columns.get(entity_column))
            applied_filters["entity_id"] = params["entity_id"]
    elif entity_id and not entity_column:
        ignored_filters["entity_id"] = "missing_column"

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    order_by_sql = _parse_order_by(order_by, columns) if order_by else None
    if not order_by_sql and config.default_order_by:
        order_by_sql = _parse_order_by(config.default_order_by, columns)
    order_clause = f"ORDER BY {order_by_sql}" if order_by_sql else ""
    limit_value = limit or config.default_limit or 200

    query = text(
        f"""
        SELECT *
        FROM {config.view}
        {where_sql}
        {order_clause}
        LIMIT :limit
        OFFSET :offset
        """
    )
    params.update({"limit": limit_value + 1, "offset": offset})

    query_started = time.monotonic()
    try:
        result = await session.execute(query, params)
    except ProgrammingError as exc:
        message = str(exc.orig or exc)
        if "UndefinedTableError" in message or "does not exist" in message:
            return {"widget_key": widget_key, "items": [], "missing_view": True}
        raise
    query_ms = (time.monotonic() - query_started) * 1000
    rows = result.mappings().all()
    has_more = len(rows) > limit_value
    if has_more:
        rows = rows[:limit_value]
    items = [dict(row) for row in rows]

    city_supported = _supports_filter(config, "city")
    city_output_column = None
    if city_supported:
        if config.city_column and config.city_column in columns:
            city_output_column = config.city_column
        elif "city_id" in columns:
            city_output_column = "city_id"
        elif "id_city" in columns:
            city_output_column = "id_city"

    if city_output_column and items:
        fallback_city = (
            params.get("id_city")
            or default_filters.get("id_city")
            or default_filters.get("city_id")
            or 4
        )
        fallback_city = _parse_column_value(fallback_city, columns.get(city_output_column))
        for item in items:
            city_value = item.get(city_output_column)
            if city_value is None:
                city_value = fallback_city
                item[city_output_column] = city_value
            # Unified response contract for attribution/pages expecting city_id.
            if "city_id" not in item:
                item["city_id"] = city_value

    meta: dict = {
        "widget_key": widget_key,
        "sem_view": config.view,
        "grain": config.grain,
        "supports_filters": config.supports_filters or {},
        "available_filters": _available_filters(config.supports_filters),
        "applied_filters": applied_filters,
        "query_ms": round(query_ms, 2),
        "row_count": len(rows),
    }
    override_meta = _WIDGET_META_OVERRIDES.get(widget_key)
    if override_meta:
        meta.update(override_meta)
    if "currency_code" in columns and not meta.get("currency_code"):
        codes = {row.get("currency_code") for row in rows if row.get("currency_code")}
        if len(codes) == 1:
            meta["currency_code"] = next(iter(codes))
        elif len(codes) > 1:
            meta["currency_code"] = "mixed"

    return {
        "widget_key": widget_key,
        "items": items,
        "has_more": has_more,
        "applied_filters": applied_filters,
        "ignored_filters": ignored_filters,
        "meta": meta,
    }


@router.get("/widgets/{widget_key}/meta")
async def get_widget_meta(
    widget_key: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
    core_session: AsyncSession = Depends(get_async_session),
):
    config = await _load_widget_config(core_session, widget_key)
    org_id = await _get_user_org_id(core_session, current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="User has no active organization")

    schema, table = _split_view(config.view)
    columns = await _get_columns(session, schema, table)
    if not columns:
        return {
            "widget_key": widget_key,
            "missing_view": True,
            "sem_view": config.view,
        }

    required_columns = _normalize_required_columns(config.required_columns)
    missing_columns = [column for column in required_columns if column not in columns] if required_columns else []

    return {
        "widget_key": widget_key,
        "sem_view": config.view,
        "grain": config.grain,
        "entity_type": config.entity_type,
        "date_column": config.date_column,
        "city_column": config.city_column,
        "supports_filters": config.supports_filters or {},
        "available_filters": _available_filters(config.supports_filters),
        "required_columns": required_columns,
        "missing_columns": missing_columns,
        "columns": sorted(columns.keys()),
        "default_filters": config.default_filters or {},
        "default_limit": config.default_limit,
        "default_order_by": config.default_order_by,
    }


@router.post("/widgets/batch")
async def get_widgets_batch(
    payload: BatchWidgetsPayload,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
    core_session: AsyncSession = Depends(get_async_session),
):
    org_id = await _get_user_org_id(core_session, current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="User has no active organization")

    redis = get_redis_client(decode_responses=True)
    global_filters = _compact_filters(payload.global_filters or {})
    results: Dict[str, dict] = {}

    for widget in payload.widgets:
        alias = widget.alias or widget.widget_key
        merged = {**global_filters, **(widget.filters or {})}
        merged = _compact_filters(merged)
        for key in ("start_date", "end_date", "date_from", "date_to"):
            if key in merged:
                merged[key] = _parse_iso_date(merged[key])

        limit = widget.limit if widget.limit is not None else merged.pop("limit", None)
        offset = widget.offset if widget.offset is not None else merged.pop("offset", 0)
        order_by = widget.order_by if widget.order_by is not None else merged.pop("order_by", None)

        cache_payload = {**merged, "limit": limit, "offset": offset, "order_by": order_by}
        cache_key = _batch_cache_key(org_id, widget.widget_key, cache_payload)
        if redis:
            try:
                cached = await redis.get(cache_key)
                if cached:
                    cached_payload = json.loads(cached)
                    cached_payload["alias"] = alias
                    results[alias] = cached_payload
                    continue
            except Exception:
                redis = None

        try:
            data = await get_widget_data(
                widget_key=widget.widget_key,
                start_date=merged.get("start_date"),
                end_date=merged.get("end_date"),
                date_from=merged.get("date_from"),
                date_to=merged.get("date_to"),
                id_city=merged.get("id_city"),
                city_id=merged.get("city_id"),
                product=merged.get("product"),
                branch=merged.get("branch"),
                source=merged.get("source"),
                platform=merged.get("platform"),
                channel=merged.get("channel"),
                device=merged.get("device"),
                conversion_type=merged.get("conversion_type"),
                status=merged.get("status"),
                objective=merged.get("objective"),
                campaign_id=merged.get("campaign_id"),
                adset_id=merged.get("adset_id"),
                ad_group_id=merged.get("ad_group_id"),
                entity_id=merged.get("entity_id"),
                limit=limit,
                offset=offset or 0,
                order_by=order_by,
                current_user=current_user,
                session=session,
                core_session=core_session,
            )
            data["alias"] = alias
            results[alias] = data
            if redis:
                try:
                    await redis.setex(cache_key, 120, json.dumps(data, default=str))
                except Exception:
                    redis = None
        except HTTPException as exc:
            results[alias] = {
                "widget_key": widget.widget_key,
                "alias": alias,
                "items": [],
                "error": exc.detail,
            }
    return {"items": results}


@router.get("/widgets/ads/ads_daily", response_model=AdsDailyResponse)
async def get_ads_daily_widget(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    id_city: Optional[int] = Query(default=None, alias="id_city"),
    city_id: Optional[int] = Query(default=None, alias="city_id"),
    platform: Optional[str] = Query(default=None),
    limit: Optional[int] = Query(default=None, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    order_by: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
    core_session: AsyncSession = Depends(get_async_session),
):
    return await get_widget_data(
        widget_key="ads.ads_daily",
        date_from=date_from,
        date_to=date_to,
        id_city=id_city or city_id,
        platform=platform,
        limit=limit,
        offset=offset,
        order_by=order_by,
        current_user=current_user,
        session=session,
        core_session=core_session,
    )


@router.get("/widgets/ads/ads_anomalies_7d", response_model=AdsAnomaliesResponse)
async def get_ads_anomalies_widget(
    id_city: Optional[int] = Query(default=None, alias="id_city"),
    city_id: Optional[int] = Query(default=None, alias="city_id"),
    platform: Optional[str] = Query(default=None),
    limit: Optional[int] = Query(default=None, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    order_by: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
    core_session: AsyncSession = Depends(get_async_session),
):
    return await get_widget_data(
        widget_key="ads.ads_anomalies_7d",
        id_city=id_city or city_id,
        platform=platform,
        limit=limit,
        offset=offset,
        order_by=order_by,
        current_user=current_user,
        session=session,
        core_session=core_session,
    )


@router.get("/widgets/{widget_key}/range")
async def get_widget_date_range(
    widget_key: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
    core_session: AsyncSession = Depends(get_async_session),
):
    config = await _load_widget_config(core_session, widget_key)
    org_id = await _get_user_org_id(core_session, current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="User has no active organization")

    schema, table = _split_view(config.view)
    columns = await _get_columns(session, schema, table)
    if not columns:
        return {"widget_key": widget_key, "min_date": None, "max_date": None}

    date_column = config.date_column if config.date_column in columns else None
    if not date_column:
        for candidate in ("date", "day", "dt", "as_of_date", "contract_date_key"):
            if candidate in columns:
                date_column = candidate
                break

    if not date_column:
        return {"widget_key": widget_key, "min_date": None, "max_date": None}

    query = text(
        f"""
        SELECT MIN({date_column}) as min_date, MAX({date_column}) as max_date
        FROM {config.view}
        """
    )
    result = await session.execute(query)
    row = result.mappings().first() or {}
    return {
        "widget_key": widget_key,
        "min_date": row.get("min_date"),
        "max_date": row.get("max_date"),
    }


def _map_widget_to_agent(widget_key: str) -> Optional[str]:
    if widget_key in {"budget_pacing", "data_freshness_quality"}:
        return widget_key
    if widget_key.startswith(("ads.", "campaigns.", "sources.")):
        return "budget_pacing"
    if widget_key.startswith("data."):
        return "data_freshness_quality"
    return None


def _parse_iso_date(value: object) -> object:
    if value is None:
        return value
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return value
    return value


def _compact_filters(filters: Dict[str, object]) -> Dict[str, object]:
    return {key: value for key, value in filters.items() if value is not None and value != ""}


def _batch_cache_key(org_id: str, widget_key: str, payload: Dict[str, object]) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str)
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return f"widgets:{_CACHE_VERSION}:{org_id}:{widget_key}:{digest}"


@router.get("/insights")
async def get_widget_insights(
    widget_key: Optional[str] = Query(default=None, description="Widget key to filter AI insights"),
    agent_key: Optional[str] = Query(default=None, description="Agent key override for AI insights"),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    id_city: Optional[int] = Query(default=None, alias="id_city"),
    city_id: Optional[int] = Query(default=None, alias="city_id"),
    severity: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    tenant: Optional[str] = Query(default=None, description="Tenant key for AI data"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
    core_session: AsyncSession = Depends(get_async_session),
):
    resolved_agent_keys: list[str] = []
    insights_view: Optional[str] = None
    insights_date_column: Optional[str] = None
    insights_city_column: Optional[str] = None
    insights_severity_column: Optional[str] = None
    insights_tenant_column: Optional[str] = None

    if widget_key:
        registry_config = await _resolve_widget_insights_config(core_session, widget_key)
        resolved_agent_keys = registry_config.get("agent_keys") or []
        insights_view = registry_config.get("insights_view")  # type: ignore[assignment]
        insights_date_column = registry_config.get("insights_date_column")  # type: ignore[assignment]
        insights_city_column = registry_config.get("insights_city_column")  # type: ignore[assignment]
        insights_severity_column = registry_config.get("insights_severity_column")  # type: ignore[assignment]
        insights_tenant_column = registry_config.get("insights_tenant_column")  # type: ignore[assignment]

    if agent_key:
        resolved_agent_keys = [agent_key]

    if not resolved_agent_keys and widget_key:
        fallback_agent = _map_widget_to_agent(widget_key)
        if fallback_agent:
            resolved_agent_keys = [fallback_agent]

    if not resolved_agent_keys:
        return {"widget_key": widget_key or agent_key or "unknown", "items": []}

    view_name = insights_view or "ai.v_agent_recommendations"
    schema, table = _split_view(view_name)
    columns = await _get_columns(session, schema, table)
    if not columns:
        return {"widget_key": widget_key or resolved_agent_keys[0], "items": []}

    filters = []
    params: Dict[str, object] = {"limit": limit, "offset": offset}

    if len(resolved_agent_keys) == 1 and "agent_key" in columns:
        filters.append("agent_key = :agent_key")
        params["agent_key"] = resolved_agent_keys[0]
    elif len(resolved_agent_keys) > 1 and "agent_key" in columns:
        placeholders = []
        for idx, key in enumerate(resolved_agent_keys):
            param_key = f"agent_key_{idx}"
            placeholders.append(f":{param_key}")
            params[param_key] = key
        filters.append(f"agent_key IN ({', '.join(placeholders)})")

    if widget_key and "widget_key" in columns:
        filters.append("widget_key = :widget_key")
        params["widget_key"] = widget_key

    if insights_severity_column and insights_severity_column in columns:
        severity_column = insights_severity_column
    else:
        severity_column = "severity" if "severity" in columns else None

    if severity and severity_column:
        coerced_severity = _coerce_severity_param(severity, columns.get(severity_column))
        if coerced_severity is not None:
            filters.append(f"{severity_column} = :severity")
            params["severity"] = coerced_severity

    if id_city is None:
        id_city = city_id
    city_column = None
    if insights_city_column and insights_city_column in columns:
        city_column = insights_city_column
    elif "city_id" in columns:
        city_column = "city_id"
    elif "id_city" in columns:
        city_column = "id_city"
    if id_city is not None and city_column:
        filters.append(f"{city_column} = :id_city")
        params["id_city"] = id_city

    date_column = None
    if insights_date_column and insights_date_column in columns:
        date_column = insights_date_column
    else:
        for candidate in ("as_of_date_d", "as_of_date", "date_key", "date"):
            if candidate in columns:
                date_column = candidate
                break
    if date_from and date_column:
        filters.append(f"{date_column} >= :date_from")
        params["date_from"] = _coerce_date_param(date_from, columns.get(date_column))
    if date_to and date_column:
        filters.append(f"{date_column} <= :date_to")
        params["date_to"] = _coerce_date_param(date_to, columns.get(date_column))

    if insights_tenant_column and insights_tenant_column in columns:
        tenant_column = insights_tenant_column
    else:
        tenant_column = "tenant" if "tenant" in columns else None
    if tenant and tenant_column:
        filters.append(f"{tenant_column} = :tenant")
        params["tenant"] = tenant

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    order_by = None
    if "created_at" in columns:
        order_by = "created_at DESC"
    elif "run_row_id" in columns:
        order_by = "run_row_id DESC"
    elif "as_of_date" in columns:
        order_by = "as_of_date DESC"

    select_fields: list[str] = []
    for candidate in (
        "id",
        "run_row_id",
        "widget_key",
        "agent_key",
        "severity",
        "title",
        "summary",
        "recommendation",
        "metrics_json",
        "metrics",
        "evidence_json",
        "evidence",
        "confidence",
        "valid_from",
        "valid_to",
        "as_of_date",
        "as_of_date_d",
        "created_at",
        "city_id",
        "id_city",
        "city_name",
        "entity_type",
        "entity_id",
        "tags",
    ):
        if candidate in columns:
            select_fields.append(candidate)
    if not select_fields:
        select_fields = ["*"]

    query = text(
        f"""
        SELECT {', '.join(select_fields)}
        FROM {view_name}
        {where_sql}
        {f'ORDER BY {order_by}' if order_by else ''}
        LIMIT :limit
        OFFSET :offset
        """
    )
    result = await session.execute(query, params)
    rows = result.mappings().all()

    items = []
    for row in rows:
        items.append(
            {
                "id": row.get("id") or row.get("run_row_id"),
                "widget_key": row.get("widget_key") or widget_key or resolved_agent_keys[0],
                "agent_key": row.get("agent_key") or resolved_agent_keys[0],
                "severity": row.get("severity"),
                "title": row.get("title"),
                "summary": row.get("summary") or row.get("recommendation"),
                "metrics_json": row.get("metrics_json") or row.get("metrics"),
                "evidence_ref": row.get("evidence_json") or row.get("evidence"),
                "confidence": row.get("confidence"),
                "valid_from": row.get("valid_from") or row.get("as_of_date") or row.get("as_of_date_d"),
                "valid_to": row.get("valid_to"),
                "tags": row.get("tags"),
                "created_at": row.get("created_at"),
                "city_id": row.get("city_id") or row.get("id_city"),
                "city_name": row.get("city_name"),
                "entity_type": row.get("entity_type"),
                "entity_id": row.get("entity_id"),
            }
        )
    return {"widget_key": widget_key or resolved_agent_keys[0], "items": items}


@router.get("/agents")
async def get_ai_agents(
    tenant: Optional[str] = Query(default=None, description="Tenant key for AI data"),
    limit: int = Query(default=200, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    resolved_tenant = tenant or "client_itstep"
    query = text(
        """
        SELECT
          agent_key,
          MAX(as_of_date_d) as last_as_of_date,
          COUNT(*) as runs,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_cnt,
          COUNT(*) FILTER (WHERE severity = 'warning') as warning_cnt,
          COUNT(*) FILTER (WHERE severity = 'info') as info_cnt
        FROM ai.agent_insights
        WHERE tenant = :tenant
        GROUP BY agent_key
        ORDER BY agent_key
        LIMIT :limit
        """
    )
    result = await session.execute(query, {"tenant": resolved_tenant, "limit": limit})
    rows = result.mappings().all()
    return {"items": [dict(row) for row in rows]}
