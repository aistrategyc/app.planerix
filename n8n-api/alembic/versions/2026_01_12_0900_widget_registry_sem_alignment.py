"""widget_registry_sem_alignment

Revision ID: 2026_01_12_0900
Revises: 2026_01_11_1200
Create Date: 2026-01-12 09:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_12_0900"
down_revision = "2026_01_11_1200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.campaign_performance',
            grain = 'day',
            entity_type = 'campaign',
            title = 'Campaign Performance'
        WHERE widget_key = 'campaigns.table';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.revenue_by_source',
            grain = 'day',
            entity_type = 'source',
            title = 'Revenue by Source'
        WHERE widget_key = 'sources.revenue_split';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.top_metrics',
            grain = 'day',
            entity_type = NULL,
            title = 'Top Metrics'
        WHERE widget_key = 'campaigns.top_metrics';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.creative_type_summary',
            grain = 'summary',
            entity_type = 'creative',
            title = 'Creative Type Summary'
        WHERE widget_key = 'creatives.type_cards';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.creative_performance',
            grain = 'summary',
            entity_type = 'creative',
            title = 'Creative Performance (7d)'
        WHERE widget_key = 'creatives.table';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.crm_funnel_daily',
            grain = 'day',
            entity_type = NULL,
            title = 'CRM Funnel (Daily)'
        WHERE widget_key = 'crm.funnel';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.contracts_by_campaign_daily',
            grain = 'campaign',
            entity_type = 'campaign',
            title = 'Campaign Performance'
        WHERE widget_key = 'campaigns.table';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.revenue_by_source_daily_city',
            grain = 'source',
            entity_type = NULL,
            title = 'Revenue by Source'
        WHERE widget_key = 'sources.revenue_split';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.kpi_daily_city',
            grain = 'day',
            entity_type = NULL,
            title = 'Top Metrics'
        WHERE widget_key = 'campaigns.top_metrics';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.creative_registry',
            grain = 'summary',
            entity_type = 'creative',
            title = 'Creative Type Summary'
        WHERE widget_key = 'creatives.type_cards';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.creative_performance_daily',
            grain = 'day',
            entity_type = 'creative',
            title = 'Creative Performance (7d)'
        WHERE widget_key = 'creatives.table';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.contracts_daily_city',
            grain = 'day',
            entity_type = NULL,
            title = 'CRM Funnel (Daily)'
        WHERE widget_key = 'crm.funnel';
        """
    )
