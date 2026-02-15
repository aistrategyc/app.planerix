from __future__ import annotations

import uuid

from sqlalchemy import (
    Column,
    Enum as SQLEnum,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from liderix_api.db import Base
from liderix_api.enums import MembershipRole, MembershipStatus
from .mixins import TimestampMixin, SoftDeleteMixin, OrgFKMixin


class Membership(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "memberships"

    __table_args__ = (
        UniqueConstraint("org_id", "user_id", name="uq_membership_org_user"),
        Index("ix_membership_role", "role"),
        Index("ix_membership_status", "status"),
        Index("ix_membership_meta_data_gin", "meta_data", postgresql_using="gin"))

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    department_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    role = Column(
        SQLEnum(
            MembershipRole,
            name="membershiprole",
            native_enum=True,
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=MembershipRole.MEMBER,
        nullable=False,
    )

    status = Column(
        SQLEnum(
            MembershipStatus,
            name="membershipstatus",
            native_enum=True,
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=MembershipStatus.ACTIVE,
        nullable=False,
    )
    # Removed validators - using centralized enums

    invited_by_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True)

    joined_at = Column(
        DateTime(timezone=True),
        nullable=True)

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {})

    # Relationships
    organization = relationship(
        "Organization",
        lazy="selectin")

    user = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="memberships",
        lazy="selectin",
    )

    department = relationship(
        "Department",
        back_populates="memberships",
        lazy="selectin",
    )

    invited_by = relationship(
        "User",
        foreign_keys=[invited_by_id],
        lazy="selectin",
        overlaps="memberships,invited_by",
    )

    __mapper_args__ = {
        "eager_defaults": True,
    }

    def __repr__(self) -> str:
        return f"<Membership id={self.id} user_id={self.user_id} org_id={self.org_id} role={self.role.value!r}>"
