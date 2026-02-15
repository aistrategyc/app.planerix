"""
KPI Compare endpoint for Data Analytics v4
Source: dashboards.v5_bi_platform_daily
Compares current period vs previous period (PoP)
"""
import logging
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from liderix_api.db import get_itstep_session
from liderix_api.models.users import User
from liderix_api.services.dependencies import get_current_user
from liderix_api.schemas.data_analytics import KPICompareResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/kpi/compare", response_model=KPICompareResponse)
async def get_kpi_compare(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platforms: Optional[str] = Query(
        "google,meta",
        description="Comma-separated platforms (google,meta,email)"
    ),
    compare_mode: str = Query("auto", description="auto|disabled|custom"),
    prev_from: Optional[date] = Query(None, description="Previous period start (for custom mode)"),
    prev_to: Optional[date] = Query(None, description="Previous period end (for custom mode)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get KPI cards with Period-over-Period comparison

    Returns: KPI metrics with current vs previous period
    - auto: previous period = same length, immediately before current
    - custom: use prev_from/prev_to
    - disabled: only current period (prev values = 0)
    """
    try:
        # Parse platforms
        platforms_list = [p.strip() for p in platforms.split(",")] if platforms else []

        if platforms_list:
            platform_filter = "AND d.platform = ANY(:platforms)"
        else:
            platform_filter = ""

        # Calculate prev dates in Python to avoid CTE complexity
        from datetime import timedelta
        days = (date_to - date_from).days + 1
        if prev_from is None or prev_to is None:
            # auto mode: previous period = same length before current
            prev_from_calc = date_from - timedelta(days=days)
            prev_to_calc = date_from - timedelta(days=1)
        else:
            # custom mode: use provided dates
            prev_from_calc = prev_from
            prev_to_calc = prev_to

        # SQL query from spec (simplified without CTEs for date calculation)
        query = text(f"""
            WITH cur AS (
                SELECT
                    SUM(leads) AS leads,
                    SUM(n_contracts) AS n_contracts,
                    SUM(sum_contracts) AS revenue,
                    SUM(spend) AS spend
                FROM dashboards.v5_bi_platform_daily d
                WHERE d.dt BETWEEN :date_from AND :date_to
                    {platform_filter}
            ),
            prev AS (
                SELECT
                    SUM(leads) AS leads,
                    SUM(n_contracts) AS n_contracts,
                    SUM(sum_contracts) AS revenue,
                    SUM(spend) AS spend
                FROM dashboards.v5_bi_platform_daily d
                WHERE d.dt BETWEEN :prev_from AND :prev_to
                    {platform_filter}
            )
            SELECT
                cur.leads AS leads_cur,
                prev.leads AS leads_prev,
                (cur.leads - prev.leads) AS leads_diff,
                CASE WHEN prev.leads > 0 THEN (cur.leads - prev.leads)::numeric * 100 / prev.leads END AS leads_diff_pct,

                cur.n_contracts AS n_contracts_cur,
                prev.n_contracts AS n_contracts_prev,

                cur.revenue AS revenue_cur,
                prev.revenue AS revenue_prev,
                (cur.revenue - prev.revenue) AS revenue_diff,
                CASE WHEN prev.revenue > 0 THEN (cur.revenue - prev.revenue)::numeric * 100 / prev.revenue END AS revenue_diff_pct,

                cur.spend AS spend_cur,
                prev.spend AS spend_prev,
                (cur.spend - prev.spend) AS spend_diff,
                CASE WHEN prev.spend > 0 THEN (cur.spend - prev.spend)::numeric * 100 / prev.spend END AS spend_diff_pct,

                CASE WHEN cur.leads > 0 THEN cur.spend::numeric / NULLIF(cur.leads, 0) END AS cpl_cur,
                CASE WHEN prev.leads > 0 THEN prev.spend::numeric / NULLIF(prev.leads, 0) END AS cpl_prev,

                CASE WHEN cur.spend > 0 THEN cur.revenue::numeric / NULLIF(cur.spend, 0) END AS roas_cur,
                CASE WHEN prev.spend > 0 THEN prev.revenue::numeric / NULLIF(prev.spend, 0) END AS roas_prev
            FROM cur, prev
        """)

        params = {
            "date_from": date_from,
            "date_to": date_to,
            "prev_from": prev_from_calc,
            "prev_to": prev_to_calc,
        }
        if platforms_list:
            params["platforms"] = platforms_list

        result = await session.execute(query, params)
        row = result.fetchone()

        if not row:
            return KPICompareResponse(
                leads_cur=0, leads_prev=0, leads_diff=0, leads_diff_pct=None,
                n_contracts_cur=0, n_contracts_prev=0,
                revenue_cur=0.0, revenue_prev=0.0, revenue_diff=0.0, revenue_diff_pct=None,
                spend_cur=0.0, spend_prev=0.0, spend_diff=0.0, spend_diff_pct=None,
                cpl_cur=None, cpl_prev=None,
                roas_cur=None, roas_prev=None
            )

        return KPICompareResponse(
            leads_cur=int(row[0] or 0),
            leads_prev=int(row[1] or 0),
            leads_diff=int(row[2] or 0),
            leads_diff_pct=float(row[3]) if row[3] is not None else None,

            n_contracts_cur=int(row[4] or 0),
            n_contracts_prev=int(row[5] or 0),

            revenue_cur=float(row[6] or 0.0),
            revenue_prev=float(row[7] or 0.0),
            revenue_diff=float(row[8] or 0.0),
            revenue_diff_pct=float(row[9]) if row[9] is not None else None,

            spend_cur=float(row[10] or 0.0),
            spend_prev=float(row[11] or 0.0),
            spend_diff=float(row[12] or 0.0),
            spend_diff_pct=float(row[13]) if row[13] is not None else None,

            cpl_cur=float(row[14]) if row[14] is not None else None,
            cpl_prev=float(row[15]) if row[15] is not None else None,

            roas_cur=float(row[16]) if row[16] is not None else None,
            roas_prev=float(row[17]) if row[17] is not None else None,
        )

    except Exception as e:
        logger.error(f"Error fetching KPI compare: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch KPI compare: {str(e)}")
