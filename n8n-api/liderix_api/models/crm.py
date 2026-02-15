from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from liderix_api.db import Base
from liderix_api.enums import (
    CRMContactStatus,
    CRMContactPriority,
    CRMContactSource,
    CRMDealStage,
)
from .mixins import TimestampMixin, SoftDeleteMixin, OrgFKMixin


class CRMContact(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "crm_contacts"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    company = Column(String(200), nullable=True)
    position = Column(String(200), nullable=True)

    status = Column(
        SQLEnum(CRMContactStatus, name="crmcontactstatus", native_enum=False,
                values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=CRMContactStatus.LEAD,
    )
    priority = Column(
        SQLEnum(CRMContactPriority, name="crmcontactpriority", native_enum=False,
                values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=CRMContactPriority.MEDIUM,
    )
    source = Column(
        SQLEnum(CRMContactSource, name="crmcontactsource", native_enum=False,
                values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=CRMContactSource.WEBSITE,
    )

    value = Column(Float, nullable=True)
    last_contact = Column(DateTime(timezone=True), nullable=True)
    next_follow_up = Column(DateTime(timezone=True), nullable=True)

    notes = Column(Text, nullable=True)
    tags = Column(JSONB, nullable=True, default=list)

    deals = relationship(
        "CRMDeal",
        back_populates="contact",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class CRMDeal(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "crm_deals"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    title = Column(String(200), nullable=False)
    contact_id = Column(PG_UUID(as_uuid=True), ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True)

    company = Column(String(200), nullable=True)
    amount = Column(Float, nullable=False, default=0.0)
    stage = Column(
        SQLEnum(CRMDealStage, name="crmdealstage", native_enum=False,
                values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=CRMDealStage.PROSPECTING,
    )
    probability = Column(Integer, nullable=False, default=0)
    expected_close_date = Column(DateTime(timezone=True), nullable=True)

    contact = relationship("CRMContact", back_populates="deals", lazy="selectin")
