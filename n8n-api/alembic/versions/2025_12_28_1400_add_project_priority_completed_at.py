"""add_project_priority_completed_at

Revision ID: 2025_12_28_1400
Revises: 2025_12_27_1010
Create Date: 2025-12-28 14:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2025_12_28_1400"
down_revision = "2025_12_27_1010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "priority",
            sa.Enum(
                "low",
                "medium",
                "high",
                "urgent",
                name="projectpriority",
                native_enum=False,
            ),
            nullable=True,
            server_default="medium",
        ),
    )
    op.add_column(
        "projects",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE projects SET priority = 'medium' WHERE priority IS NULL")
    op.alter_column("projects", "priority", server_default=None)
    op.create_index("ix_projects_priority", "projects", ["priority"], unique=False)
    op.create_index("ix_projects_completed_at", "projects", ["completed_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_projects_completed_at", table_name="projects")
    op.drop_index("ix_projects_priority", table_name="projects")
    op.drop_column("projects", "completed_at")
    op.drop_column("projects", "priority")
