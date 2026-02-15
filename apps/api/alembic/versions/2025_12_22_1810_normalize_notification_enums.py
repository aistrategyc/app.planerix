"""normalize_notification_enums

Normalize notification enums to lowercase values to match application enums.

Revision ID: 2025_12_22-1810
Revises: 2025_12_22-1800
Create Date: 2025-12-22 18:10:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "2025_12_22_1810"
down_revision = "2025_12_22_1800"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
DO $$
BEGIN
    CREATE TYPE notificationtype_new_tmp AS ENUM (
        'system', 'task_assigned', 'task_completed', 'task_overdue',
        'project_update', 'mention', 'comment', 'deadline_reminder',
        'okr_update', 'kpi_alert', 'invitation'
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
    CREATE TYPE notificationstatus_new_tmp AS ENUM ('unread', 'read', 'archived');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
"""
    )

    op.execute(
        """
DO $$
BEGIN
    CREATE TYPE notificationchannel_tmp AS ENUM ('in_app', 'email', 'sms', 'push', 'slack');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
"""
    )

    op.execute(
        """
ALTER TABLE notifications
    ALTER COLUMN type TYPE notificationtype_new_tmp
    USING lower(type::text)::notificationtype_new_tmp;
"""
    )
    op.execute(
        """
ALTER TABLE notifications
    ALTER COLUMN status DROP DEFAULT;
"""
    )
    op.execute(
        """
ALTER TABLE notifications
    ALTER COLUMN status TYPE notificationstatus_new_tmp
    USING lower(status::text)::notificationstatus_new_tmp;
"""
    )
    op.execute(
        """
ALTER TABLE notifications
    ALTER COLUMN status SET DEFAULT 'unread';
"""
    )

    op.execute(
        """
UPDATE notifications
SET channels = (
    SELECT COALESCE(jsonb_agg(lower(value::text)), '[]'::jsonb)
    FROM jsonb_array_elements_text(channels) AS value
);
"""
    )

    op.execute(
        """
ALTER TABLE notification_preferences
    ALTER COLUMN type TYPE notificationtype_new_tmp
    USING lower(type::text)::notificationtype_new_tmp;
"""
    )

    op.execute(
        """
ALTER TABLE notification_templates
    ALTER COLUMN type TYPE notificationtype_new_tmp
    USING lower(type::text)::notificationtype_new_tmp;
"""
    )

    op.execute(
        """
ALTER TABLE notification_templates
    ALTER COLUMN channel TYPE notificationchannel_tmp
    USING lower(channel::text)::notificationchannel_tmp;
"""
    )

    op.execute("DROP TYPE IF EXISTS notificationtype_new;")
    op.execute("ALTER TYPE notificationtype_new_tmp RENAME TO notificationtype_new;")

    op.execute("DROP TYPE IF EXISTS notificationstatus_new;")
    op.execute("ALTER TYPE notificationstatus_new_tmp RENAME TO notificationstatus_new;")

    op.execute("DROP TYPE IF EXISTS notificationchannel;")
    op.execute("ALTER TYPE notificationchannel_tmp RENAME TO notificationchannel;")


def downgrade() -> None:
    op.execute(
        """
DO $$
BEGIN
    CREATE TYPE notificationtype_new_old AS ENUM (
        'SYSTEM', 'TASK_ASSIGNED', 'TASK_COMPLETED', 'TASK_OVERDUE',
        'PROJECT_UPDATE', 'MENTION', 'COMMENT', 'DEADLINE_REMINDER',
        'OKR_UPDATE', 'KPI_ALERT', 'INVITATION'
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
    CREATE TYPE notificationstatus_new_old AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
"""
    )

    op.execute(
        """
DO $$
BEGIN
    CREATE TYPE notificationchannel_old AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
"""
    )

    op.execute(
        """
ALTER TABLE notifications
    ALTER COLUMN type TYPE notificationtype_new_old
    USING upper(type::text)::notificationtype_new_old;
"""
    )
    op.execute(
        """
ALTER TABLE notifications
    ALTER COLUMN status DROP DEFAULT;
"""
    )
    op.execute(
        """
ALTER TABLE notifications
    ALTER COLUMN status TYPE notificationstatus_new_old
    USING upper(status::text)::notificationstatus_new_old;
"""
    )
    op.execute(
        """
ALTER TABLE notifications
    ALTER COLUMN status SET DEFAULT 'UNREAD';
"""
    )

    op.execute(
        """
UPDATE notifications
SET channels = (
    SELECT COALESCE(jsonb_agg(upper(value::text)), '[]'::jsonb)
    FROM jsonb_array_elements_text(channels) AS value
);
"""
    )

    op.execute(
        """
ALTER TABLE notification_preferences
    ALTER COLUMN type TYPE notificationtype_new_old
    USING upper(type::text)::notificationtype_new_old;
"""
    )

    op.execute(
        """
ALTER TABLE notification_templates
    ALTER COLUMN type TYPE notificationtype_new_old
    USING upper(type::text)::notificationtype_new_old;
"""
    )

    op.execute(
        """
ALTER TABLE notification_templates
    ALTER COLUMN channel TYPE notificationchannel_old
    USING upper(channel::text)::notificationchannel_old;
"""
    )

    op.execute("DROP TYPE IF EXISTS notificationtype_new;")
    op.execute("ALTER TYPE notificationtype_new_old RENAME TO notificationtype_new;")

    op.execute("DROP TYPE IF EXISTS notificationstatus_new;")
    op.execute("ALTER TYPE notificationstatus_new_old RENAME TO notificationstatus_new;")

    op.execute("DROP TYPE IF EXISTS notificationchannel;")
    op.execute("ALTER TYPE notificationchannel_old RENAME TO notificationchannel;")
