"""create userrole enum

Revision ID: b7e7f655d191
Revises: 28ffbd592d13
Create Date: 2025-12-13 13:38:50.288520

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "b7e7f655d191"
down_revision: Union[str, Sequence[str], None] = "28ffbd592d13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLE_VALUES = ["admin", "manager", "member", "guest"]
DEFAULT_ROLE = "member"


def upgrade() -> None:
    # 1) Create enum type if missing
    enum_list_sql = ", ".join([f"'{v}'" for v in ROLE_VALUES])
    op.execute(
        f"""
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
        CREATE TYPE userrole AS ENUM ({enum_list_sql});
    END IF;
END$$;
"""
    )

    # 2) Ensure all values exist in enum (safe if enum already exists)
    for v in ROLE_VALUES:
        op.execute(
            f"""
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'userrole' AND e.enumlabel = '{v}'
    ) THEN
        ALTER TYPE userrole ADD VALUE '{v}';
    END IF;
END$$;
"""
        )

    # 3) Convert users.role column to enum userrole
    # drop default first to avoid casting conflicts
    op.execute("ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;")

    # normalize possible legacy values to lowercase before cast
    op.execute(
        f"""
UPDATE public.users
SET role = lower(role::text)
WHERE role IS NOT NULL;
"""
    )

    # set NULL/empty to default
    op.execute(
        f"""
UPDATE public.users
SET role = '{DEFAULT_ROLE}'
WHERE role IS NULL OR btrim(role::text) = '';
"""
    )

    # if somehow unknown values exist -> force to default (otherwise cast will fail)
    allowed_sql = ", ".join([f"'{v}'" for v in ROLE_VALUES])
    op.execute(
        f"""
UPDATE public.users
SET role = '{DEFAULT_ROLE}'
WHERE role::text NOT IN ({allowed_sql});
"""
    )

    # convert type
    op.execute(
        f"""
ALTER TABLE public.users
    ALTER COLUMN role TYPE userrole
    USING role::text::userrole;
"""
    )

    # set default and not null (если у тебя в схеме already NOT NULL — ок)
    op.execute(f"ALTER TABLE public.users ALTER COLUMN role SET DEFAULT '{DEFAULT_ROLE}'::userrole;")
    op.execute("ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;")


def downgrade() -> None:
    # back to varchar
    op.execute("ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;")
    op.execute("ALTER TABLE public.users ALTER COLUMN role TYPE varchar USING role::text;")
    op.execute("DROP TYPE IF EXISTS userrole;")