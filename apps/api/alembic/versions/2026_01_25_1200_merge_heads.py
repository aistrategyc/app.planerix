"""merge_heads

Revision ID: 2026_01_25_1200
Revises: 2025_10_16_enhance_kpi, 2025_12_28_1500, 2026_01_20_1200, 2025_09_30_1314_enhanced_okr_kpi_system
Create Date: 2026-01-25 12:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "2026_01_25_1200"
down_revision = (
    "2025_10_16_enhance_kpi",
    "2025_12_28_1500",
    "2026_01_20_1200",
    "2025_09_30_1314_enhanced_okr_kpi_system",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge revision to unify multiple heads. No schema changes.
    pass


def downgrade() -> None:
    # Merge revision has no downgrade actions.
    pass
