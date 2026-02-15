"""create_crm_tables

Adds CRM contacts and deals tables for production CRM features.

Revision ID: 2025_12_22-1800
Revises: 2025_12_20_1200_normalize_enums_lowercase
Create Date: 2025-12-22 18:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2025_12_22_1800"
down_revision = "2025_12_20_1200_normalize_enums_lowercase"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "crm_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("company", sa.String(length=200), nullable=True),
        sa.Column("position", sa.String(length=200), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "lead",
                "prospect",
                "customer",
                "inactive",
                name="crmcontactstatus",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.Enum(
                "low",
                "medium",
                "high",
                name="crmcontactpriority",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "source",
            sa.Enum(
                "website",
                "referral",
                "cold_outreach",
                "event",
                "social",
                name="crmcontactsource",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("last_contact", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_follow_up", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_crm_contacts_org_id", "crm_contacts", ["org_id"])
    op.create_index("ix_crm_contacts_email", "crm_contacts", ["email"])
    op.create_index("ix_crm_contacts_status", "crm_contacts", ["status"])
    op.create_index("ix_crm_contacts_priority", "crm_contacts", ["priority"])

    op.create_table(
        "crm_deals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("company", sa.String(length=200), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column(
            "stage",
            sa.Enum(
                "prospecting",
                "qualification",
                "proposal",
                "negotiation",
                "closed_won",
                "closed_lost",
                name="crmdealstage",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("probability", sa.Integer(), nullable=False),
        sa.Column("expected_close_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["contact_id"], ["crm_contacts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_crm_deals_org_id", "crm_deals", ["org_id"])
    op.create_index("ix_crm_deals_stage", "crm_deals", ["stage"])
    op.create_index("ix_crm_deals_contact_id", "crm_deals", ["contact_id"])


def downgrade() -> None:
    op.drop_index("ix_crm_deals_contact_id", table_name="crm_deals")
    op.drop_index("ix_crm_deals_stage", table_name="crm_deals")
    op.drop_index("ix_crm_deals_org_id", table_name="crm_deals")
    op.drop_table("crm_deals")

    op.drop_index("ix_crm_contacts_priority", table_name="crm_contacts")
    op.drop_index("ix_crm_contacts_status", table_name="crm_contacts")
    op.drop_index("ix_crm_contacts_email", table_name="crm_contacts")
    op.drop_index("ix_crm_contacts_org_id", table_name="crm_contacts")
    op.drop_table("crm_contacts")
