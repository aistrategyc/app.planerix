"""Add new membership roles

Revision ID: 2025_10_15_1400_add_new_membership_roles
Revises: 2025_09_30_1314_enhanced_okr_kpi_system
Create Date: 2025-10-15T14:00:00.000000

Adds new hierarchical membership roles:
- bu_manager (Business Unit Manager)
- hod (Head of Department)
- team_lead (Team Lead)
- pmo (PMO/HR/Finance)

These roles expand the organization hierarchy to support multi-level management structures.
"""

revision = '2025_10_15_1400_add_new_membership_roles'
down_revision = '2025_09_30_1314_enhanced_okr_kpi_system'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    """
    Add new membership roles to support hierarchical organization structure.

    This migration updates the membershiprole enum type to include:
    - BU_MANAGER: Business Unit Manager
    - HEAD_OF_DEPARTMENT (hod): Head of Department
    - TEAM_LEAD: Team Lead
    - PMO: PMO/HR/Finance (read-only reporting access)
    - GUEST: Guest/Partner access

    Note: PostgreSQL ENUM types require ALTER TYPE ADD VALUE for each new value.
    """

    # Add new enum values to the membershiprole type
    # PostgreSQL ENUMs are case-sensitive and we use UPPER_CASE convention

    op.execute("ALTER TYPE membershiprole ADD VALUE IF NOT EXISTS 'BU_MANAGER';")
    op.execute("ALTER TYPE membershiprole ADD VALUE IF NOT EXISTS 'HEAD_OF_DEPARTMENT';")
    op.execute("ALTER TYPE membershiprole ADD VALUE IF NOT EXISTS 'TEAM_LEAD';")
    op.execute("ALTER TYPE membershiprole ADD VALUE IF NOT EXISTS 'PMO';")
    op.execute("ALTER TYPE membershiprole ADD VALUE IF NOT EXISTS 'GUEST';")


def downgrade() -> None:
    """
    Remove new membership roles and revert to original role set.

    WARNING: PostgreSQL does not support removing enum values directly.
    This downgrade function is intentionally left empty.

    To remove enum values, you would need to:
    1. Update all records using the new values
    2. Create a new enum type without the values
    3. Alter the column to use the new type
    4. Drop the old type

    This is a complex operation and should be done manually if needed.
    """
    pass
