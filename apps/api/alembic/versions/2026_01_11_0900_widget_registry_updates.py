"""widget_registry_updates

Revision ID: 2026_01_11_0900
Revises: 2026_01_10_1300
Create Date: 2026-01-11 09:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_11_0900"
down_revision = "2026_01_10_1300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.gads_top_keywords',
            grain = 'day',
            entity_type = 'keyword',
            title = 'Google Ads Top Keywords'
        WHERE widget_key = 'ads.gads.top_keywords';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.crm_lead_cards',
            grain = 'lead',
            entity_type = 'lead',
            title = 'CRM Lead Cards'
        WHERE widget_key = 'crm.leads_table';

        UPDATE ai.widget_registry
        SET sem_view = 'sem.crm_analytics_events',
            grain = 'event',
            entity_type = 'lead',
            title = 'CRM Lead Events'
        WHERE widget_key = 'crm.lead_profile';

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
            ('ads.channel_mix_daily', 'ads', 'Ads Channel Mix (Daily City)', 'sem.channel_mix_daily_city', 'day', NULL, '{}'::jsonb, true),
            ('ads.meta_creatives_daily', 'ads', 'Meta Creatives (Daily)', 'sem.meta_creative_performance_daily', 'day', 'creative', '{}'::jsonb, true)
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
        UPDATE ai.widget_registry
        SET sem_view = 'sem.gads_clicks_enriched',
            grain = 'day',
            entity_type = 'campaign',
            title = 'Google Ads Clicks (Enriched)'
        WHERE widget_key = 'ads.gads.top_keywords';

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

        DELETE FROM ai.widget_registry
        WHERE widget_key IN (
            'ads.channel_mix_daily',
            'ads.meta_creatives_daily'
        );
        """
    )
