"""widget_registry_metadata

Revision ID: 2026_01_27_1230
Revises: 2026_01_27_1200
Create Date: 2026-01-27 12:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2026_01_27_1230"
down_revision = "2026_01_27_1200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("widget_registry", sa.Column("supports_filters", postgresql.JSONB(), nullable=True), schema="ai")
    op.add_column("widget_registry", sa.Column("default_sort", sa.Text(), nullable=True), schema="ai")
    op.add_column("widget_registry", sa.Column("default_limit", sa.Integer(), nullable=True), schema="ai")
    op.add_column("widget_registry", sa.Column("date_column", sa.Text(), nullable=True), schema="ai")
    op.add_column("widget_registry", sa.Column("city_column", sa.Text(), nullable=True), schema="ai")


def downgrade() -> None:
    op.drop_column("widget_registry", "city_column", schema="ai")
    op.drop_column("widget_registry", "date_column", schema="ai")
    op.drop_column("widget_registry", "default_limit", schema="ai")
    op.drop_column("widget_registry", "default_sort", schema="ai")
    op.drop_column("widget_registry", "supports_filters", schema="ai")
