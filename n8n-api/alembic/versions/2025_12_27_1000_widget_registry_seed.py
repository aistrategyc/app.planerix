"""seed_widget_registry

Revision ID: 2025_12_27_1000
Revises: 2025_12_26_1500
Create Date: 2025-12-27 10:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2025_12_27_1000"
down_revision = "2025_12_26_1500"
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
            ('crm.kpi_cards', 'crm', 'CRM KPI Cards', 'sem.crm_leads_kpis', NULL, NULL, '{}'::jsonb, true),
            ('crm.leads_table', 'crm', 'Leads Table', 'sem.crm_leads_list', 'lead', 'lead', '{}'::jsonb, true),
            ('crm.lead_profile', 'crm', 'Lead Profile', 'sem.crm_lead_profile', 'lead', 'lead', '{}'::jsonb, true),
            ('crm.funnel', 'crm', 'CRM Funnel', 'sem.crm_funnel', 'stage', NULL, '{}'::jsonb, true),
            ('ads.platform.campaigns_table', 'ads_platform', 'Campaigns by Product', 'sem.platform_campaigns_by_product', 'campaign', 'campaign', '{}'::jsonb, true),
            ('ads.gads.trend', 'ads_platform', 'Google Ads Trend', 'sem.gads_trend_daily', 'day', NULL, '{}'::jsonb, true),
            ('ads.gads.top_keywords', 'ads_platform', 'Top Keywords', 'sem.gads_top_keywords', 'keyword', 'keyword', '{}'::jsonb, true),
            ('campaigns.table', 'campaigns_sources', 'Campaign Performance', 'sem.campaign_performance', 'campaign', 'campaign', '{}'::jsonb, true),
            ('sources.revenue_split', 'campaigns_sources', 'Revenue by Source', 'sem.revenue_by_source', 'source', NULL, '{}'::jsonb, true),
            ('campaigns.top_metrics', 'campaigns_sources', 'Top Metrics', 'sem.top_metrics', 'summary', NULL, '{}'::jsonb, true),
            ('creatives.type_cards', 'creatives', 'Creative Type Cards', 'sem.creative_type_summary', 'type', 'creative', '{}'::jsonb, true),
            ('creatives.table', 'creatives', 'Creative Performance', 'sem.creative_performance', 'creative', 'creative', '{}'::jsonb, true)
        ON CONFLICT (widget_key) DO UPDATE SET
            page_key = EXCLUDED.page_key,
            title = EXCLUDED.title,
            sem_view = EXCLUDED.sem_view,
            grain = EXCLUDED.grain,
            entity_type = EXCLUDED.entity_type,
            default_filters = EXCLUDED.default_filters,
            is_active = EXCLUDED.is_active
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM ai.widget_registry
        WHERE widget_key IN (
            'crm.kpi_cards',
            'crm.leads_table',
            'crm.lead_profile',
            'crm.funnel',
            'ads.platform.campaigns_table',
            'ads.gads.trend',
            'ads.gads.top_keywords',
            'campaigns.table',
            'sources.revenue_split',
            'campaigns.top_metrics',
            'creatives.type_cards',
            'creatives.table'
        )
        """
    )
