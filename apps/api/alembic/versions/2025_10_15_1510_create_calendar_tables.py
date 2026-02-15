"""create_calendar_tables

Creates calendar_events, event_attendees, calendars, and calendar_permissions tables

Revision ID: 2025_10_15_1510
Revises: 2025_10_15_1500
Create Date: 2025-10-15 15:10:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2025_10_15_1510"
down_revision = "2025_10_15_1500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create calendar tables"""

    # --- Create enum types idempotently (safe if already exist) ---
    op.execute(
        """
DO $$
BEGIN
    CREATE TYPE eventtype AS ENUM (
        'MEETING', 'TASK', 'DEADLINE', 'REMINDER',
        'OKR_REVIEW', 'KPI_UPDATE', 'MILESTONE', 'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
"""
    )

    op.execute(
        """
DO $$
BEGIN
    CREATE TYPE eventstatus AS ENUM (
        'CONFIRMED', 'TENTATIVE', 'CANCELLED', 'COMPLETED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
"""
    )

    op.execute(
        """
DO $$
BEGIN
    CREATE TYPE recurrencetype AS ENUM (
        'NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
"""
    )

    op.execute(
        """
DO $$
BEGIN
    CREATE TYPE attendee_status AS ENUM (
        'pending', 'accepted', 'declined', 'tentative'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
"""
    )

    op.execute(
        """
DO $$
BEGIN
    CREATE TYPE calendar_permission_level AS ENUM (
        'read', 'write', 'admin'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
"""
    )

    # --- Reusable Enum objects (IMPORTANT: create_type=False) ---
    eventtype_enum = postgresql.ENUM(
        "MEETING",
        "TASK",
        "DEADLINE",
        "REMINDER",
        "OKR_REVIEW",
        "KPI_UPDATE",
        "MILESTONE",
        "OTHER",
        name="eventtype",
        create_type=False,
    )

    eventstatus_enum = postgresql.ENUM(
        "CONFIRMED",
        "TENTATIVE",
        "CANCELLED",
        "COMPLETED",
        name="eventstatus",
        create_type=False,
    )

    recurrencetype_enum = postgresql.ENUM(
        "NONE",
        "DAILY",
        "WEEKLY",
        "MONTHLY",
        "YEARLY",
        "CUSTOM",
        name="recurrencetype",
        create_type=False,
    )

    attendee_status_enum = postgresql.ENUM(
        "pending",
        "accepted",
        "declined",
        "tentative",
        name="attendee_status",
        create_type=False,
    )

    calendar_permission_enum = postgresql.ENUM(
        "read",
        "write",
        "admin",
        name="calendar_permission_level",
        create_type=False,
    )

    # --- calendar_events ---
    op.create_table(
        "calendar_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_type", eventtype_enum, nullable=False),
        sa.Column("status", eventstatus_enum, nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_all_day", sa.Boolean(), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=True),
        sa.Column("location", sa.String(length=500), nullable=True),
        sa.Column("meeting_url", sa.String(length=1000), nullable=True),
        sa.Column("meeting_id", sa.String(length=100), nullable=True),
        sa.Column("meeting_password", sa.String(length=100), nullable=True),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("okr_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recurrence_type", recurrencetype_enum, nullable=False),
        sa.Column("recurrence_pattern", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("recurrence_end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("parent_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_private", sa.Boolean(), nullable=False),
        sa.Column("is_important", sa.Boolean(), nullable=False),
        sa.Column("reminder_minutes", sa.Integer(), nullable=True),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("external_source", sa.String(length=100), nullable=True),
        sa.Column("meta_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("end_date >= start_date", name="chk_event_dates"),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["okr_id"], ["objectives.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_event_id"], ["calendar_events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_calendar_events_title", "calendar_events", ["title"])
    op.create_index("ix_event_dates", "calendar_events", ["start_date", "end_date"])
    op.create_index("ix_event_org_type", "calendar_events", ["org_id", "event_type"])
    op.create_index("ix_event_creator", "calendar_events", ["creator_id"])

    # --- event_attendees ---
    op.create_table(
        "event_attendees",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", attendee_status_enum, nullable=False),
        sa.Column("is_organizer", sa.Boolean(), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("response_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["calendar_events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "user_id", name="uq_event_attendee"),
    )

    op.create_index("ix_attendee_event", "event_attendees", ["event_id"])
    op.create_index("ix_attendee_user", "event_attendees", ["user_id"])
    op.create_index("ix_attendee_status", "event_attendees", ["status"])

    # --- calendars ---
    op.create_table(
        "calendars",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=7), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("external_source", sa.String(length=100), nullable=True),
        sa.Column("sync_enabled", sa.Boolean(), nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("timezone", sa.String(length=50), nullable=False),
        sa.Column("default_reminder_minutes", sa.Integer(), nullable=True),
        sa.Column("meta_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "name", name="uq_calendar_org_name"),
    )

    op.create_index("ix_calendar_owner", "calendars", ["owner_id"])
    op.create_index("ix_calendars_name", "calendars", ["name"])

    # --- calendar_permissions ---
    op.create_table(
        "calendar_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("calendar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission", calendar_permission_enum, nullable=False),
        sa.Column("granted_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["calendar_id"], ["calendars.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("calendar_id", "user_id", name="uq_calendar_permission"),
    )

    op.create_index("ix_calendar_permission_user", "calendar_permissions", ["user_id"])


def downgrade() -> None:
    """Drop calendar tables"""
    op.drop_table("calendar_permissions")
    op.drop_table("calendars")
    op.drop_table("event_attendees")
    op.drop_table("calendar_events")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS calendar_permission_level CASCADE")
    op.execute("DROP TYPE IF EXISTS attendee_status CASCADE")
    op.execute("DROP TYPE IF EXISTS recurrencetype CASCADE")
    op.execute("DROP TYPE IF EXISTS eventstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS eventtype CASCADE")