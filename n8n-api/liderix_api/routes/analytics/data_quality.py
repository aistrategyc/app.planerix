from datetime import date, timedelta
import re
import time
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_itstep_session

router = APIRouter()

_SAFE_IDENT_RE = re.compile(r"^[a-z_][a-z0-9_]*$")

_DATE_COL_CANDIDATES = ("date_key", "contract_date_key", "day_key")
_CITY_COL_CANDIDATES = ("city_id", "id_city")


def _safe_ident(value: str) -> str:
    if not value or not _SAFE_IDENT_RE.match(value):
        raise ValueError("Unsafe identifier")
    return value


_SAFE_LAST_TS_SQL = """
CASE
  WHEN f.item #>> '{last_ts}'::text[] IS NULL THEN NULL
  WHEN lower(trim(f.item #>> '{last_ts}'::text[])) IN ('unknown', 'неизвестно', 'n/a', 'na', '-') THEN NULL
  WHEN (f.item #>> '{last_ts}'::text[]) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (f.item #>> '{last_ts}'::text[])::timestamptz
  ELSE NULL
END
"""


@router.get("/freshness")
async def get_data_freshness(
    tenant: str = Query(default="client_itstep"),
    agent_key: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Read-only data freshness signals from itstep_final.ai.agent_insights.
    Uses a safe cast for last_ts to avoid invalid timestamp payloads.
    """
    if agent_key is None:
        query = text(
            """
            SELECT
              ai.agent_key,
              ai.as_of_date,
              f.ord::integer AS row_idx,
              f.item #>> '{obj}'::text[] AS obj,
              """
            + _SAFE_LAST_TS_SQL
            + """
              AS last_ts
            FROM ai.agent_insights ai
            LEFT JOIN LATERAL jsonb_array_elements(ai.payload #> '{data_quality,freshness}'::text[])
              WITH ORDINALITY f(item, ord) ON true
            WHERE ai.tenant = :tenant
            ORDER BY last_ts DESC NULLS LAST
            LIMIT :limit
            """
        )
        params = {"tenant": tenant, "limit": limit}
    else:
        query = text(
            """
            SELECT
              ai.agent_key,
              ai.as_of_date,
              f.ord::integer AS row_idx,
              f.item #>> '{obj}'::text[] AS obj,
              """
            + _SAFE_LAST_TS_SQL
            + """
              AS last_ts
            FROM ai.agent_insights ai
            LEFT JOIN LATERAL jsonb_array_elements(ai.payload #> '{data_quality,freshness}'::text[])
              WITH ORDINALITY f(item, ord) ON true
            WHERE ai.tenant = :tenant
              AND ai.agent_key = :agent_key
            ORDER BY last_ts DESC NULLS LAST
            LIMIT :limit
            """
        )
        params = {"tenant": tenant, "agent_key": agent_key, "limit": limit}

    result = await session.execute(query, params)
    rows = result.mappings().all()
    return {"items": [dict(row) for row in rows]}


@router.get("/agent-ready")
async def get_agent_ready(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Read-only agent-ready metrics by city from sem_agent.city_day_agent_ready_mv.
    """
    if not date_to:
        latest = await session.execute(
            text("SELECT max(date_key) as max_date FROM sem_agent.city_day_agent_ready_mv")
        )
        max_date = latest.scalar()
        date_to = max_date if max_date else date.today()

    if not date_from:
        date_from = date_to - timedelta(days=30)

    query = text(
        """
        SELECT
          date_key,
          id_city,
          city_name,
          contracts_all,
          contracts_meta,
          contracts_gads,
          contracts_offline,
          spend_all,
          spend_meta,
          spend_gads,
          cpa_all_contracts,
          cpa_paid_contracts,
          offline_share,
          refreshed_at
        FROM sem_agent.city_day_agent_ready_mv
        WHERE date_key >= :date_from
          AND date_key <= :date_to
        ORDER BY date_key DESC, city_name
        LIMIT :limit
        """
    )

    result = await session.execute(
        query,
        {"date_from": date_from, "date_to": date_to, "limit": limit},
    )
    rows = result.mappings().all()
    return {"items": [dict(row) for row in rows]}


@router.get("/coverage")
async def get_data_coverage(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    limit_views: int = Query(default=50, ge=1, le=200),
    schema: str = Query(default="sem_ui"),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Health coverage diagnostics for analytics DB (itstep_final).

    Returns:
    - paid_contracts_creatives: coverage of creative_id/preview_image_url for paid contracts
    - city_id_coverage: NULL city_id/id_city ratio for sem_ui views within the selected date range
    """
    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=30)

    schema = _safe_ident(schema)

    # 1) Paid contracts creative/preview coverage (contracts_attributed_detail_display_v2 is our canonical source).
    paid_query = text(
        """
        WITH base AS (
          SELECT
            attributed_platform,
            creative_id,
            preview_image_url
          FROM sem_ui.contracts_attributed_detail_display_v2
          WHERE contract_date_key >= :date_from
            AND contract_date_key <= :date_to
            AND is_paid_attributed = true
        )
        SELECT
          attributed_platform,
          count(*)::bigint AS paid_rows,
          count(*) FILTER (WHERE NULLIF(creative_id, '') IS NOT NULL)::bigint AS with_creative,
          count(*) FILTER (WHERE NULLIF(preview_image_url, '') IS NOT NULL)::bigint AS with_preview
        FROM base
        GROUP BY 1
        ORDER BY 1
        """
    )
    paid_start = time.perf_counter()
    paid_rows = (await session.execute(paid_query, {"date_from": date_from, "date_to": date_to})).mappings().all()
    paid_ms = (time.perf_counter() - paid_start) * 1000.0

    paid_total = {"paid_rows": 0, "with_creative": 0, "with_preview": 0}
    for row in paid_rows:
        paid_total["paid_rows"] += int(row["paid_rows"] or 0)
        paid_total["with_creative"] += int(row["with_creative"] or 0)
        paid_total["with_preview"] += int(row["with_preview"] or 0)

    # 2) City column coverage across sem_ui views.
    # We intentionally limit to sem_ui and a small candidate set of date/city column names to keep it fast and predictable.
    views_query = text(
        """
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = :schema
        ORDER BY table_name
        LIMIT :limit_views
        """
    )
    view_names = (
        (await session.execute(views_query, {"schema": schema, "limit_views": limit_views}))
        .scalars()
        .all()
    )

    coverage_items: list[dict] = []
    for view_name in view_names:
        try:
            view_name = _safe_ident(str(view_name))
        except ValueError:
            continue

        cols = (
            await session.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = :schema
                      AND table_name = :view
                    """
                ),
                {"schema": schema, "view": view_name},
            )
        ).scalars().all()
        colset = {str(c) for c in cols}

        date_col = next((c for c in _DATE_COL_CANDIDATES if c in colset), None)
        city_col = next((c for c in _CITY_COL_CANDIDATES if c in colset), None)
        if not date_col or not city_col:
            continue

        # dynamic SQL is required for identifiers; we keep it safe by whitelisting identifiers above.
        stmt = text(
            f"""
            SELECT
              count(*)::bigint AS rows_total,
              count(*) FILTER (WHERE {city_col} IS NULL)::bigint AS rows_city_null,
              max({date_col}) AS max_date,
              min({date_col}) AS min_date
            FROM {schema}.{view_name}
            WHERE {date_col} >= :date_from
              AND {date_col} <= :date_to
            """
        )
        start = time.perf_counter()
        row = (await session.execute(stmt, {"date_from": date_from, "date_to": date_to})).mappings().first()
        query_ms = (time.perf_counter() - start) * 1000.0

        rows_total = int(row["rows_total"] or 0) if row else 0
        rows_city_null = int(row["rows_city_null"] or 0) if row else 0
        ratio = (rows_city_null / rows_total) if rows_total else None

        coverage_items.append(
            {
                "obj": f"{schema}.{view_name}",
                "date_column": date_col,
                "city_column": city_col,
                "date_from": str(date_from),
                "date_to": str(date_to),
                "rows_total": rows_total,
                "rows_city_null": rows_city_null,
                "city_null_ratio": ratio,
                "min_date": str(row["min_date"]) if row and row.get("min_date") else None,
                "max_date": str(row["max_date"]) if row and row.get("max_date") else None,
                "query_ms": round(query_ms, 2),
            }
        )

    # Show worst offenders first.
    coverage_items.sort(key=lambda x: (x["city_null_ratio"] is None, -(x["city_null_ratio"] or 0.0), -(x["rows_total"] or 0)))

    return {
        "meta": {
            "date_from": str(date_from),
            "date_to": str(date_to),
            "schema": schema,
            "limit_views": limit_views,
            "paid_query_ms": round(paid_ms, 2),
        },
        "paid_contracts_creatives": {
            "total": {
                **paid_total,
                "creative_ratio": (paid_total["with_creative"] / paid_total["paid_rows"]) if paid_total["paid_rows"] else None,
                "preview_ratio": (paid_total["with_preview"] / paid_total["paid_rows"]) if paid_total["paid_rows"] else None,
            },
            "by_platform": [dict(r) for r in paid_rows],
        },
        "city_id_coverage": {"items": coverage_items},
    }
