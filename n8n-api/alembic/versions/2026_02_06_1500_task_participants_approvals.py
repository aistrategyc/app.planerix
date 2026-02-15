"""task_participants_approvals

Revision ID: 2026_02_06_1500
Revises: 2026_02_06_1200
Create Date: 2026-02-06 15:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2026_02_06_1500"
down_revision = "2026_02_06_1200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    role_enum = sa.Enum(
        "creator",
        "assignee",
        "responsible",
        "approver",
        "watcher",
        name="taskparticipantrole",
        native_enum=False,
    )
    approval_enum = sa.Enum(
        "pending",
        "approved",
        "rejected",
        name="taskapprovalstatus",
        native_enum=False,
    )

    op.create_table(
        "task_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("task_id", "user_id", "role", name="uq_task_participants_task_user_role"),
    )
    op.create_index("ix_task_participants_task", "task_participants", ["task_id"])
    op.create_index("ix_task_participants_user", "task_participants", ["user_id"])
    op.create_index("ix_task_participants_role", "task_participants", ["role"])

    op.create_table(
        "task_approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", approval_enum, nullable=False, server_default="pending"),
        sa.Column("requested_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["decided_by_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_task_approvals_task", "task_approvals", ["task_id"])
    op.create_index("ix_task_approvals_status", "task_approvals", ["status"])


def downgrade() -> None:
    op.drop_index("ix_task_approvals_status", table_name="task_approvals")
    op.drop_index("ix_task_approvals_task", table_name="task_approvals")
    op.drop_table("task_approvals")

    op.drop_index("ix_task_participants_role", table_name="task_participants")
    op.drop_index("ix_task_participants_user", table_name="task_participants")
    op.drop_index("ix_task_participants_task", table_name="task_participants")
    op.drop_table("task_participants")
