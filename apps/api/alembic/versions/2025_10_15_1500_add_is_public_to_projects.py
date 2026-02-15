"""add_is_public_to_projects

Adds is_public column to projects table for calendar event access control

Revision ID: 2025_10_15_1500
Revises: 2025_10_15_1400_add_new_membership_roles
Create Date: 2025-10-15 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2025_10_15_1500'
down_revision = '2025_10_15_1400_add_new_membership_roles'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add is_public column to projects table"""
    # Add is_public column with default False
    op.add_column('projects', sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'))

    # Create index for performance
    op.create_index('ix_projects_is_public', 'projects', ['is_public'], unique=False)


def downgrade() -> None:
    """Remove is_public column from projects table"""
    op.drop_index('ix_projects_is_public', table_name='projects')
    op.drop_column('projects', 'is_public')
