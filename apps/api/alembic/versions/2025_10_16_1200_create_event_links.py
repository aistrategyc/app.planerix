"""Create event_links table

Revision ID: 2025_10_16_1200_create_event_links
Revises: 2025_10_16_enhance_kpi_system
Create Date: 2025-10-16T12:00:00.000000

Links calendar events, tasks, and projects to OKR Key Results and KPI Indicators.
"""

revision = '2025_10_16_1200_create_event_links'
down_revision = '2025_10_16_enhance_kpi'  # Changed to match actual revision ID
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    """Create event_links table with constraints and indexes"""

    # Create event_links table
    op.create_table(
        'event_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),

        # Source columns (exactly one must be set)
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Target columns (exactly one must be set)
        sa.Column('okr_kr_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('kpi_indicator_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Link configuration
        sa.Column('link_type', sa.String(50), nullable=False, server_default='contributes'),
        sa.Column('weight', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('auto_update', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),

        # Metadata
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('meta_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'),

        # Timestamps and soft delete
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),

        # Primary key
        sa.PrimaryKeyConstraint('id'),

        # Foreign keys
        sa.ForeignKeyConstraint(['event_id'], ['calendar_events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['okr_kr_id'], ['key_results.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['kpi_indicator_id'], ['kpi_indicators.id'], ondelete='CASCADE'),

        # Check constraints
        sa.CheckConstraint(
            """
            (event_id IS NOT NULL)::int +
            (task_id IS NOT NULL)::int +
            (project_id IS NOT NULL)::int = 1
            """,
            name='ck_event_link_one_source'
        ),
        sa.CheckConstraint(
            """
            (okr_kr_id IS NOT NULL)::int +
            (kpi_indicator_id IS NOT NULL)::int = 1
            """,
            name='ck_event_link_one_target'
        ),
        sa.CheckConstraint(
            'weight >= 0.0 AND weight <= 1.0',
            name='ck_event_link_weight_range'
        ),
    )

    # Create indexes for efficient queries
    op.create_index('ix_event_link_event', 'event_links', ['event_id'])
    op.create_index('ix_event_link_task', 'event_links', ['task_id'])
    op.create_index('ix_event_link_project', 'event_links', ['project_id'])
    op.create_index('ix_event_link_okr_kr', 'event_links', ['okr_kr_id'])
    op.create_index('ix_event_link_kpi', 'event_links', ['kpi_indicator_id'])
    op.create_index('ix_event_link_type', 'event_links', ['link_type'])

    # Composite indexes for common query patterns
    op.create_index(
        'ix_event_link_source_composite',
        'event_links',
        ['event_id', 'task_id', 'project_id']
    )
    op.create_index(
        'ix_event_link_target_composite',
        'event_links',
        ['okr_kr_id', 'kpi_indicator_id']
    )
    op.create_index(
        'ix_event_link_active',
        'event_links',
        ['is_active', 'auto_update']
    )


def downgrade() -> None:
    """Drop event_links table and all indexes"""

    # Drop indexes first
    op.drop_index('ix_event_link_active', table_name='event_links')
    op.drop_index('ix_event_link_target_composite', table_name='event_links')
    op.drop_index('ix_event_link_source_composite', table_name='event_links')
    op.drop_index('ix_event_link_type', table_name='event_links')
    op.drop_index('ix_event_link_kpi', table_name='event_links')
    op.drop_index('ix_event_link_okr_kr', table_name='event_links')
    op.drop_index('ix_event_link_project', table_name='event_links')
    op.drop_index('ix_event_link_task', table_name='event_links')
    op.drop_index('ix_event_link_event', table_name='event_links')

    # Drop table
    op.drop_table('event_links')
