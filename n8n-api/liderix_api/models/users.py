from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import Column, String, Boolean, Enum as SQLEnum, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from liderix_api.db import Base
from liderix_api.enums import UserRole
from .mixins import TimestampMixin, SoftDeleteMixin


class User(Base, TimestampMixin, SoftDeleteMixin):
    """
    Модель для пользователя.
    """
    __tablename__ = "users"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)

    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    full_name = Column(String(255), nullable=True)

    hashed_password = Column(String(255), nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    # IMPORTANT:
    # - values_callable: записывает в БД enum.value (admin/manager/member/guest), а не enum.name (ADMIN/MEMBER)
    # - name="userrole": соответствует созданному в Postgres типу
    # - create_type=False: не пытаемся создать тип из ORM, т.к. он уже создан миграцией
    # - server_default: дефолт на уровне БД тоже корректный
    role = Column(
        SQLEnum(
            UserRole,
            name="userrole",
            native_enum=True,
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=UserRole.MEMBER,
        nullable=False,
        server_default=sa.text("'member'::userrole"),
    )

    position = Column(String(200), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)

    timezone = Column(String(50), nullable=True)
    language = Column(String(10), nullable=True)

    preferences = Column(JSONB, nullable=True, default=lambda: {})

    last_login_at = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)

    is_admin = Column(Boolean, default=False, nullable=False)

    client_id = Column(PG_UUID(as_uuid=True), nullable=True)

    # email verification
    verification_token_hash = Column(String(255), nullable=True, index=True)
    verification_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # password reset
    password_reset_token_hash = Column(String(255), nullable=True, index=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)

    # --- relationships ---
    api_keys = relationship("APIKey", cascade="all, delete-orphan", back_populates="user", lazy="selectin")
    clients = relationship("Client", cascade="all, delete-orphan", back_populates="user", lazy="selectin")
    event_logs = relationship("EventLog", cascade="all, delete-orphan", back_populates="user", lazy="selectin")
    change_logs = relationship("ChangeLog", cascade="all, delete-orphan", back_populates="user", lazy="selectin")

    organizations = relationship(
        "Organization",
        foreign_keys="Organization.owner_id",
        back_populates="owner",
        lazy="selectin",
    )

    memberships = relationship(
        "Membership",
        foreign_keys="Membership.user_id",
        back_populates="user",
        lazy="selectin",
    )

    jwt_refresh_whitelists = relationship(
        "JWTRefreshWhitelist",
        cascade="all, delete-orphan",
        back_populates="user",
        lazy="selectin",
    )

    notifications = relationship(
        "Notification",
        cascade="all, delete-orphan",
        back_populates="user",
        lazy="selectin",
    )

    project_memberships = relationship(
        "ProjectMember",
        cascade="all, delete-orphan",
        back_populates="user",
        lazy="selectin",
    )

    sessions = relationship("Session", cascade="all, delete-orphan", back_populates="user", lazy="selectin")

    responsibility_scopes = relationship(
        "ResponsibilityScope",
        cascade="all, delete-orphan",
        back_populates="user",
        lazy="selectin",
    )

    security_exceptions = relationship(
        "SecurityException",
        cascade="all, delete-orphan",
        back_populates="user",
        lazy="selectin",
    )

    uploads = relationship("Upload", cascade="all, delete-orphan", back_populates="user", lazy="selectin")

    tasks_assigned = relationship(
        "Task",
        foreign_keys="Task.assignee_id",
        back_populates="assignee",
        lazy="select",
    )

    tasks_created = relationship(
        "Task",
        foreign_keys="Task.creator_id",
        back_populates="creator",
        lazy="select",
    )

    tasks_reported = relationship(
        "Task",
        foreign_keys="Task.reporter_id",
        back_populates="reporter",
        lazy="select",
    )

    task_comments = relationship(
        "TaskComment",
        cascade="all, delete-orphan",
        back_populates="user",
        lazy="selectin",
    )

    task_watchers = relationship(
        "TaskWatcher",
        cascade="all, delete-orphan",
        back_populates="user",
        lazy="selectin",
    )

    file_assets = relationship(
        "FileAsset",
        back_populates="owner",
        cascade="all, delete-orphan",
        lazy="selectin",
        foreign_keys="FileAsset.owner_id",
    )

    managed_departments = relationship(
        "Department",
        foreign_keys="Department.manager_id",
        back_populates="manager",
        lazy="selectin",
    )

    task_attachments = relationship(
        "TaskAttachment",
        foreign_keys="TaskAttachment.uploaded_by_id",
        back_populates="uploaded_by",
        lazy="selectin",
    )

    task_time_logs = relationship(
        "TaskTimeLog",
        cascade="all, delete-orphan",
        back_populates="user",
        lazy="selectin",
    )

    @property
    def org_id(self):
        """
        Get the primary organization ID for this user.
        Returns the first active membership's org_id.
        """
        cached_org_id = getattr(self, "_org_id", None)
        if cached_org_id is not None:
            return cached_org_id

        state = sa.inspect(self)
        if "memberships" in state.unloaded:
            return None

        if self.memberships:
            for membership in self.memberships:
                if membership.status == "active":
                    return membership.org_id
            return self.memberships[0].org_id
        return None

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} email={self.email!r} role={self.role!r}>"
