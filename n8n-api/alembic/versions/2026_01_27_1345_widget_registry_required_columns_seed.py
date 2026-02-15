"""widget_registry_required_columns_seed

Revision ID: 2026_01_27_1345
Revises: 2026_01_27_1340
Create Date: 2026-01-27 13:45:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_27_1345"
down_revision = "2026_01_27_1340"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET required_columns = '["date_key","id_city","platform","channel","spend","clicks","impressions","platform_leads","crm_requests_cnt"]'::jsonb
        WHERE widget_key IN (
            'attr.overview.kpi_total',
            'attr.overview.ts_core',
            'attr.overview.channel_mix'
        );

        UPDATE ai.widget_registry
        SET required_columns = '["date_key","id_city","platform","channel","campaign_id","campaign_name","campaign_status","objective","spend","clicks","impressions","platform_leads","crm_requests_cnt","contracts_cnt","paid_sum"]'::jsonb,
            supports_filters = '{"city": true, "platform": true, "channel": true, "conversion_type": true, "status": true, "objective": true, "compare": true}'::jsonb
        WHERE widget_key IN (
            'attr.ads.campaigns.kpi',
            'attr.ads.campaigns.table'
        );

        UPDATE ai.widget_registry
        SET required_columns = '["date_key","id_city","platform","channel","campaign_id","ad_id","ad_display_name","preview_image_url","permalink_url","post_message","spend","clicks","impressions","platform_leads","crm_requests_cnt","contracts_cnt","paid_sum"]'::jsonb,
            supports_filters = '{"city": true, "platform": true, "channel": true, "conversion_type": true, "status": true, "objective": true, "compare": true}'::jsonb
        WHERE widget_key = 'attr.ads.campaigns.drawer_creatives';

        UPDATE ai.widget_registry
        SET required_columns = '["date_key","id_city","platform","channel","campaign_id","spend","paid_sum"]'::jsonb,
            supports_filters = '{"city": true, "platform": true, "channel": true, "conversion_type": true, "status": true, "objective": true, "compare": true}'::jsonb
        WHERE widget_key = 'attr.ads.campaigns.ts';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET required_columns = NULL
        WHERE widget_key LIKE 'attr.%';
        """
    )
