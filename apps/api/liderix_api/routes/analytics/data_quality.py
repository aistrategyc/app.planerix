from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from liderix_api.db import get_itstep_session

router = APIRouter()


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
              NULLIF(f.item #>> '{last_ts}'::text[], 'unknown')::timestamptz AS last_ts
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
              NULLIF(f.item #>> '{last_ts}'::text[], 'unknown')::timestamptz AS last_ts
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
