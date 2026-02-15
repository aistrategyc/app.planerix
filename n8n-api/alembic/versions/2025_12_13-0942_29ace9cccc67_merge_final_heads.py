"""merge final heads

Revision ID: 29ace9cccc67
Revises: 2025_10_16_1200_create_event_links, 2025_10_15_1410_merge_heads
Create Date: 2025-12-13 09:42:28.768910

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29ace9cccc67'
down_revision: Union[str, Sequence[str], None] = ('2025_10_16_1200_create_event_links', '2025_10_15_1410_merge_heads')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
