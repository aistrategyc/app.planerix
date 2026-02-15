"""add_ads_widgets

Revision ID: 2026_01_10_1200
Revises: 2026_01_05_0900
Create Date: 2026-01-10 12:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_10_1200"
down_revision = "2026_01_05_0900"
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
            ('ads.ads_daily', 'ads', 'Ads Daily', 'sem.ads_ads_daily', 'day', 'ad', '{}'::jsonb, true),
            ('ads.ads_anomalies_7d', 'ads', 'Ads Anomalies 7d', 'sem.ads_ads_anomalies_7d', 'day', 'ad', '{}'::jsonb, true),
            ('ads.ads_ad_profile_daily', 'ads', 'Ads Creatives', 'sem.ads_ad_profile_daily', 'day', 'ad', '{}'::jsonb, true)
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
            'ads.ads_daily',
            'ads.ads_anomalies_7d',
            'ads.ads_ad_profile_daily'
        )
        """
    )
