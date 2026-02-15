"""Normalize enum values to lowercase and canonical names.

Revision ID: 2025_12_20_1200_normalize_enums_lowercase
Revises: 118e01914bae
Create Date: 2025-12-20 12:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "2025_12_20_1200_normalize_enums_lowercase"
down_revision = "118e01914bae"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # membershiprole
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membershiprole') THEN
        CREATE TYPE membershiprole_new AS ENUM (
            'owner', 'admin', 'bu_manager', 'hod', 'team_lead', 'pmo', 'member', 'guest'
        );

        IF to_regclass('public.memberships') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.memberships
                ALTER COLUMN role TYPE membershiprole_new
                USING (
                    CASE
                        WHEN role::text = 'OWNER' THEN 'owner'
                        WHEN role::text = 'ADMIN' THEN 'admin'
                        WHEN role::text = 'BU_MANAGER' THEN 'bu_manager'
                        WHEN role::text = 'HEAD_OF_DEPARTMENT' THEN 'hod'
                        WHEN role::text = 'TEAM_LEAD' THEN 'team_lead'
                        WHEN role::text = 'PMO' THEN 'pmo'
                        WHEN role::text = 'MEMBER' THEN 'member'
                        WHEN role::text = 'VIEWER' THEN 'guest'
                        WHEN role::text = 'GUEST' THEN 'guest'
                        ELSE lower(role::text)
                    END
                )::membershiprole_new
            $q$;
        END IF;

        IF to_regclass('public.invitations') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.invitations
                ALTER COLUMN role TYPE membershiprole_new
                USING (
                    CASE
                        WHEN role::text = 'OWNER' THEN 'owner'
                        WHEN role::text = 'ADMIN' THEN 'admin'
                        WHEN role::text = 'BU_MANAGER' THEN 'bu_manager'
                        WHEN role::text = 'HEAD_OF_DEPARTMENT' THEN 'hod'
                        WHEN role::text = 'TEAM_LEAD' THEN 'team_lead'
                        WHEN role::text = 'PMO' THEN 'pmo'
                        WHEN role::text = 'MEMBER' THEN 'member'
                        WHEN role::text = 'VIEWER' THEN 'guest'
                        WHEN role::text = 'GUEST' THEN 'guest'
                        ELSE lower(role::text)
                    END
                )::membershiprole_new
            $q$;
        END IF;

        DROP TYPE membershiprole;
        ALTER TYPE membershiprole_new RENAME TO membershiprole;
    END IF;
END $$;
"""
    )

    # membershipstatus
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membershipstatus') THEN
        CREATE TYPE membershipstatus_new AS ENUM ('active', 'pending', 'suspended', 'inactive');

        IF to_regclass('public.memberships') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.memberships
                ALTER COLUMN status TYPE membershipstatus_new
                USING (
                    CASE
                        WHEN status::text = 'ACTIVE' THEN 'active'
                        WHEN status::text = 'PENDING' THEN 'pending'
                        WHEN status::text = 'INACTIVE' THEN 'inactive'
                        WHEN status::text = 'SUSPENDED' THEN 'suspended'
                        ELSE lower(status::text)
                    END
                )::membershipstatus_new
            $q$;
        END IF;

        DROP TYPE membershipstatus;
        ALTER TYPE membershipstatus_new RENAME TO membershipstatus;
    END IF;
END $$;
"""
    )

    # invitationstatus
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitationstatus') THEN
        CREATE TYPE invitationstatus_new AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'cancelled');

        IF to_regclass('public.invitations') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.invitations
                ALTER COLUMN status TYPE invitationstatus_new
                USING (
                    CASE
                        WHEN status::text = 'PENDING' THEN 'pending'
                        WHEN status::text = 'ACCEPTED' THEN 'accepted'
                        WHEN status::text = 'REJECTED' THEN 'rejected'
                        WHEN status::text = 'EXPIRED' THEN 'expired'
                        WHEN status::text = 'CANCELLED' THEN 'cancelled'
                        ELSE lower(status::text)
                    END
                )::invitationstatus_new
            $q$;
        END IF;

        DROP TYPE invitationstatus;
        ALTER TYPE invitationstatus_new RENAME TO invitationstatus;
    END IF;
END $$;
"""
    )

    # taskstatus
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'taskstatus') THEN
        CREATE TYPE taskstatus_new AS ENUM ('todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled');

        IF to_regclass('public.tasks') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.tasks
                ALTER COLUMN status TYPE taskstatus_new
                USING (
                    CASE
                        WHEN status::text = 'TODO' THEN 'todo'
                        WHEN status::text = 'IN_PROGRESS' THEN 'in_progress'
                        WHEN status::text = 'IN_REVIEW' THEN 'in_review'
                        WHEN status::text = 'BLOCKED' THEN 'blocked'
                        WHEN status::text = 'DONE' THEN 'done'
                        WHEN status::text = 'CANCELLED' THEN 'cancelled'
                        ELSE lower(status::text)
                    END
                )::taskstatus_new
            $q$;
        END IF;

        DROP TYPE taskstatus;
        ALTER TYPE taskstatus_new RENAME TO taskstatus;
    END IF;
END $$;
"""
    )

    # taskpriority
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'taskpriority') THEN
        CREATE TYPE taskpriority_new AS ENUM ('low', 'medium', 'high', 'critical');

        IF to_regclass('public.tasks') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.tasks
                ALTER COLUMN priority TYPE taskpriority_new
                USING (
                    CASE
                        WHEN priority::text = 'LOW' THEN 'low'
                        WHEN priority::text = 'MEDIUM' THEN 'medium'
                        WHEN priority::text = 'HIGH' THEN 'high'
                        WHEN priority::text = 'URGENT' THEN 'critical'
                        WHEN priority::text = 'CRITICAL' THEN 'critical'
                        ELSE lower(priority::text)
                    END
                )::taskpriority_new
            $q$;
        END IF;

        DROP TYPE taskpriority;
        ALTER TYPE taskpriority_new RENAME TO taskpriority;
    END IF;
END $$;
"""
    )

    # tasktype
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tasktype') THEN
        CREATE TYPE tasktype_new AS ENUM ('task', 'bug', 'feature', 'improvement', 'research');

        IF to_regclass('public.tasks') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.tasks
                ALTER COLUMN task_type TYPE tasktype_new
                USING (
                    CASE
                        WHEN task_type::text = 'TASK' THEN 'task'
                        WHEN task_type::text = 'BUG' THEN 'bug'
                        WHEN task_type::text = 'FEATURE' THEN 'feature'
                        WHEN task_type::text = 'IMPROVEMENT' THEN 'improvement'
                        WHEN task_type::text = 'RESEARCH' THEN 'research'
                        ELSE lower(task_type::text)
                    END
                )::tasktype_new
            $q$;
        END IF;

        DROP TYPE tasktype;
        ALTER TYPE tasktype_new RENAME TO tasktype;
    END IF;
END $$;
"""
    )

    # projectstatus
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'projectstatus') THEN
        CREATE TYPE projectstatus_new AS ENUM ('draft', 'active', 'on_hold', 'completed', 'cancelled', 'archived');

        IF to_regclass('public.projects') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.projects
                ALTER COLUMN status TYPE projectstatus_new
                USING (
                    CASE
                        WHEN status::text = 'DRAFT' THEN 'draft'
                        WHEN status::text = 'ACTIVE' THEN 'active'
                        WHEN status::text = 'ON_HOLD' THEN 'on_hold'
                        WHEN status::text = 'COMPLETED' THEN 'completed'
                        WHEN status::text = 'CANCELLED' THEN 'cancelled'
                        WHEN status::text = 'ARCHIVED' THEN 'archived'
                        ELSE lower(status::text)
                    END
                )::projectstatus_new
            $q$;
        END IF;

        DROP TYPE projectstatus;
        ALTER TYPE projectstatus_new RENAME TO projectstatus;
    END IF;
END $$;
"""
    )

    # eventtype
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eventtype') THEN
        CREATE TYPE eventtype_new AS ENUM (
            'meeting', 'task_deadline', 'project_milestone', 'okr_review',
            'personal', 'holiday', 'vacation', 'other'
        );

        IF to_regclass('public.calendar_events') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.calendar_events
                ALTER COLUMN event_type TYPE eventtype_new
                USING (
                    CASE
                        WHEN event_type::text = 'MEETING' THEN 'meeting'
                        WHEN event_type::text = 'TASK' THEN 'task_deadline'
                        WHEN event_type::text = 'DEADLINE' THEN 'task_deadline'
                        WHEN event_type::text = 'MILESTONE' THEN 'project_milestone'
                        WHEN event_type::text = 'OKR_REVIEW' THEN 'okr_review'
                        WHEN event_type::text = 'REMINDER' THEN 'other'
                        WHEN event_type::text = 'KPI_UPDATE' THEN 'other'
                        WHEN event_type::text = 'OTHER' THEN 'other'
                        ELSE lower(event_type::text)
                    END
                )::eventtype_new
            $q$;
        END IF;

        DROP TYPE eventtype;
        ALTER TYPE eventtype_new RENAME TO eventtype;
    END IF;
END $$;
"""
    )

    # eventstatus
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eventstatus') THEN
        CREATE TYPE eventstatus_new AS ENUM ('confirmed', 'tentative', 'cancelled', 'completed');

        IF to_regclass('public.calendar_events') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.calendar_events
                ALTER COLUMN status TYPE eventstatus_new
                USING (
                    CASE
                        WHEN status::text = 'CONFIRMED' THEN 'confirmed'
                        WHEN status::text = 'TENTATIVE' THEN 'tentative'
                        WHEN status::text = 'CANCELLED' THEN 'cancelled'
                        WHEN status::text = 'COMPLETED' THEN 'completed'
                        ELSE lower(status::text)
                    END
                )::eventstatus_new
            $q$;
        END IF;

        DROP TYPE eventstatus;
        ALTER TYPE eventstatus_new RENAME TO eventstatus;
    END IF;
END $$;
"""
    )

    # recurrencetype
    op.execute(
        """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurrencetype') THEN
        CREATE TYPE recurrencetype_new AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly', 'custom');

        IF to_regclass('public.calendar_events') IS NOT NULL THEN
            EXECUTE $q$
                ALTER TABLE public.calendar_events
                ALTER COLUMN recurrence_type TYPE recurrencetype_new
                USING (
                    CASE
                        WHEN recurrence_type::text = 'NONE' THEN 'none'
                        WHEN recurrence_type::text = 'DAILY' THEN 'daily'
                        WHEN recurrence_type::text = 'WEEKLY' THEN 'weekly'
                        WHEN recurrence_type::text = 'MONTHLY' THEN 'monthly'
                        WHEN recurrence_type::text = 'YEARLY' THEN 'yearly'
                        WHEN recurrence_type::text = 'CUSTOM' THEN 'custom'
                        ELSE lower(recurrence_type::text)
                    END
                )::recurrencetype_new
            $q$;
        END IF;

        DROP TYPE recurrencetype;
        ALTER TYPE recurrencetype_new RENAME TO recurrencetype;
    END IF;
END $$;
"""
    )


def downgrade() -> None:
    # Downgrade is intentionally omitted: enum value removal requires manual steps.
    pass
