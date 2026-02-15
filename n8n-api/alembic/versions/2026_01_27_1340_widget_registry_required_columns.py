"""widget_registry_required_columns

Revision ID: 2026_01_27_1340
Revises: 2026_01_27_1330
Create Date: 2026-01-27 13:40:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2026_01_27_1340"
down_revision = "2026_01_27_1330"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("widget_registry", sa.Column("required_columns", postgresql.JSONB(), nullable=True), schema="ai")


def downgrade() -> None:
    op.drop_column("widget_registry", "required_columns", schema="ai")
