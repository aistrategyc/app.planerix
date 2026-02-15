"""widget_registry_remove_city_defaults_for_null_city_ads

Revision ID: 2026_02_11_1200
Revises: 2026_02_06_1900
Create Date: 2026-02-11 12:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_02_11_1200"
down_revision = "2026_02_06_1900"
branch_labels = None
depends_on = None


WIDGET_KEYS = (
    "ads.ads_daily",
    "ads.ads_ad_profile_daily",
    "ads.ads_anomalies_7d",
    "ads.creative_type_summary",
    "ads.meta_ads_top_daily",
    "ads.meta_creative_fatigue_7d",
    "ads.meta_creatives_daily",
)


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE ai.widget_registry
        SET default_filters = COALESCE(default_filters, '{{}}'::jsonb) - 'id_city' - 'city_id'
        WHERE widget_key IN ({", ".join([f"'{key}'" for key in WIDGET_KEYS])});
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        UPDATE ai.widget_registry
        SET default_filters = COALESCE(default_filters, '{{}}'::jsonb) || '{{"id_city": 4}}'::jsonb
        WHERE widget_key IN ({", ".join([f"'{key}'" for key in WIDGET_KEYS])});
        """
    )
