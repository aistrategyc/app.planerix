"""widget_registry_crm_kpi_cards

Revision ID: 2026_01_12_1100
Revises: 2026_01_12_0900
Create Date: 2026-01-12 11:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_01_12_1100"
down_revision = "2026_01_12_0900"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.commercial_kpi_cards',
            grain = 'day',
            entity_type = NULL,
            title = 'Commercial KPI Cards'
        WHERE widget_key = 'crm.kpi_cards';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE ai.widget_registry
        SET sem_view = 'sem.kpi_daily_city',
            grain = 'day',
            entity_type = NULL,
            title = 'CRM KPI (Daily City)'
        WHERE widget_key = 'crm.kpi_cards';
        """
    )
