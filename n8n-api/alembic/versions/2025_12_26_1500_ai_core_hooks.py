"""ai_core_hooks

Revision ID: 2025_12_26_1500
Revises: 2025_12_22_1810
Create Date: 2025-12-26 15:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2025_12_26_1500"
down_revision = "2025_12_22_1810"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- AI schema additions ---
    op.create_table(
        "widget_registry",
        sa.Column("widget_key", sa.Text(), primary_key=True),
        sa.Column("page_key", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("sem_view", sa.Text(), nullable=True),
        sa.Column("grain", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.Text(), nullable=True),
        sa.Column("default_filters", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        schema="ai",
    )

    op.create_table(
        "recommendations",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), primary_key=True),
        sa.Column("insight_id", sa.BigInteger(), nullable=True),
        sa.Column("action_type", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=True),
        sa.Column("expected_impact", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["insight_id"], ["ai.insights.id"], ondelete="SET NULL"),
        schema="ai",
    )

    op.add_column("insights", sa.Column("widget_key", sa.Text(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("entity_type", sa.Text(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("entity_id", sa.Text(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("metrics_json", postgresql.JSONB(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("evidence_ref", postgresql.JSONB(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("confidence", sa.Numeric(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("tags", postgresql.ARRAY(sa.Text()), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("organization_id", postgresql.UUID(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("project_id", postgresql.UUID(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("kpi_indicator_id", postgresql.UUID(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("objective_id", postgresql.UUID(), nullable=True), schema="ai")
    op.add_column("insights", sa.Column("key_result_id", postgresql.UUID(), nullable=True), schema="ai")

    op.add_column("actions", sa.Column("widget_key", sa.Text(), nullable=True), schema="ai")
    op.add_column("actions", sa.Column("entity_type", sa.Text(), nullable=True), schema="ai")
    op.add_column("actions", sa.Column("entity_id", sa.Text(), nullable=True), schema="ai")
    op.add_column("actions", sa.Column("project_id", postgresql.UUID(), nullable=True), schema="ai")
    op.add_column("actions", sa.Column("task_id", postgresql.UUID(), nullable=True), schema="ai")
    op.add_column("actions", sa.Column("expected_impact", postgresql.JSONB(), nullable=True), schema="ai")

    op.add_column("runs", sa.Column("period_start", sa.Date(), nullable=True), schema="ai")
    op.add_column("runs", sa.Column("period_end", sa.Date(), nullable=True), schema="ai")
    op.add_column("runs", sa.Column("input_snapshot_hash", sa.Text(), nullable=True), schema="ai")

    op.create_index(
        "ix_ai_insights_tenant_widget_valid_to",
        "insights",
        ["tenant_key", "widget_key", "valid_to"],
        schema="ai",
    )
    op.create_index(
        "ix_ai_insights_tenant_entity",
        "insights",
        ["tenant_key", "entity_type", "entity_id"],
        schema="ai",
    )
    op.create_index(
        "ix_ai_insights_tenant_severity_valid_to",
        "insights",
        ["tenant_key", "severity", "valid_to"],
        schema="ai",
    )

    # --- Core hooks ---
    op.add_column("tasks", sa.Column("entity_type", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("entity_id", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("source_ref", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("expected_impact", postgresql.JSONB(), nullable=True))

    op.add_column("projects", sa.Column("owner_id", postgresql.UUID(), nullable=True))

    op.add_column("kpi_indicators", sa.Column("semantic_key", sa.Text(), nullable=True))
    op.create_index(
        "ux_kpi_indicators_semantic_key",
        "kpi_indicators",
        ["semantic_key"],
        unique=True,
        postgresql_where=sa.text("semantic_key IS NOT NULL"),
    )

    op.add_column("key_results", sa.Column("semantic_key", sa.Text(), nullable=True))
    op.create_index(
        "ux_key_results_semantic_key",
        "key_results",
        ["semantic_key"],
        unique=True,
        postgresql_where=sa.text("semantic_key IS NOT NULL"),
    )

    # --- Mappings table ---
    op.create_table(
        "mappings",
        sa.Column("id", postgresql.UUID(), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(), nullable=False),
        sa.Column("mapping_type", sa.Text(), nullable=False),
        sa.Column("external_key", sa.Text(), nullable=False),
        sa.Column("internal_entity_type", sa.Text(), nullable=True),
        sa.Column("internal_entity_id", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Numeric(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("meta", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_mappings_org_type", "mappings", ["organization_id", "mapping_type"])
    op.create_index("ix_mappings_external_key", "mappings", ["external_key"])
    op.create_index("ix_mappings_internal_entity", "mappings", ["internal_entity_type", "internal_entity_id"])

    # --- Registry indexes ---
    op.create_index(
        "ix_registry_entity_links_left",
        "entity_links",
        ["tenant_key", "left_type", "left_id"],
        schema="registry",
    )
    op.create_index(
        "ix_registry_entity_links_right",
        "entity_links",
        ["tenant_key", "right_type", "right_id"],
        schema="registry",
    )


def downgrade() -> None:
    op.drop_index("ix_registry_entity_links_right", table_name="entity_links", schema="registry")
    op.drop_index("ix_registry_entity_links_left", table_name="entity_links", schema="registry")

    op.drop_index("ix_mappings_internal_entity", table_name="mappings")
    op.drop_index("ix_mappings_external_key", table_name="mappings")
    op.drop_index("ix_mappings_org_type", table_name="mappings")
    op.drop_table("mappings")

    op.drop_index("ux_key_results_semantic_key", table_name="key_results")
    op.drop_column("key_results", "semantic_key")

    op.drop_index("ux_kpi_indicators_semantic_key", table_name="kpi_indicators")
    op.drop_column("kpi_indicators", "semantic_key")

    op.drop_column("projects", "owner_id")

    op.drop_column("tasks", "expected_impact")
    op.drop_column("tasks", "source_ref")
    op.drop_column("tasks", "entity_id")
    op.drop_column("tasks", "entity_type")

    op.drop_index("ix_ai_insights_tenant_severity_valid_to", table_name="insights", schema="ai")
    op.drop_index("ix_ai_insights_tenant_entity", table_name="insights", schema="ai")
    op.drop_index("ix_ai_insights_tenant_widget_valid_to", table_name="insights", schema="ai")

    op.drop_column("runs", "input_snapshot_hash", schema="ai")
    op.drop_column("runs", "period_end", schema="ai")
    op.drop_column("runs", "period_start", schema="ai")

    op.drop_column("actions", "expected_impact", schema="ai")
    op.drop_column("actions", "task_id", schema="ai")
    op.drop_column("actions", "project_id", schema="ai")
    op.drop_column("actions", "entity_id", schema="ai")
    op.drop_column("actions", "entity_type", schema="ai")
    op.drop_column("actions", "widget_key", schema="ai")

    op.drop_column("insights", "key_result_id", schema="ai")
    op.drop_column("insights", "objective_id", schema="ai")
    op.drop_column("insights", "kpi_indicator_id", schema="ai")
    op.drop_column("insights", "project_id", schema="ai")
    op.drop_column("insights", "organization_id", schema="ai")
    op.drop_column("insights", "tags", schema="ai")
    op.drop_column("insights", "valid_to", schema="ai")
    op.drop_column("insights", "valid_from", schema="ai")
    op.drop_column("insights", "confidence", schema="ai")
    op.drop_column("insights", "evidence_ref", schema="ai")
    op.drop_column("insights", "metrics_json", schema="ai")
    op.drop_column("insights", "entity_id", schema="ai")
    op.drop_column("insights", "entity_type", schema="ai")
    op.drop_column("insights", "widget_key", schema="ai")

    op.drop_table("recommendations", schema="ai")
    op.drop_table("widget_registry", schema="ai")
