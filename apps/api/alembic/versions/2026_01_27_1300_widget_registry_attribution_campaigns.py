"""widget_registry_attribution_campaigns

Revision ID: 2026_01_27_1300
Revises: 2026_01_27_1230
Create Date: 2026-01-27 13:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_27_1300"
down_revision = "2026_01_27_1230"
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
            ('attr.ads.campaigns.kpi', 'attribution', 'Attribution Campaigns KPI', 'sem.ui_active_campaigns_kpi_period_city', 'period', 'campaign', '{}'::jsonb, true),
            ('attr.ads.campaigns.table', 'attribution', 'Attribution Campaigns Table', 'sem.ui_active_campaigns_period_city', 'period', 'campaign', '{}'::jsonb, true),
            ('attr.ads.campaigns.drawer_creatives', 'attribution', 'Attribution Campaign Creatives', 'sem.ui_campaign_creatives_period_city', 'period', 'campaign', '{}'::jsonb, true),
            ('attr.ads.campaigns.ts', 'attribution', 'Attribution Campaign Timeseries', 'sem.ui_campaign_timeseries_daily', 'day', 'campaign', '{}'::jsonb, true)
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
            'attr.ads.campaigns.kpi',
            'attr.ads.campaigns.table',
            'attr.ads.campaigns.drawer_creatives',
            'attr.ads.campaigns.ts'
        );
        """
    )
