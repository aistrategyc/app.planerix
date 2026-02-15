"""Merge heads: notifications and new roles

Revision ID: 2025_10_15_1410_merge_heads
Revises: bfdc00ced49e, 2025_10_15_1400_add_new_membership_roles
Create Date: 2025-10-15T14:10:00.000000

Merge two migration branches:
- Notifications table recreation
- New membership roles addition
"""

revision = '2025_10_15_1410_merge_heads'
down_revision = ('bfdc00ced49e', '2025_10_15_1400_add_new_membership_roles')
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    """Merge migration - no schema changes needed"""
    pass


def downgrade() -> None:
    """Merge migration - no schema changes to revert"""
    pass
