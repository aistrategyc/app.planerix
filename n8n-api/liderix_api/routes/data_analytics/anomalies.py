"""
Campaign Anomalies endpoint
Detects unusual patterns in campaign performance
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date, timedelta

from liderix_api.db import get_itstep_session
from liderix_api.services.dependencies import get_current_user
from liderix_api.models.users import User

router = APIRouter()


@router.get("/anomalies")
async def get_campaign_anomalies(
    date_from: date = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: date = Query(..., description="End date (YYYY-MM-DD)"),
    platform: Optional[str] = Query(None, description="Platform filter (google/meta)"),
    anomaly_type: Optional[str] = Query(None, description="Type: spike_cpl, drop_leads, spike_spend"),
    severity: Optional[str] = Query(None, description="Severity: high, medium, low"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_itstep_session),
):
    """
    Get campaign anomalies based on statistical analysis.
    Detects spikes in CPL, drops in leads, and unusual spend patterns.

    Data source: dashboards.v5_leads_campaign_daily (calculated on-the-fly)
    """

    # Calculate baseline (previous period)
    date_diff = (date_to - date_from).days
    baseline_from = date_from - timedelta(days=date_diff)
    baseline_to = date_from - timedelta(days=1)

    # Simplified query without optional platform filter
    query = text("""
        WITH current_period AS (
            SELECT
                platform,
                campaign_id,
                campaign_name,
                SUM(leads) as leads,
                SUM(spend) as spend,
                CASE WHEN SUM(leads) > 0 THEN SUM(spend) / SUM(leads) ELSE NULL END as cpl
            FROM dashboards.v5_leads_campaign_daily
            WHERE dt >= :date_from AND dt <= :date_to
            GROUP BY platform, campaign_id, campaign_name
            HAVING SUM(leads) > 0
        ),
        baseline_period AS (
            SELECT
                platform,
                campaign_id,
                AVG(daily_cpl) as avg_cpl,
                AVG(daily_leads) as avg_leads,
                STDDEV(daily_cpl) as stddev_cpl,
                STDDEV(daily_leads) as stddev_leads
            FROM (
                SELECT
                    platform,
                    campaign_id,
                    dt,
                    leads as daily_leads,
                    CASE WHEN leads > 0 THEN spend / leads ELSE NULL END as daily_cpl
                FROM dashboards.v5_leads_campaign_daily
                WHERE dt >= :baseline_from AND dt <= :baseline_to
            ) daily
            WHERE daily_cpl IS NOT NULL
            GROUP BY platform, campaign_id
        )
        SELECT
            c.platform,
            c.campaign_id,
            c.campaign_name,
            c.leads,
            c.spend,
            c.cpl as current_cpl,
            b.avg_cpl as baseline_cpl,
            b.avg_leads as baseline_leads,
            CASE
                WHEN b.avg_cpl > 0 AND c.cpl > b.avg_cpl * 1.5 THEN 'spike_cpl'
                WHEN b.avg_leads > 0 AND c.leads < b.avg_leads * 0.5 THEN 'drop_leads'
                WHEN b.avg_cpl > 0 AND c.spend > b.avg_leads * b.avg_cpl * 2 THEN 'spike_spend'
                ELSE 'normal'
            END as anomaly_type,
            CASE
                WHEN b.avg_cpl > 0 AND c.cpl > b.avg_cpl * 2 THEN 'high'
                WHEN b.avg_cpl > 0 AND c.cpl > b.avg_cpl * 1.5 THEN 'medium'
                WHEN b.avg_leads > 0 AND c.leads < b.avg_leads * 0.3 THEN 'high'
                WHEN b.avg_leads > 0 AND c.leads < b.avg_leads * 0.5 THEN 'medium'
                ELSE 'low'
            END as severity
        FROM current_period c
        LEFT JOIN baseline_period b ON c.platform = b.platform AND c.campaign_id = b.campaign_id
        WHERE b.avg_cpl IS NOT NULL
          AND (
              (b.avg_cpl > 0 AND c.cpl > b.avg_cpl * 1.5) OR
              (b.avg_leads > 0 AND c.leads < b.avg_leads * 0.5) OR
              (b.avg_cpl > 0 AND c.spend > b.avg_leads * b.avg_cpl * 2)
          )
        ORDER BY
            CASE
                WHEN b.avg_cpl > 0 THEN ABS(c.cpl - b.avg_cpl) / b.avg_cpl
                ELSE 0
            END DESC
        LIMIT 20
    """)

    params = {
        "date_from": date_from,
        "date_to": date_to,
        "baseline_from": baseline_from,
        "baseline_to": baseline_to,
    }

    result = await session.execute(query, params)
    rows = result.mappings().all()

    # Filter by anomaly_type and severity if provided
    filtered_rows = rows
    if anomaly_type:
        filtered_rows = [r for r in filtered_rows if r["anomaly_type"] == anomaly_type]
    if severity:
        filtered_rows = [r for r in filtered_rows if r["severity"] == severity]

    return {
        "data": [
            {
                "platform": row["platform"],
                "campaign_id": row["campaign_id"],
                "campaign_name": row["campaign_name"],
                "leads": row["leads"],
                "spend": float(row["spend"]) if row["spend"] else 0.0,
                "current_cpl": float(row["current_cpl"]) if row["current_cpl"] else None,
                "baseline_cpl": float(row["baseline_cpl"]) if row["baseline_cpl"] else None,
                "baseline_leads": float(row["baseline_leads"]) if row["baseline_leads"] else None,
                "anomaly_type": row["anomaly_type"],
                "severity": row["severity"],
            }
            for row in filtered_rows
        ]
    }
