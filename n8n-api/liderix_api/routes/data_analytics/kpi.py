"""
KPI Cards endpoint for Data Analytics
Source: dashboards.v8_platform_daily_full (includes ALL traffic sources + full ad metrics)
"""
import logging
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.schemas.data_analytics import KPICardsResponse
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/kpi", response_model=KPICardsResponse)
async def get_kpi_cards(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        None,
        description="Comma-separated platforms (google,meta,direct,organic,email,other) or empty for all"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get KPI cards aggregated metrics for the period

    Returns: Leads, Contracts, Revenue, Spend, CPL, ROAS
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        # SQL query matching the spec
        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        query = text(f"""
            SELECT
                SUM(leads) AS leads,
                SUM(contracts) AS n_contracts,
                SUM(revenue) AS revenue,
                SUM(spend) AS spend,
                CASE WHEN SUM(leads) > 0
                    THEN SUM(spend)::numeric / NULLIF(SUM(leads), 0)
                END AS cpl,
                CASE WHEN SUM(spend) > 0
                    THEN SUM(revenue)::numeric / NULLIF(SUM(spend), 0)
                END AS roas
            FROM dashboards.v8_platform_daily_full
            WHERE dt BETWEEN :date_from AND :date_to
                {platform_filter}
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        row = result.fetchone()

        if not row:
            return KPICardsResponse(
                leads=0,
                n_contracts=0,
                revenue=0.0,
                spend=0.0,
                cpl=None,
                roas=None,
            )

        return KPICardsResponse(
            leads=int(row[0] or 0),
            n_contracts=int(row[1] or 0),
            revenue=float(row[2] or 0.0),
            spend=float(row[3] or 0.0),
            cpl=float(row[4]) if row[4] is not None else None,
            roas=float(row[5]) if row[5] is not None else None,
        )

    except Exception as e:
        logger.error(f"Error fetching KPI cards: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch KPI data: {str(e)}")


@router.get("/kpi/compare")
async def get_kpi_compare(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(None, description="Comma-separated platforms or empty for all"),
    compare_mode: str = Query("auto", description="auto|custom|disabled"),
    prev_from: Optional[date] = Query(None, description="Previous period start (for custom)"),
    prev_to: Optional[date] = Query(None, description="Previous period end (for custom)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get KPI with Period-over-Period comparison.

    Compare modes:
    - auto: previous period = same length, right before current
    - custom: use prev_from/prev_to
    - disabled: only current period (no comparison)

    Source: dashboards.v8_platform_daily_full (includes ALL traffic sources + full ad metrics)
    """
    try:
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        # Calculate previous period for auto mode
        if compare_mode == "auto":
            days = (date_to - date_from).days + 1
            from datetime import timedelta
            prev_to = date_from - timedelta(days=1)
            prev_from = prev_to - timedelta(days=days - 1)

        # Build platform filter
        if platforms_list:
            platform_filter = "AND platform = ANY(:platforms)"
        else:
            platform_filter = ""

        # SQL from TZ lines 56-100
        query = text(f"""
            WITH bounds AS (
              SELECT :date_from::date AS df, :date_to::date AS dt
            ),
            win AS ( SELECT df, dt, (dt - df + 1) AS days FROM bounds ),
            cur AS (
              SELECT SUM(leads) leads, SUM(contracts) n_contracts,
                     SUM(revenue) revenue, SUM(spend) spend
              FROM dashboards.v8_platform_daily_full d
              WHERE d.dt BETWEEN (SELECT df FROM bounds) AND (SELECT dt FROM bounds)
                {platform_filter}
            ),
            prev AS (
              SELECT SUM(leads) leads, SUM(contracts) n_contracts,
                     SUM(revenue) revenue, SUM(spend) spend
              FROM dashboards.v8_platform_daily_full d
              WHERE d.dt BETWEEN :prev_from::date AND :prev_to::date
                {platform_filter}
            )
            SELECT
              cur.leads      AS leads_cur,
              prev.leads     AS leads_prev,
              (cur.leads - COALESCE(prev.leads, 0)) AS leads_diff,
              CASE WHEN COALESCE(prev.leads, 0) > 0
                   THEN (cur.leads - prev.leads)::numeric * 100 / prev.leads
              END AS leads_diff_pct,

              cur.n_contracts AS n_contracts_cur,
              prev.n_contracts AS n_contracts_prev,
              (cur.n_contracts - COALESCE(prev.n_contracts, 0)) AS n_contracts_diff,
              CASE WHEN COALESCE(prev.n_contracts, 0) > 0
                   THEN (cur.n_contracts - prev.n_contracts)::numeric * 100 / prev.n_contracts
              END AS n_contracts_diff_pct,

              cur.revenue AS revenue_cur,
              prev.revenue AS revenue_prev,
              (cur.revenue - COALESCE(prev.revenue, 0)) AS revenue_diff,
              CASE WHEN COALESCE(prev.revenue, 0) > 0
                   THEN (cur.revenue - prev.revenue)::numeric * 100 / prev.revenue
              END AS revenue_diff_pct,

              cur.spend AS spend_cur,
              prev.spend AS spend_prev,
              (cur.spend - COALESCE(prev.spend, 0)) AS spend_diff,
              CASE WHEN COALESCE(prev.spend, 0) > 0
                   THEN (cur.spend - prev.spend)::numeric * 100 / prev.spend
              END AS spend_diff_pct,

              CASE WHEN cur.leads > 0 THEN cur.spend::numeric / NULLIF(cur.leads, 0) END AS cpl_cur,
              CASE WHEN COALESCE(prev.leads, 0) > 0 THEN prev.spend::numeric / NULLIF(prev.leads, 0) END AS cpl_prev,

              CASE WHEN cur.spend > 0 THEN cur.revenue::numeric / NULLIF(cur.spend, 0) END AS roas_cur,
              CASE WHEN COALESCE(prev.spend, 0) > 0 THEN prev.revenue::numeric / NULLIF(prev.spend, 0) END AS roas_prev
            FROM cur, prev
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "prev_from": prev_from if compare_mode != "disabled" else date_from,
            "prev_to": prev_to if compare_mode != "disabled" else date_from,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        row = result.fetchone()

        if not row:
            return {
                "leads_cur": 0, "leads_prev": 0, "leads_diff": 0, "leads_diff_pct": None,
                "n_contracts_cur": 0, "n_contracts_prev": 0, "n_contracts_diff": 0, "n_contracts_diff_pct": None,
                "revenue_cur": 0.0, "revenue_prev": 0.0, "revenue_diff": 0.0, "revenue_diff_pct": None,
                "spend_cur": 0.0, "spend_prev": 0.0, "spend_diff": 0.0, "spend_diff_pct": None,
                "cpl_cur": None, "cpl_prev": None, "roas_cur": None, "roas_prev": None,
            }

        return {
            "leads_cur": int(row[0] or 0),
            "leads_prev": int(row[1] or 0),
            "leads_diff": int(row[2] or 0),
            "leads_diff_pct": float(row[3]) if row[3] is not None else None,
            "n_contracts_cur": int(row[4] or 0),
            "n_contracts_prev": int(row[5] or 0),
            "n_contracts_diff": int(row[6] or 0),
            "n_contracts_diff_pct": float(row[7]) if row[7] is not None else None,
            "revenue_cur": float(row[8] or 0.0),
            "revenue_prev": float(row[9] or 0.0),
            "revenue_diff": float(row[10] or 0.0),
            "revenue_diff_pct": float(row[11]) if row[11] is not None else None,
            "spend_cur": float(row[12] or 0.0),
            "spend_prev": float(row[13] or 0.0),
            "spend_diff": float(row[14] or 0.0),
            "spend_diff_pct": float(row[15]) if row[15] is not None else None,
            "cpl_cur": float(row[16]) if row[16] is not None else None,
            "cpl_prev": float(row[17]) if row[17] is not None else None,
            "roas_cur": float(row[18]) if row[18] is not None else None,
            "roas_prev": float(row[19]) if row[19] is not None else None,
        }

    except Exception as e:
        logger.error(f"Error fetching KPI compare: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch KPI compare: {str(e)}")
