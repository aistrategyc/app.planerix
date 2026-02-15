"""okr_progress_snapshots

Revision ID: 2026_02_06_1900
Revises: 2026_02_06_1710
Create Date: 2026-02-06 19:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2026_02_06_1900"
down_revision = "2026_02_06_1710"
branch_labels = None
depends_on = None


def upgrade() -> None:
    direction_enum = sa.Enum(
        "increase",
        "decrease",
        name="keyresultdirection",
        native_enum=False,
    )
    rule_enum = sa.Enum(
        "linear",
        "ratio",
        "capped",
        name="keyresultprogressrule",
        native_enum=False,
    )

    op.create_table(
        "okr_progress_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("objective_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key_result_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metric_def_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metric_key", sa.String(length=120), nullable=True),
        sa.Column("start_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("current_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("target_value", sa.Float(), nullable=False),
        sa.Column("progress_percentage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("direction", direction_enum, nullable=False, server_default="increase"),
        sa.Column("progress_rule", rule_enum, nullable=False, server_default="linear"),
        sa.Column("snapshot_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("filters_json", postgresql.JSONB(), nullable=True),
        sa.Column("data_quality_requirements", postgresql.JSONB(), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="auto"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["objective_id"], ["objectives.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["key_result_id"], ["key_results.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["metric_def_id"], ["metric_definitions.id"], ondelete="SET NULL"),
    )

    op.create_index("ix_okr_snapshot_org", "okr_progress_snapshots", ["org_id"])
    op.create_index("ix_okr_snapshot_objective", "okr_progress_snapshots", ["objective_id"])
    op.create_index("ix_okr_snapshot_key_result", "okr_progress_snapshots", ["key_result_id"])
    op.create_index("ix_okr_snapshot_metric", "okr_progress_snapshots", ["metric_def_id"])
    op.create_index("ix_okr_snapshot_at", "okr_progress_snapshots", ["snapshot_at"])


def downgrade() -> None:
    op.drop_index("ix_okr_snapshot_at", table_name="okr_progress_snapshots")
    op.drop_index("ix_okr_snapshot_metric", table_name="okr_progress_snapshots")
    op.drop_index("ix_okr_snapshot_key_result", table_name="okr_progress_snapshots")
    op.drop_index("ix_okr_snapshot_objective", table_name="okr_progress_snapshots")
    op.drop_index("ix_okr_snapshot_org", table_name="okr_progress_snapshots")
    op.drop_table("okr_progress_snapshots")
