"""widget_registry_attribution

Revision ID: 2026_01_27_1200
Revises: 2026_01_26_0900
Create Date: 2026-01-27 12:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_27_1200"
down_revision = "2026_01_26_0900"
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
            ('attr.overview.kpi_total', 'attribution', 'Attribution KPI Total', 'sem.ads_kpi_total', 'day', NULL, '{}'::jsonb, true),
            ('attr.overview.ts_core', 'attribution', 'Attribution Core Timeseries', 'sem.ads_trend_daily', 'day', NULL, '{}'::jsonb, true),
            ('attr.overview.channel_mix', 'attribution', 'Attribution Channel Mix', 'sem.channel_mix_daily_city', 'day', NULL, '{}'::jsonb, true)
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
            'attr.overview.kpi_total',
            'attr.overview.ts_core',
            'attr.overview.channel_mix'
        );
        """
    )
