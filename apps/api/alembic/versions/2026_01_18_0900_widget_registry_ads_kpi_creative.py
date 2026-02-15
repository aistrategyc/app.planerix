"""widget_registry_ads_kpi_creative

Revision ID: 2026_01_18_0900
Revises: 2026_01_17_1200
Create Date: 2026-01-18 09:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_18_0900"
down_revision = "2026_01_17_1200"
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

        UPDATE ai.widget_registry
        SET sem_view = 'sem.gads_spend_daily',
            grain = 'day',
            entity_type = 'campaign',
            title = 'Google Ads Spend (Daily)'
        WHERE widget_key = 'ads.gads.trend';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.gads_trend_daily',
            grain = 'day',
            entity_type = NULL,
            title = 'Google Ads Trend'
        WHERE widget_key = 'ads.gads.trend';

        DELETE FROM ai.widget_registry
        WHERE widget_key IN (
            'ads.kpi_total',
            'ads.creative_type_summary'
        );
        """
    )
