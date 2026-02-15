"""widget_registry_ga4_gads_sources

Revision ID: 2026_01_17_1200
Revises: 2026_01_16_0900
Create Date: 2026-01-17 12:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_17_1200"
down_revision = "2026_01_16_0900"
branch_labels = None
depends_on = None


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
            ('ga4.traffic_overview_daily', 'analytics', 'GA4 Traffic Overview (Daily)', 'sem.ga4_traffic_overview_daily', 'day', NULL, '{}'::jsonb, true),
            ('ga4.events_conversions_daily', 'analytics', 'GA4 Events & Conversions (Daily)', 'sem.ga4_events_conversions_daily', 'day', NULL, '{}'::jsonb, true),
            ('ga4.ads_creative_performance_daily', 'analytics', 'GA4 Ads Creative Performance (Daily)', 'sem.ga4_ads_creative_performance_daily', 'day', NULL, '{}'::jsonb, true),
            ('ga4.utm_daily', 'analytics', 'GA4 UTM Performance (Daily)', 'sem.ga4_utm_daily', 'day', NULL, '{}'::jsonb, true),
            ('ads.gads_keywords_daily', 'ads', 'GAds Keywords (Daily)', 'sem.gads_keywords_daily', 'day', 'keyword', '{}'::jsonb, true),
            ('ads.gads_device_hour_daily', 'ads', 'GAds Device Hourly (Daily)', 'sem.gads_device_hour_daily', 'hour', NULL, '{}'::jsonb, true),
            ('ads.gads_conversion_actions_daily', 'ads', 'GAds Conversion Actions (Daily)', 'sem.gads_conversion_actions_daily', 'day', NULL, '{}'::jsonb, true),
            ('crm.sources_performance_daily', 'marketing', 'CRM Sources Performance (Daily)', 'sem.crm_sources_performance_daily', 'day', 'source', '{}'::jsonb, true)
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


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM ai.widget_registry
        WHERE widget_key IN (
            'ga4.traffic_overview_daily',
            'ga4.events_conversions_daily',
            'ga4.ads_creative_performance_daily',
            'ga4.utm_daily',
            'ads.gads_keywords_daily',
            'ads.gads_device_hour_daily',
            'ads.gads_conversion_actions_daily',
            'crm.sources_performance_daily'
        );
        """
    )
