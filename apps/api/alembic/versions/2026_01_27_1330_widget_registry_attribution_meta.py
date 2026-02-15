"""widget_registry_attribution_meta

Revision ID: 2026_01_27_1330
Revises: 2026_01_27_1300
Create Date: 2026-01-27 13:30:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_27_1330"
down_revision = "2026_01_27_1300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET supports_filters = '{"city": true, "platform": true, "channel": true, "conversion_type": true, "compare": true}'::jsonb
        WHERE widget_key IN (
            'attr.overview.kpi_total',
            'attr.overview.ts_core'
        );

        UPDATE ai.widget_registry
        SET supports_filters = '{"city": true, "platform": true, "channel": true, "compare": true}'::jsonb
        WHERE widget_key = 'attr.overview.channel_mix';

        UPDATE ai.widget_registry
        SET supports_filters = '{"city": true, "platform": true, "channel": true, "conversion_type": true, "compare": true}'::jsonb
        WHERE widget_key IN (
            'attr.ads.campaigns.kpi',
            'attr.ads.campaigns.table',
            'attr.ads.campaigns.drawer_creatives',
            'attr.ads.campaigns.ts'
        );

        UPDATE ai.widget_registry
        SET default_sort = '-paid_sum'
        WHERE widget_key = 'attr.ads.campaigns.table';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET supports_filters = NULL,
            default_sort = NULL
        WHERE widget_key LIKE 'attr.%';
        """
    )
