"""coremodules_okr_project_team_policy

Revision ID: 2026_02_06_1200
Revises: 2026_01_27_1345
Create Date: 2026-02-06 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2026_02_06_1200"
down_revision = "2026_01_27_1345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # objectives: visibility/tags/scope
    op.add_column(
        "objectives",
        sa.Column(
            "visibility",
            sa.Enum("private", "internal", "public", name="objectivevisibility", native_enum=False),
            nullable=False,
            server_default="internal",
        ),
    )
    op.add_column("objectives", sa.Column("tags", postgresql.JSONB(), nullable=True))
    op.add_column("objectives", sa.Column("scope_type", sa.String(length=50), nullable=True))
    op.add_column("objectives", sa.Column("scope_ref", sa.String(length=120), nullable=True))
    op.alter_column("objectives", "visibility", server_default=None)

    # key_results: metric bindings
    op.add_column("key_results", sa.Column("metric_key", sa.String(length=120), nullable=True))
    op.add_column("key_results", sa.Column("metric_def_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("key_results", sa.Column("filters_json", postgresql.JSONB(), nullable=True))
    op.add_column(
        "key_results",
        sa.Column(
            "direction",
            sa.Enum("increase", "decrease", name="keyresultdirection", native_enum=False),
            nullable=False,
            server_default="increase",
        ),
    )
    op.add_column(
        "key_results",
        sa.Column(
            "progress_rule",
            sa.Enum("linear", "ratio", "capped", name="keyresultprogressrule", native_enum=False),
            nullable=False,
            server_default="linear",
        ),
    )
    op.add_column("key_results", sa.Column("data_quality_requirements", postgresql.JSONB(), nullable=True))
    op.create_index("ix_key_results_metric_key", "key_results", ["metric_key"])
    op.create_index("ix_key_results_metric_def_id", "key_results", ["metric_def_id"])
    op.create_foreign_key(
        "fk_key_results_metric_def_id",
        "key_results",
        "metric_definitions",
        ["metric_def_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("key_results", "direction", server_default=None)
    op.alter_column("key_results", "progress_rule", server_default=None)

    # projects: budget/tags/objective link
    op.add_column("projects", sa.Column("budget", sa.Float(), nullable=True))
    op.add_column("projects", sa.Column("tags", postgresql.JSONB(), nullable=True))
    op.add_column("projects", sa.Column("objective_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_project_tags_gin", "projects", ["tags"], postgresql_using="gin")
    op.create_index("ix_projects_objective_id", "projects", ["objective_id"])
    op.create_foreign_key(
        "fk_projects_objective_id",
        "projects",
        "objectives",
        ["objective_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # departments: policy
    op.add_column("departments", sa.Column("policy", postgresql.JSONB(), nullable=True))
    op.create_index("ix_department_policy_gin", "departments", ["policy"], postgresql_using="gin")


def downgrade() -> None:
    # departments
    op.drop_index("ix_department_policy_gin", table_name="departments")
    op.drop_column("departments", "policy")

    # projects
    op.drop_constraint("fk_projects_objective_id", "projects", type_="foreignkey")
    op.drop_index("ix_projects_objective_id", table_name="projects")
    op.drop_index("ix_project_tags_gin", table_name="projects")
    op.drop_column("projects", "objective_id")
    op.drop_column("projects", "tags")
    op.drop_column("projects", "budget")

    # key_results
    op.drop_constraint("fk_key_results_metric_def_id", "key_results", type_="foreignkey")
    op.drop_index("ix_key_results_metric_def_id", table_name="key_results")
    op.drop_index("ix_key_results_metric_key", table_name="key_results")
    op.drop_column("key_results", "data_quality_requirements")
    op.drop_column("key_results", "progress_rule")
    op.drop_column("key_results", "direction")
    op.drop_column("key_results", "filters_json")
    op.drop_column("key_results", "metric_def_id")
    op.drop_column("key_results", "metric_key")

    # objectives
    op.drop_column("objectives", "scope_ref")
    op.drop_column("objectives", "scope_type")
    op.drop_column("objectives", "tags")
    op.drop_column("objectives", "visibility")
