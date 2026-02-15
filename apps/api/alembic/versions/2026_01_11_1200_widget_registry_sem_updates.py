"""widget_registry_sem_updates

Revision ID: 2026_01_11_1200
Revises: 2026_01_11_0900
Create Date: 2026-01-11 12:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_11_1200"
down_revision = "2026_01_11_0900"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.meta_creatives_daily',
            grain = 'day',
            entity_type = 'creative',
            title = 'Meta Creatives (Daily)'
        WHERE widget_key = 'ads.meta_creatives_daily';

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
            ('ads.meta_ads_top_daily', 'ads', 'Meta Top Ads (Daily)', 'sem.meta_ads_top_daily', 'day', 'ad', '{}'::jsonb, true),
            ('ads.meta_creative_fatigue_7d', 'ads', 'Meta Creative Fatigue (7d)', 'sem.meta_creative_fatigue_7d', 'day', 'creative', '{}'::jsonb, true),
            ('ads.meta_data_quality_daily', 'ads', 'Meta Data Quality (Daily)', 'sem.meta_data_quality_daily', 'day', NULL, '{}'::jsonb, true),
            ('ads.meta_funnel_daily', 'ads', 'Meta Funnel (Daily)', 'sem.meta_funnel_daily', 'day', NULL, '{}'::jsonb, true),
            ('ads.meta_leads_daily', 'ads', 'Meta Leads (Daily)', 'sem.meta_leads_daily', 'day', 'lead', '{}'::jsonb, true),
            ('ads.meta_leads_match_quality_daily', 'ads', 'Meta Lead Match Quality (Daily)', 'sem.meta_leads_match_quality_daily', 'day', 'lead', '{}'::jsonb, true),
            ('ads.meta_cpl_by_form_daily', 'ads', 'Meta CPL by Form (Daily)', 'sem.meta_cpl_by_form_daily', 'day', 'form', '{}'::jsonb, true),
            ('ads.gads_pmax_daily', 'ads', 'Google Ads PMax (Daily)', 'sem.gads_asset_group_daily', 'day', 'asset_group', '{}'::jsonb, true),
            ('crm.payments_daily', 'crm', 'CRM Payments (Daily)', 'sem.crm_payments_daily', 'day', 'payment', '{}'::jsonb, true),
            ('crm.contracts_daily', 'crm', 'CRM Contracts (Daily)', 'sem.crm_contracts_daily', 'day', 'contract', '{}'::jsonb, true),
            ('crm.form_unit_economics_daily', 'crm', 'CRM Form Unit Economics (Daily)', 'sem.crm_form_unit_economics_daily', 'day', 'form', '{}'::jsonb, true)
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
        SET sem_view = 'sem.meta_creative_performance_daily',
            grain = 'day',
            entity_type = 'creative',
            title = 'Meta Creatives (Daily)'
        WHERE widget_key = 'ads.meta_creatives_daily';

        DELETE FROM ai.widget_registry
        WHERE widget_key IN (
            'ads.meta_ads_top_daily',
            'ads.meta_creative_fatigue_7d',
            'ads.meta_data_quality_daily',
            'ads.meta_funnel_daily',
            'ads.meta_leads_daily',
            'ads.meta_leads_match_quality_daily',
            'ads.meta_cpl_by_form_daily',
            'ads.gads_pmax_daily',
            'crm.payments_daily',
            'crm.contracts_daily',
            'crm.form_unit_economics_daily'
        );
        """
    )
