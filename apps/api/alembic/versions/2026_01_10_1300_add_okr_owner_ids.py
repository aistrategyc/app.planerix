"""add_okr_owner_ids

Revision ID: 2026_01_10_1300
Revises: 2026_01_10_1200
Create Date: 2026-01-10 13:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2026_01_10_1300"
down_revision = "2026_01_10_1200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("objectives", sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_objectives_owner_id",
        "objectives",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_objectives_owner_id", "objectives", ["owner_id"])

    op.add_column("key_results", sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_key_results_owner_id",
        "key_results",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_key_results_owner_id", "key_results", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_key_results_owner_id", table_name="key_results")
    op.drop_constraint("fk_key_results_owner_id", "key_results", type_="foreignkey")
    op.drop_column("key_results", "owner_id")

    op.drop_index("ix_objectives_owner_id", table_name="objectives")
    op.drop_constraint("fk_objectives_owner_id", "objectives", type_="foreignkey")
    op.drop_column("objectives", "owner_id")
