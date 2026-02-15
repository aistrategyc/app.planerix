"""normalize_okr_status_case

Revision ID: 2026_02_06_1710
Revises: 2026_02_06_1500
Create Date: 2026-02-06 17:10:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2026_02_06_1710"
down_revision = "2026_02_06_1500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE objectives
        SET status = lower(status)
        WHERE status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE objectives
        SET status = upper(status)
        WHERE status IN ('draft', 'active', 'completed', 'archived');
        """
    )
