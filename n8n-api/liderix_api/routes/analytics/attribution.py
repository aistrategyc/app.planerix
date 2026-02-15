from __future__ import annotations

from datetime import date, timedelta
import hashlib
import json
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_async_session, get_itstep_session
from liderix_api.models.users import User
from liderix_api.services.auth import get_current_user
from liderix_api.services.redis_client import get_redis_client

from .widgets import get_widget_data, _load_widget_config, _get_user_org_id

router = APIRouter(prefix="/attribution")

DEFAULT_WIDGETS_BY_TAB: Dict[str, List[str]] = {
    "overview": [
        "attr.overview.kpi_total",
        "attr.overview.ts_core",
        "attr.overview.channel_mix",
        "attr.overview.coverage",
    ],
}


def _shift_year(value: date, years: int) -> date:
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        return value - timedelta(days=365 * abs(years))


def _resolve_compare_range(
    compare: Optional[str],
    date_from: Optional[date],
    date_to: Optional[date],
    compare_from: Optional[date],
    compare_to: Optional[date],
) -> Optional[tuple[date, date]]:
    if compare in {None, "", "none"}:
        return None
    if compare == "custom":
        if compare_from and compare_to:
            return compare_from, compare_to
        return None
    if not date_from or not date_to:
        return None
    if compare == "prev_period":
        days = (date_to - date_from).days + 1
        return date_from - timedelta(days=days), date_to - timedelta(days=days)
    if compare == "prev_year":
        return _shift_year(date_from, -1), _shift_year(date_to, -1)
    return None


@router.get("/widgets")
async def get_attribution_widgets(
    widget_keys: Optional[List[str]] = Query(default=None, alias="widget_keys"),
    tab: Optional[str] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    compare: Optional[str] = Query(default=None),
    compare_from: Optional[date] = Query(default=None),
    compare_to: Optional[date] = Query(default=None),
    id_city: Optional[int] = Query(default=None, alias="id_city"),
    city_id: Optional[int] = Query(default=None, alias="city_id"),
    platform: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    device: Optional[str] = Query(default=None),
    conversion_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    objective: Optional[str] = Query(default=None),
    campaign_id: Optional[str] = Query(default=None),
    adset_id: Optional[str] = Query(default=None),
    ad_group_id: Optional[str] = Query(default=None),
    product: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    entity_id: Optional[str] = Query(default=None),
    limit: Optional[int] = Query(default=None, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    order_by: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
    core_session: AsyncSession = Depends(get_async_session),
):
    if date_from is None:
        date_from = start_date
    if date_to is None:
        date_to = end_date
    resolved_widget_keys = widget_keys or DEFAULT_WIDGETS_BY_TAB.get(tab or "", [])

    org_id = await _get_user_org_id(core_session, current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="User has no active organization")

    redis = get_redis_client(decode_responses=True)
    cache_key = None
    if redis:
        cache_payload = {
            "org_id": org_id,
            "widget_keys": resolved_widget_keys,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "compare": compare,
            "compare_from": compare_from.isoformat() if compare_from else None,
            "compare_to": compare_to.isoformat() if compare_to else None,
            "id_city": id_city or city_id,
            "platform": platform,
            "channel": channel,
            "device": device,
            "conversion_type": conversion_type,
            "status": status,
            "objective": objective,
            "campaign_id": campaign_id,
            "adset_id": adset_id,
            "ad_group_id": ad_group_id,
            "product": product,
            "source": source,
            "entity_id": entity_id,
            "limit": limit,
            "offset": offset,
            "order_by": order_by,
        }
        payload_hash = hashlib.sha256(json.dumps(cache_payload, sort_keys=True).encode()).hexdigest()
        cache_key = f"attr_widgets:{org_id}:{payload_hash}"
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            redis = None

    widgets: Dict[str, object] = {}
    for widget_key in resolved_widget_keys:
        try:
            config = await _load_widget_config(core_session, widget_key)
            response = await get_widget_data(
                widget_key=widget_key,
                start_date=None,
                end_date=None,
                date_from=date_from,
                date_to=date_to,
                id_city=id_city or city_id,
                city_id=None,
                branch=None,
                platform=platform,
                channel=channel,
                device=device,
                conversion_type=conversion_type,
                status=status,
                objective=objective,
                campaign_id=campaign_id,
                adset_id=adset_id,
                ad_group_id=ad_group_id,
                product=product,
                source=source,
                entity_id=entity_id,
                limit=limit,
                offset=offset,
                order_by=order_by,
                current_user=current_user,
                session=session,
                core_session=core_session,
            )
            widgets[widget_key] = {
                "data": {"current": response.get("items", [])},
                "meta": {
                    "widget_key": widget_key,
                    "missing_view": response.get("missing_view"),
                    "sem_view": config.view,
                    "grain": config.grain,
                    "supports_filters": getattr(config, "supports_filters", None),
                    "required_columns": getattr(config, "required_columns", None),
                    "applied_filters": response.get("applied_filters"),
                    "ignored_filters": response.get("ignored_filters"),
                },
            }
        except HTTPException as exc:
            widgets[widget_key] = {
                "data": {"current": []},
                "meta": {
                    "widget_key": widget_key,
                    "missing_view": True,
                    "error": exc.detail,
                },
            }

    compare_range = _resolve_compare_range(compare, date_from, date_to, compare_from, compare_to)
    if compare_range:
        compare_from_resolved, compare_to_resolved = compare_range
        for widget_key in resolved_widget_keys:
            try:
                response = await get_widget_data(
                    widget_key=widget_key,
                    start_date=None,
                    end_date=None,
                    date_from=compare_from_resolved,
                    date_to=compare_to_resolved,
                    id_city=id_city or city_id,
                    city_id=None,
                    branch=None,
                    platform=platform,
                    channel=channel,
                    device=device,
                    conversion_type=conversion_type,
                    status=status,
                    objective=objective,
                    campaign_id=campaign_id,
                    adset_id=adset_id,
                    ad_group_id=ad_group_id,
                    product=product,
                    source=source,
                    entity_id=entity_id,
                    limit=limit,
                    offset=offset,
                    order_by=order_by,
                    current_user=current_user,
                    session=session,
                    core_session=core_session,
                )
                if widget_key in widgets:
                    widgets[widget_key]["data"]["compare"] = response.get("items", [])
                else:
                    widgets[widget_key] = {
                        "data": {"compare": response.get("items", [])},
                        "meta": {"widget_key": widget_key, "missing_view": response.get("missing_view")},
                    }
            except HTTPException as exc:
                if widget_key in widgets:
                    widgets[widget_key]["data"]["compare"] = []
                    widgets[widget_key]["meta"]["missing_view"] = True
                    widgets[widget_key]["meta"]["error"] = exc.detail
                else:
                    widgets[widget_key] = {
                        "data": {"compare": []},
                        "meta": {"widget_key": widget_key, "missing_view": True, "error": exc.detail},
                    }

    response_payload = {
        "tab": tab,
        "widgets": widgets,
    }

    if redis and cache_key:
        try:
            await redis.set(cache_key, json.dumps(response_payload, default=str), ex=90)
        except Exception:
            pass

    return response_payload
