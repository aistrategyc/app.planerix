"""enhance kpi system with measurements and bindings

Revision ID: 2025_10_16_enhance_kpi
Revises: 2025_10_15_1510
Create Date: 2025-10-16 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "2025_10_16_enhance_kpi"
down_revision = "2025_10_15_1510"
branch_labels = None
depends_on = None


# -----------------------------
# Helpers (safe/idempotent DDL)
# -----------------------------
def _table_exists(conn, table_name: str, schema: str = "public") -> bool:
    fq = f"{schema}.{table_name}"
    return conn.execute(text("SELECT to_regclass(:fq)"), {"fq": fq}).scalar() is not None


def _column_exists(conn, table_name: str, column_name: str, schema: str = "public") -> bool:
    return (
        conn.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema=:schema AND table_name=:table AND column_name=:col
                LIMIT 1
                """
            ),
            {"schema": schema, "table": table_name, "col": column_name},
        ).scalar()
        is not None
    )


def _constraint_exists(conn, constraint_name: str, schema: str = "public") -> bool:
    return (
        conn.execute(
            text(
                """
                SELECT 1
                FROM pg_constraint c
                JOIN pg_namespace n ON n.oid = c.connamespace
                WHERE n.nspname = :schema AND c.conname = :name
                LIMIT 1
                """
            ),
            {"schema": schema, "name": constraint_name},
        ).scalar()
        is not None
    )


def upgrade() -> None:
    """
    Enhance KPI system:
    1) Rename table 'kpis' -> 'kpi_indicators' (if needed)
    2) Add new columns to kpi_indicators (idempotent)
    3) Ensure kpi_measurements exists and has required shape (idempotent)
    4) Create metric_bindings table (idempotent)
    5) Create indexes (idempotent)
    """
    conn = op.get_bind()

    # -------------------------------------------------------------------------
    # Step 1: Rename 'kpis' -> 'kpi_indicators' (only if needed)
    # -------------------------------------------------------------------------
    if _table_exists(conn, "kpis") and not _table_exists(conn, "kpi_indicators"):
        op.rename_table("kpis", "kpi_indicators")

        # Rename indexes (safe)
        op.execute("ALTER INDEX IF EXISTS ix_kpis_org_id RENAME TO ix_kpi_indicators_org_id")
        op.execute("ALTER INDEX IF EXISTS kpis_pkey RENAME TO kpi_indicators_pkey")

    # At this point we expect kpi_indicators to exist (or already existed)
    if not _table_exists(conn, "kpi_indicators"):
        # Nothing to do (unexpected), but keep migration safe.
        return

    # FK name normalization (old constraint name might remain after rename)
    op.execute("ALTER TABLE kpi_indicators DROP CONSTRAINT IF EXISTS kpis_org_id_fkey;")
    if not _constraint_exists(conn, "kpi_indicators_org_id_fkey"):
        op.create_foreign_key(
            "kpi_indicators_org_id_fkey",
            "kpi_indicators",
            "organizations",
            ["org_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # -------------------------------------------------------------------------
    # Step 2: Add new columns to kpi_indicators (ADD COLUMN IF NOT EXISTS)
    # -------------------------------------------------------------------------
    # Values and thresholds
    op.execute("ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS baseline_value DOUBLE PRECISION;")
    op.execute("ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS warn_threshold DOUBLE PRECISION;")
    op.execute("ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS alarm_threshold DOUBLE PRECISION;")

    # Data source configuration
    op.execute(
        "ALTER TABLE kpi_indicators "
        "ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NOT NULL DEFAULT 'manual';"
    )
    op.execute("ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS formula TEXT;")
    op.execute("ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS formula_metadata JSONB;")

    # KPI type and period
    op.execute(
        "ALTER TABLE kpi_indicators "
        "ADD COLUMN IF NOT EXISTS kpi_type VARCHAR(50) NOT NULL DEFAULT 'gauge';"
    )
    op.execute(
        "ALTER TABLE kpi_indicators "
        "ADD COLUMN IF NOT EXISTS period VARCHAR(50) NOT NULL DEFAULT 'monthly';"
    )
    op.execute(
        "ALTER TABLE kpi_indicators "
        "ADD COLUMN IF NOT EXISTS aggregation VARCHAR(50) DEFAULT 'last';"
    )

    # Status tracking
    op.execute(
        "ALTER TABLE kpi_indicators "
        "ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'on_track';"
    )

    # Relationships
    op.execute("ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS owner_id UUID;")
    op.execute("ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS project_id UUID;")

    # Last update tracking
    op.execute("ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS last_measured_at TIMESTAMPTZ;")
    op.execute("ALTER TABLE kpi_indicators ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMPTZ;")

    # Meta
    op.execute(
        "ALTER TABLE kpi_indicators "
        "ADD COLUMN IF NOT EXISTS meta_data JSONB NOT NULL DEFAULT '{}'::jsonb;"
    )

    # Change description type to TEXT (safe even if already TEXT)
    if _column_exists(conn, "kpi_indicators", "description"):
        op.execute("ALTER TABLE kpi_indicators ALTER COLUMN description TYPE TEXT;")

    # Make current_value nullable + default (safe)
    if _column_exists(conn, "kpi_indicators", "current_value"):
        op.execute("ALTER TABLE kpi_indicators ALTER COLUMN current_value DROP NOT NULL;")
        op.execute("ALTER TABLE kpi_indicators ALTER COLUMN current_value SET DEFAULT 0.0;")

    # Foreign keys for relationships (only if columns exist)
    if _column_exists(conn, "kpi_indicators", "owner_id") and not _constraint_exists(conn, "kpi_indicators_owner_id_fkey"):
        op.create_foreign_key(
            "kpi_indicators_owner_id_fkey",
            "kpi_indicators",
            "users",
            ["owner_id"],
            ["id"],
            ondelete="SET NULL",
        )

    if _column_exists(conn, "kpi_indicators", "project_id") and not _constraint_exists(conn, "kpi_indicators_project_id_fkey"):
        op.create_foreign_key(
            "kpi_indicators_project_id_fkey",
            "kpi_indicators",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # Indexes (idempotent)
    op.execute("CREATE INDEX IF NOT EXISTS ix_kpi_indicators_owner_id ON kpi_indicators (owner_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_kpi_indicators_project_id ON kpi_indicators (project_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_kpi_indicators_status ON kpi_indicators (status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_kpi_indicators_period ON kpi_indicators (period);")

    # -------------------------------------------------------------------------
    # Step 3: Ensure kpi_measurements table exists and is compatible
    # -------------------------------------------------------------------------
    if not _table_exists(conn, "kpi_measurements"):
        # Create fresh if absent
        op.create_table(
            "kpi_measurements",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("indicator_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("value", sa.Float(), nullable=False),
            sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("source", sa.String(100), nullable=True, server_default="manual"),
            sa.Column("confidence_score", sa.Float(), nullable=True),
            sa.Column("meta_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.ForeignKeyConstraint(["indicator_id"], ["kpi_indicators.id"], ondelete="CASCADE"),
        )
    else:
        # If old schema has kpi_id -> rename to indicator_id (only if needed)
        if _column_exists(conn, "kpi_measurements", "kpi_id") and not _column_exists(conn, "kpi_measurements", "indicator_id"):
            op.execute("ALTER TABLE kpi_measurements RENAME COLUMN kpi_id TO indicator_id;")

        # Add missing columns (idempotent)
        op.execute("ALTER TABLE kpi_measurements ADD COLUMN IF NOT EXISTS notes TEXT;")
        op.execute("ALTER TABLE kpi_measurements ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'manual';")
        op.execute("ALTER TABLE kpi_measurements ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION;")
        op.execute("ALTER TABLE kpi_measurements ADD COLUMN IF NOT EXISTS meta_data JSONB NOT NULL DEFAULT '{}'::jsonb;")
        op.execute("ALTER TABLE kpi_measurements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();")
        op.execute("ALTER TABLE kpi_measurements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();")

        # Ensure measured_at default if column exists
        if _column_exists(conn, "kpi_measurements", "measured_at"):
            op.execute("ALTER TABLE kpi_measurements ALTER COLUMN measured_at SET DEFAULT NOW();")

    # Measurement indexes (idempotent)
    op.execute("CREATE INDEX IF NOT EXISTS ix_kpi_measurements_indicator_id ON kpi_measurements (indicator_id);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_kpi_measurements_indicator_measured_at_desc "
        "ON kpi_measurements (indicator_id, measured_at DESC);"
    )

    # -------------------------------------------------------------------------
    # Step 4: metric_bindings
    # -------------------------------------------------------------------------
    if not _table_exists(conn, "metric_bindings"):
        op.create_table(
            "metric_bindings",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("kpi_indicator_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("okr_kr_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
            sa.Column("auto_update", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("meta_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.ForeignKeyConstraint(["kpi_indicator_id"], ["kpi_indicators.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["okr_kr_id"], ["key_results.id"], ondelete="CASCADE"),
            sa.CheckConstraint(
                "(task_id IS NOT NULL)::int + (project_id IS NOT NULL)::int + (okr_kr_id IS NOT NULL)::int = 1",
                name="metric_binding_one_entity_check",
            ),
        )

    # metric_bindings indexes (idempotent)
    op.execute("CREATE INDEX IF NOT EXISTS ix_metric_bindings_kpi_indicator_id ON metric_bindings (kpi_indicator_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_metric_bindings_task_id ON metric_bindings (task_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_metric_bindings_project_id ON metric_bindings (project_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_metric_bindings_okr_kr_id ON metric_bindings (okr_kr_id);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_metric_binding_composite "
        "ON metric_bindings (task_id, okr_kr_id, kpi_indicator_id);"
    )


def downgrade() -> None:
    """
    Rollback KPI enhancements (best-effort, safe).
    NOTE: kpi_measurements might pre-exist from earlier migrations; we do not drop it aggressively.
    """
    conn = op.get_bind()

    # Drop metric_bindings (safe)
    op.execute("DROP TABLE IF EXISTS metric_bindings CASCADE;")

    # Drop indexes we created on measurements (safe)
    op.execute("DROP INDEX IF EXISTS ix_kpi_measurements_indicator_measured_at_desc;")
    op.execute("DROP INDEX IF EXISTS ix_kpi_measurements_indicator_id;")

    # Drop KPI-indicator indexes (safe)
    op.execute("DROP INDEX IF EXISTS ix_kpi_indicators_period;")
    op.execute("DROP INDEX IF EXISTS ix_kpi_indicators_status;")
    op.execute("DROP INDEX IF EXISTS ix_kpi_indicators_project_id;")
    op.execute("DROP INDEX IF EXISTS ix_kpi_indicators_owner_id;")

    # Drop FKs we added (safe)
    op.execute("ALTER TABLE kpi_indicators DROP CONSTRAINT IF EXISTS kpi_indicators_project_id_fkey;")
    op.execute("ALTER TABLE kpi_indicators DROP CONSTRAINT IF EXISTS kpi_indicators_owner_id_fkey;")

    # Drop columns we added (safe)
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS meta_data;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS next_review_date;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS last_measured_at;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS project_id;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS owner_id;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS status;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS aggregation;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS period;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS kpi_type;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS formula_metadata;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS formula;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS source_type;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS alarm_threshold;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS warn_threshold;")
    op.execute("ALTER TABLE kpi_indicators DROP COLUMN IF EXISTS baseline_value;")

    # Try to restore types (best-effort)
    if _column_exists(conn, "kpi_indicators", "description"):
        # original was VARCHAR(1024) in твоей схеме; если нужно вернуть:
        op.execute("ALTER TABLE kpi_indicators ALTER COLUMN description TYPE VARCHAR(1024);")

    if _column_exists(conn, "kpi_indicators", "current_value"):
        # вернуть NOT NULL можно только если нет NULL в данных — поэтому делаем мягко:
        op.execute("ALTER TABLE kpi_indicators ALTER COLUMN current_value SET DEFAULT NULL;")

    # Rename back to kpis if needed
    if _table_exists(conn, "kpi_indicators") and not _table_exists(conn, "kpis"):
        op.execute("ALTER TABLE kpi_indicators DROP CONSTRAINT IF EXISTS kpi_indicators_org_id_fkey;")
        op.rename_table("kpi_indicators", "kpis")
        op.execute("ALTER INDEX IF EXISTS kpi_indicators_pkey RENAME TO kpis_pkey")
        op.execute("ALTER INDEX IF EXISTS ix_kpi_indicators_org_id RENAME TO ix_kpis_org_id")

        # restore original FK name
        if not _constraint_exists(conn, "kpis_org_id_fkey"):
            op.create_foreign_key(
                "kpis_org_id_fkey",
                "kpis",
                "organizations",
                ["org_id"],
                ["id"],
                ondelete="CASCADE",
            )