"""ai_action_requests

Revision ID: 2026_01_14_0900
Revises: 2026_01_12_1100
Create Date: 2026-01-14 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2026_01_14_0900"
down_revision = "2026_01_12_1100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "action_requests",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("insight_id", sa.BigInteger(), nullable=True),
        sa.Column("recommendation_id", sa.BigInteger(), nullable=True),
        sa.Column("responsible_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("action_type", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.Text(), nullable=True),
        sa.Column("widget_key", sa.Text(), nullable=True),
        sa.Column("severity", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.Text(), nullable=True),
        sa.Column("entity_id", sa.Text(), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kpi_indicator_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("objective_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("key_result_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("expected_impact", postgresql.JSONB(), nullable=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["insight_id"], ["ai.insights.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["recommendation_id"], ["ai.recommendations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["responsible_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["kpi_indicator_id"], ["kpi_indicators.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["objective_id"], ["objectives.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["key_result_id"], ["key_results.id"], ondelete="SET NULL"),
        schema="ai",
    )

    op.create_index(
        "ix_ai_action_requests_org_status_created",
        "action_requests",
        ["organization_id", "status", "created_at"],
        schema="ai",
    )
    op.create_index(
        "ix_ai_action_requests_responsible_status",
        "action_requests",
        ["responsible_user_id", "status"],
        schema="ai",
    )
    op.create_index(
        "ix_ai_action_requests_insight",
        "action_requests",
        ["insight_id"],
        schema="ai",
    )


def downgrade() -> None:
    op.drop_index("ix_ai_action_requests_insight", table_name="action_requests", schema="ai")
    op.drop_index("ix_ai_action_requests_responsible_status", table_name="action_requests", schema="ai")
    op.drop_index("ix_ai_action_requests_org_status_created", table_name="action_requests", schema="ai")
    op.drop_table("action_requests", schema="ai")
