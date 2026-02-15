"""widget_registry_defaults

Revision ID: 2026_01_26_0900
Revises: 2026_01_25_1200
Create Date: 2026-01-26 09:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_26_0900"
down_revision = "2026_01_25_1200"
branch_labels = None
depends_on = None


WIDGET_KEYS_WITH_CITY = (
    "ads.ads_daily",
    "ads.ads_ad_profile_daily",
    "ads.ads_campaigns_daily",
    "ads.ads_anomalies_7d",
    "ads.kpi_total",
    "ads.creative_type_summary",
    "ads.meta_creatives_daily",
    "ads.meta_ads_top_daily",
    "ads.meta_creative_fatigue_7d",
    "ads.gads_keywords_daily",
    "ads.gads_device_hour_daily",
    "ads.gads_conversion_actions_daily",
    "ads.gads_pmax_daily",
    "ads.gads.trend",
    "ads.channel_mix_daily",
    "campaigns.table",
    "campaigns.top_metrics",
    "sources.revenue_split",
    "contracts.daily_city",
    "contracts.attribution_daily_city",
    "contracts.attributed",
    "contracts.top_campaigns",
    "contracts.meta_by_ad_daily",
    "contracts.gads_by_campaign_daily",
    "crm.kpi_cards",
    "crm.leads_table",
    "crm.funnel",
    "crm.lead_profile",
    "crm.sources_performance_daily",
    "crm.form_unit_economics_daily",
    "creatives.type_cards",
    "creatives.table",
)


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO ai.widget_registry (
            widget_key,
            page_key,
            title,
            sem_view,
            grain,
            entity_type,
            default_filters,
            is_active
        ) VALUES
            ('ads.kpi_total', 'ads', 'Ads KPI Total (Daily)', 'sem.ads_kpi_total', 'day', NULL, '{}'::jsonb, true),
            ('ads.creative_type_summary', 'ads', 'Creative Type Summary (7d)', 'sem.creative_type_summary', 'summary', 'creative', '{}'::jsonb, true)
        ON CONFLICT (widget_key) DO UPDATE SET
            page_key = EXCLUDED.page_key,
            title = EXCLUDED.title,
            sem_view = EXCLUDED.sem_view,
            grain = EXCLUDED.grain,
            entity_type = EXCLUDED.entity_type,
            default_filters = EXCLUDED.default_filters,
            is_active = EXCLUDED.is_active;
        """
    )

    op.execute(
        f"""
        UPDATE ai.widget_registry
        SET default_filters = COALESCE(default_filters, '{{}}'::jsonb) || '{{"id_city": 4}}'::jsonb
        WHERE widget_key IN ({", ".join([f"'{key}'" for key in WIDGET_KEYS_WITH_CITY])});
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        UPDATE ai.widget_registry
        SET default_filters = COALESCE(default_filters, '{{}}'::jsonb) - 'id_city'
        WHERE widget_key IN ({", ".join([f"'{key}'" for key in WIDGET_KEYS_WITH_CITY])});
        """
    )

    op.execute(
        """
        DELETE FROM ai.widget_registry
        WHERE widget_key IN ('ads.kpi_total', 'ads.creative_type_summary');
        """
    )
