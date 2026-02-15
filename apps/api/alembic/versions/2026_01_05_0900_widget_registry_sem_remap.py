"""widget_registry_sem_remap

Revision ID: 2026_01_05_0900
Revises: 2025_12_27_1000
Create Date: 2026-01-05 09:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_05_0900"
down_revision = "2025_12_27_1000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.kpi_daily_city',
            grain = 'day',
            entity_type = NULL,
            title = 'CRM KPI (Daily City)'
        WHERE widget_key = 'crm.kpi_cards';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.crm_leads',
            grain = 'lead',
            entity_type = 'lead',
            title = 'CRM Leads'
        WHERE widget_key = 'crm.leads_table';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.crm_leads',
            grain = 'lead',
            entity_type = 'lead',
            title = 'CRM Lead Profile'
        WHERE widget_key = 'crm.lead_profile';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.contracts_daily_city',
            grain = 'day',
            entity_type = NULL,
            title = 'Contracts by City'
        WHERE widget_key = 'crm.funnel';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.gads_spend_daily',
            grain = 'day',
            entity_type = 'campaign',
            title = 'Google Ads Campaigns (Daily)'
        WHERE widget_key = 'ads.platform.campaigns_table';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.gads_spend_daily',
            grain = 'day',
            entity_type = NULL,
            title = 'Google Ads Spend (Daily)'
        WHERE widget_key = 'ads.gads.trend';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.gads_clicks_enriched',
            grain = 'day',
            entity_type = 'campaign',
            title = 'Google Ads Clicks (Enriched)'
        WHERE widget_key = 'ads.gads.top_keywords';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.crm_leads_kpis',
            grain = NULL,
            entity_type = NULL,
            title = 'CRM KPI Cards'
        WHERE widget_key = 'crm.kpi_cards';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.crm_leads_list',
            grain = 'lead',
            entity_type = 'lead',
            title = 'Leads Table'
        WHERE widget_key = 'crm.leads_table';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.crm_lead_profile',
            grain = 'lead',
            entity_type = 'lead',
            title = 'Lead Profile'
        WHERE widget_key = 'crm.lead_profile';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.crm_funnel',
            grain = 'stage',
            entity_type = NULL,
            title = 'CRM Funnel'
        WHERE widget_key = 'crm.funnel';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.platform_campaigns_by_product',
            grain = 'campaign',
            entity_type = 'campaign',
            title = 'Campaigns by Product'
        WHERE widget_key = 'ads.platform.campaigns_table';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.gads_trend_daily',
            grain = 'day',
            entity_type = NULL,
            title = 'Google Ads Trend'
        WHERE widget_key = 'ads.gads.trend';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.gads_top_keywords',
            grain = 'keyword',
            entity_type = 'keyword',
            title = 'Top Keywords'
        WHERE widget_key = 'ads.gads.top_keywords';
        """
    )
