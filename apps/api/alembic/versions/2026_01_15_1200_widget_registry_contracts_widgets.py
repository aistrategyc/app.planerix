"""widget_registry_contracts_widgets

Revision ID: 2026_01_15_1200
Revises: 2026_01_14_0900
Create Date: 2026-01-15 12:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_15_1200"
down_revision = "2026_01_14_0900"
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
            ('contracts.daily_city', 'contracts', 'Contracts (Daily)', 'sem.contracts_daily_city', 'day', NULL, '{}'::jsonb, true),
            ('contracts.attribution_daily_city', 'contracts', 'Contract Attribution (Daily)', 'sem.contract_attribution_daily_city_display_current', 'day', NULL, '{}'::jsonb, true),
            ('contracts.attributed', 'contracts', 'Attributed Contracts', 'sem.contracts_attributed', 'day', 'contract', '{}'::jsonb, true),
            ('contracts.top_campaigns', 'contracts', 'Top Campaigns (Daily)', 'sem.contracts_by_campaign_daily', 'day', 'campaign', '{}'::jsonb, true),
            ('contracts.meta_by_ad_daily', 'contracts', 'Meta Contracts by Ad (Daily)', 'sem.meta_contracts_by_ad_daily_city', 'day', 'ad', '{}'::jsonb, true),
            ('contracts.gads_by_campaign_daily', 'contracts', 'GAds Contracts by Campaign (Daily)', 'sem.gads_contracts_by_campaign_daily_city', 'day', 'campaign', '{}'::jsonb, true)
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
            'contracts.daily_city',
            'contracts.attribution_daily_city',
            'contracts.attributed',
            'contracts.top_campaigns',
            'contracts.meta_by_ad_daily',
            'contracts.gads_by_campaign_daily'
        );
        """
    )
