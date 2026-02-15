"""widget_registry_channel_mix_current

Revision ID: 2026_01_16_0900
Revises: 2026_01_15_1200
Create Date: 2026-01-16 09:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_16_0900"
down_revision = "2026_01_15_1200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.contract_attribution_daily_city_channel_city_current',
            grain = 'day',
            entity_type = NULL,
            title = 'Contracts by Channel (Daily City)'
        WHERE widget_key = 'ads.channel_mix_daily';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.channel_mix_daily_city',
            grain = 'day',
            entity_type = NULL,
            title = 'Ads Channel Mix (Daily City)'
        WHERE widget_key = 'ads.channel_mix_daily';
        """
    )
