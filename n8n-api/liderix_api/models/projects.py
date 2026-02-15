from __future__ import annotations
import uuid
from sqlalchemy import Column, String, Text, Enum as SQLEnum, DateTime, ForeignKey, Index, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from liderix_api.db import Base
from liderix_api.enums import ProjectStatus, ProjectPriority
from .mixins import TimestampMixin, SoftDeleteMixin, OrgFKMixin
# Using centralized enums from liderix_api.enums
class Project(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "projects"
    __table_args__ = (
        Index("ix_project_metadata_gin", "metadata", postgresql_using="gin"),
        Index("ix_project_tags_gin", "tags", postgresql_using="gin"),
        {"extend_existing": True})
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(
        SQLEnum(
            ProjectStatus,
            name="projectstatus",
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=ProjectStatus.DRAFT,
        nullable=False,
    )
    priority = Column(
        SQLEnum(
            ProjectPriority,
            name="projectpriority",
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=ProjectPriority.MEDIUM,
        nullable=True,
    )
    budget = Column(Float, nullable=True)
    tags = Column(JSONB, nullable=True, default=lambda: [])
    meta_data = Column("metadata", JSONB, nullable=True, default=lambda: {})
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    objective_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("objectives.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    organization = relationship("Organization", lazy="selectin", overlaps="projects")
    owner = relationship("User", foreign_keys=[owner_id], lazy="selectin")
    objective = relationship("Objective", foreign_keys=[objective_id], lazy="selectin")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan", lazy="selectin", overlaps="project,members")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan", lazy="selectin", overlaps="project,tasks")
    __mapper_args__ = {"eager_defaults": True}
