"""recreate_notifications_table_simple

Fix notifications table to match current model by using pure SQL commands.
This avoids SQLAlchemy enum issues and provides direct control.

Revision ID: bfdc00ced49e
Revises: backend_audit_fixes_2025_09_29
Create Date: 2025-09-29 14:10:23.831773

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bfdc00ced49e'
down_revision: Union[str, Sequence[str], None] = 'backend_audit_fixes_2025_09_29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema using direct SQL commands."""

    # Step 1: Drop existing notifications table (it's empty)
    op.execute("DROP TABLE IF EXISTS notifications CASCADE;")

    # Step 2: Create required enum types
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE notificationtype_new AS ENUM (
                'TASK_ASSIGNED', 'TASK_COMPLETED', 'TASK_DUE',
                'PROJECT_CREATED', 'PROJECT_UPDATED',
                'MEMBER_INVITED', 'MEMBER_JOINED',
                'OKR_CREATED', 'OKR_UPDATED',
                'REMINDER', 'SYSTEM_ALERT'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE notificationstatus_new AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE notificationchannel AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # Step 3: Create notifications table with correct schema
    op.execute("""
        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type notificationtype_new NOT NULL,
            status notificationstatus_new NOT NULL DEFAULT 'UNREAD',
            title VARCHAR(500) NOT NULL,
            message TEXT NOT NULL,
            related_entity_type VARCHAR(50),
            related_entity_id UUID,
            action_url VARCHAR(1000),
            action_text VARCHAR(100),
            channels JSONB DEFAULT '["IN_APP"]',
            sent_at TIMESTAMP WITH TIME ZONE,
            read_at TIMESTAMP WITH TIME ZONE,
            priority VARCHAR(20) NOT NULL DEFAULT 'normal',
            expires_at TIMESTAMP WITH TIME ZONE,
            meta_data JSONB DEFAULT '{}',
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
    """)

    # Step 4: Create indexes
    op.execute("CREATE INDEX ix_notification_user ON notifications (user_id);")
    op.execute("CREATE INDEX ix_notification_type ON notifications (type);")
    op.execute("CREATE INDEX ix_notification_status ON notifications (status);")
    op.execute("CREATE INDEX ix_notification_created ON notifications (created_at);")
    op.execute("CREATE INDEX ix_notifications_related_entity_id ON notifications (related_entity_id);")

    # Step 5: Create notification_preferences table
    op.execute("""
        CREATE TABLE notification_preferences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type notificationtype_new NOT NULL,
            in_app_enabled BOOLEAN NOT NULL DEFAULT true,
            email_enabled BOOLEAN NOT NULL DEFAULT true,
            sms_enabled BOOLEAN NOT NULL DEFAULT false,
            push_enabled BOOLEAN NOT NULL DEFAULT true,
            immediate BOOLEAN NOT NULL DEFAULT false,
            digest_frequency VARCHAR(20) DEFAULT 'daily',
            quiet_hours_start VARCHAR(5),
            quiet_hours_end VARCHAR(5),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            UNIQUE(user_id, type)
        );
    """)

    op.execute("CREATE INDEX ix_notification_pref_user ON notification_preferences (user_id);")

    # Step 6: Create notification_templates table
    op.execute("""
        CREATE TABLE notification_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            type notificationtype_new NOT NULL,
            channel notificationchannel NOT NULL,
            title_template VARCHAR(500) NOT NULL,
            message_template TEXT NOT NULL,
            subject_template VARCHAR(200),
            required_variables JSONB DEFAULT '[]',
            optional_variables JSONB DEFAULT '[]',
            is_active BOOLEAN NOT NULL DEFAULT true,
            meta_data JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            deleted_at TIMESTAMP WITH TIME ZONE,
            UNIQUE(type, channel)
        );
    """)

    op.execute("CREATE INDEX ix_notification_template_type ON notification_templates (type);")


def downgrade() -> None:
    """Downgrade schema."""
    # Drop new tables
    op.execute("DROP TABLE IF EXISTS notification_templates CASCADE;")
    op.execute("DROP TABLE IF EXISTS notification_preferences CASCADE;")
    op.execute("DROP TABLE IF EXISTS notifications CASCADE;")

    # Drop new enum types
    op.execute("DROP TYPE IF EXISTS notificationchannel;")
    op.execute("DROP TYPE IF EXISTS notificationstatus_new;")
    op.execute("DROP TYPE IF EXISTS notificationtype_new;")

    # Recreate original notifications table (from fresh init schema)
    op.execute("""
        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(6) NOT NULL,
            status VARCHAR(7) NOT NULL,
            recipient VARCHAR(255) NOT NULL,
            subject VARCHAR(255),
            body VARCHAR(2000),
            payload JSONB,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_attempt_at TIMESTAMP WITH TIME ZONE,
            scheduled_at TIMESTAMP WITH TIME ZONE,
            sent_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            is_deleted BOOLEAN NOT NULL DEFAULT false,
            deleted_at TIMESTAMP WITH TIME ZONE,
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
        );
    """)

    op.execute("CREATE INDEX ix_notifications_org_id ON notifications (org_id);")
    op.execute("CREATE INDEX ix_notifications_user_id ON notifications (user_id);")
