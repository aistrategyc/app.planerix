"""semantic_key_org_scope

Revision ID: 2025_12_26_1700
Revises: 2025_12_26_1500
Create Date: 2025-12-26 17:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2025_12_26_1700"
down_revision = "2025_12_26_1500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # kpi_indicators: scoped uniqueness per org
    op.drop_index("ux_kpi_indicators_semantic_key", table_name="kpi_indicators")
    op.create_index(
        "ux_kpi_indicators_org_semantic_key",
        "kpi_indicators",
        ["org_id", "semantic_key"],
        unique=True,
        postgresql_where=sa.text("semantic_key IS NOT NULL"),
    )

    # key_results: add org_id and scoped uniqueness per org
    op.add_column("key_results", sa.Column("org_id", postgresql.UUID(), nullable=True))
    op.execute(
        """
        UPDATE key_results kr
        SET org_id = o.org_id
        FROM objectives o
        WHERE kr.objective_id = o.id AND kr.org_id IS NULL;
        """
    )

    op.drop_index("ux_key_results_semantic_key", table_name="key_results")
    op.create_index(
        "ux_key_results_org_semantic_key",
        "key_results",
        ["org_id", "semantic_key"],
        unique=True,
        postgresql_where=sa.text("semantic_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_key_results_org_semantic_key", table_name="key_results")
    op.create_index(
        "ux_key_results_semantic_key",
        "key_results",
        ["semantic_key"],
        unique=True,
        postgresql_where=sa.text("semantic_key IS NOT NULL"),
    )
    op.drop_column("key_results", "org_id")

    op.drop_index("ux_kpi_indicators_org_semantic_key", table_name="kpi_indicators")
    op.create_index(
        "ux_kpi_indicators_semantic_key",
        "kpi_indicators",
        ["semantic_key"],
        unique=True,
        postgresql_where=sa.text("semantic_key IS NOT NULL"),
    )
