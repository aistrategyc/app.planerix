"""Enhanced OKR/KPI system with advanced features

Revision ID: 2025_09_30_1314_enhanced_okr_kpi_system
Revises: backend_audit_fixes_2025_09_29
Create Date: 2025-09-30T13:14:00.000000

Enhanced OKR and KPI models with:
- Advanced OKR objectives and key results tracking
- KPI measurements and historical tracking
- New analytics models for comprehensive reporting
- Calendar events and file attachments
- Improved foreign key relationships
- Marketing analytics date parsing fixes
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "2025_09_30_1314_enhanced_okr_kpi_system"
down_revision = "backend_audit_fixes_2025_09_29"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Enhanced OKR/KPI schema with advanced functionality.

    Делает миграцию идемпотентной:
    - таблицу создаём только если её нет
    - индексы создаём только если их нет
    - колонки добавляем только если их нет
    """
    conn = op.get_bind()
    insp = sa.inspect(conn)

    def table_exists(name: str) -> bool:
        return insp.has_table(name, schema="public")

    def index_exists(index_name: str, table_name: str) -> bool:
        q = sa.text(
            """
            select 1
            from pg_indexes
            where schemaname='public'
              and tablename=:t
              and indexname=:i
            limit 1
            """
        )
        return conn.execute(q, {"t": table_name, "i": index_name}).scalar() is not None

    def column_exists(table_name: str, column_name: str) -> bool:
        q = sa.text(
            """
            select 1
            from information_schema.columns
            where table_schema='public'
              and table_name=:t
              and column_name=:c
            limit 1
            """
        )
        return conn.execute(q, {"t": table_name, "c": column_name}).scalar() is not None

    def add_column_if_missing(table: str, col: sa.Column) -> None:
        if not column_exists(table, col.name):
            op.add_column(table, col)

    # 1) KPI measurements table
    if not table_exists("kpi_measurements"):
        op.create_table(
            "kpi_measurements",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("kpi_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("value", sa.Float(), nullable=False),
            sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("data_source", sa.String(255), nullable=True),
            sa.Column("measured_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("meta_data", sa.JSON(), nullable=True),
            sa.Column("is_automated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("confidence_level", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["kpi_id"], ["kpis.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["measured_by"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    # Индексы (если таблица уже есть, индексы всё равно проверим)
    if table_exists("kpi_measurements"):
        if not index_exists("idx_measurement_kpi_date", "kpi_measurements"):
            op.create_index("idx_measurement_kpi_date", "kpi_measurements", ["kpi_id", "measured_at"])
        if not index_exists("idx_measurement_date", "kpi_measurements"):
            op.create_index("idx_measurement_date", "kpi_measurements", ["measured_at"])

    # 2) Enhance KPIs table with new columns (идемпотентно)
    add_column_if_missing("kpis", sa.Column("baseline_value", sa.Float(), nullable=True))
    add_column_if_missing("kpis", sa.Column("unit", sa.String(50), nullable=True))
    add_column_if_missing(
        "kpis",
        sa.Column("is_higher_better", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    add_column_if_missing("kpis", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True))
    add_column_if_missing("kpis", sa.Column("end_date", sa.DateTime(timezone=True), nullable=True))
    add_column_if_missing("kpis", sa.Column("next_review_date", sa.DateTime(timezone=True), nullable=True))
    add_column_if_missing("kpis", sa.Column("objective_id", postgresql.UUID(as_uuid=True), nullable=True))
    add_column_if_missing("kpis", sa.Column("tags", sa.JSON(), nullable=True))
    add_column_if_missing("kpis", sa.Column("formula", sa.Text(), nullable=True))
    add_column_if_missing("kpis", sa.Column("data_source", sa.String(255), nullable=True))
    add_column_if_missing("kpis", sa.Column("automation_config", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade enhanced OKR/KPI schema (также максимально безопасно/идемпотентно)."""
    conn = op.get_bind()
    insp = sa.inspect(conn)

    def table_exists(name: str) -> bool:
        return insp.has_table(name, schema="public")

    def index_exists(index_name: str, table_name: str) -> bool:
        q = sa.text(
            """
            select 1
            from pg_indexes
            where schemaname='public'
              and tablename=:t
              and indexname=:i
            limit 1
            """
        )
        return conn.execute(q, {"t": table_name, "i": index_name}).scalar() is not None

    def column_exists(table_name: str, column_name: str) -> bool:
        q = sa.text(
            """
            select 1
            from information_schema.columns
            where table_schema='public'
              and table_name=:t
              and column_name=:c
            limit 1
            """
        )
        return conn.execute(q, {"t": table_name, "c": column_name}).scalar() is not None

    def drop_column_if_exists(table: str, column: str) -> None:
        if column_exists(table, column):
            op.drop_column(table, column)

    # Drop measurement table + indexes
    if table_exists("kpi_measurements"):
        if index_exists("idx_measurement_date", "kpi_measurements"):
            op.drop_index("idx_measurement_date", table_name="kpi_measurements")
        if index_exists("idx_measurement_kpi_date", "kpi_measurements"):
            op.drop_index("idx_measurement_kpi_date", table_name="kpi_measurements")
        op.drop_table("kpi_measurements")

    # Remove enhanced KPI columns
    enhanced_columns = [
        "baseline_value",
        "unit",
        "is_higher_better",
        "start_date",
        "end_date",
        "next_review_date",
        "objective_id",
        "tags",
        "formula",
        "data_source",
        "automation_config",
    ]
    for c in enhanced_columns:
        drop_column_if_exists("kpis", c)