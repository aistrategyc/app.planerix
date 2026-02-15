"""add_task_watchers

Revision ID: 2025_12_28_1500
Revises: 2025_12_28_1400
Create Date: 2025-12-28 15:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2025_12_28_1500"
down_revision = "2025_12_28_1400"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_watchers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_unique_constraint(
        "uq_task_watchers_task_user",
        "task_watchers",
        ["task_id", "user_id"],
    )
    op.create_index("ix_task_watchers_task", "task_watchers", ["task_id"], unique=False)
    op.create_index("ix_task_watchers_user", "task_watchers", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_task_watchers_user", table_name="task_watchers")
    op.drop_index("ix_task_watchers_task", table_name="task_watchers")
    op.drop_constraint("uq_task_watchers_task_user", "task_watchers", type_="unique")
    op.drop_table("task_watchers")
