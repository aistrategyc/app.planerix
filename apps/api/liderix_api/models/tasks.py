from __future__ import annotations

import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    Enum as SQLEnum,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Boolean,
    Float,
    UniqueConstraint)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from liderix_api.db import Base
from liderix_api.enums import TaskStatus, TaskPriority, TaskType, TaskParticipantRole, TaskApprovalStatus
from .mixins import TimestampMixin, SoftDeleteMixin, OrgFKMixin


# Using centralized enums from liderix_api.enums


class Task(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    """Main task model"""
    __tablename__ = "tasks"

    __table_args__ = (
        Index("ix_task_meta_data_gin", "meta_data", postgresql_using="gin"),
        Index("ix_task_assignee", "assignee_id"),
        Index("ix_task_due_date", "due_date"),
        {"extend_existing": True})

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    project_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,  # Tasks can exist without projects
        index=True)

    entity_type = Column(
        String(50),
        nullable=True,
        index=True)

    entity_id = Column(
        String(120),
        nullable=True,
        index=True)

    source_ref = Column(
        String(50),
        nullable=True)

    expected_impact = Column(
        JSONB,
        nullable=True)

    parent_task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    title = Column(
        String(500),
        nullable=False,
        index=True)

    description = Column(
        Text,
        nullable=True)

    status = Column(
        SQLEnum(
            TaskStatus,
            name="taskstatus",
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=TaskStatus.TODO,
        nullable=False)

    priority = Column(
        SQLEnum(
            TaskPriority,
            name="taskpriority",
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=TaskPriority.MEDIUM,
        nullable=False)

    task_type = Column(
        SQLEnum(
            TaskType,
            name="tasktype",
            native_enum=True,
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=TaskType.TASK,
        nullable=False)

    assignee_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    creator_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    reporter_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    due_date = Column(
        DateTime(timezone=True),
        nullable=True)

    start_date = Column(
        DateTime(timezone=True),
        nullable=True)

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True)

    estimated_hours = Column(
        Float,
        nullable=True)

    actual_hours = Column(
        Float,
        nullable=True)

    story_points = Column(
        Integer,
        nullable=True)

    progress_percentage = Column(
        Integer,
        default=0,
        nullable=False)

    is_recurring = Column(
        Boolean,
        default=False,
        nullable=False)

    recurrence_pattern = Column(
        JSONB,
        nullable=True)

    tags = Column(
        JSONB,
        nullable=True,
        default=lambda: [])

    custom_fields = Column(
        JSONB,
        nullable=True,
        default=lambda: {})

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {})

    # Relationships
    organization = relationship(
        "Organization",
        lazy="selectin",
        overlaps="tasks")

    project = relationship(
        "Project",
        lazy="selectin",
        overlaps="tasks")

    assignee = relationship(
        "User",
        foreign_keys=[assignee_id],
        lazy="selectin",
        overlaps="tasks_assigned")

    creator = relationship(
        "User",
        foreign_keys=[creator_id],
        lazy="selectin",
        overlaps="tasks_created")

    reporter = relationship(
        "User",
        foreign_keys=[reporter_id],
        lazy="selectin",
        overlaps="tasks_reported")

    parent_task = relationship(
        "Task",
        remote_side=[id],
        lazy="selectin",
        back_populates="subtasks",
        overlaps="subtasks,parent_task")

    subtasks = relationship(
        "Task",
        lazy="selectin",
        back_populates="parent_task",
        cascade="all, delete-orphan",
        overlaps="subtasks,parent_task")

    comments = relationship(
       "TaskComment",  # ✅ ИСПРАВЛЕНО: убрана строка пути
       lazy="selectin",
       order_by="TaskComment.created_at.desc()",  # ✅ ИСПРАВЛЕНО: убрана строка пути
       back_populates="task",
       cascade="all, delete-orphan")

    watchers = relationship(
        "TaskWatcher",
        lazy="selectin",
        back_populates="task",
        cascade="all, delete-orphan")

    participants = relationship(
        "TaskParticipant",
        lazy="selectin",
        back_populates="task",
        cascade="all, delete-orphan",
        overlaps="participants,task",
    )

    approvals = relationship(
        "TaskApproval",
        lazy="selectin",
        back_populates="task",
        cascade="all, delete-orphan",
        overlaps="approvals,task",
    )

    attachments = relationship(
        "TaskAttachment",
        lazy="selectin",
        back_populates="task",
        cascade="all, delete-orphan",
        overlaps="attachments,task")

    time_logs = relationship(
        "TaskTimeLog",
        lazy="selectin",
        back_populates="task",
        cascade="all, delete-orphan",
        overlaps="time_logs,task")

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<Task id={self.id} title={self.title!r} status={self.status.value!r}>"


class TaskComment(Base, TimestampMixin, SoftDeleteMixin):
    """Comments on tasks"""
    __tablename__ = "task_comments"

    __table_args__ = (
        Index("ix_comment_task_created", "task_id", "created_at"),
        Index("ix_comment_parent", "parent_comment_id"),
        {"extend_existing": True})

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    # ✅ ДОБАВЛЕНО: отсутствующее поле parent_comment_id
    parent_comment_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("task_comments.id", ondelete="CASCADE"),
        nullable=True,
        index=True)

    content = Column(
        Text,
        nullable=False)

    content_type = Column(
        String(50),
        default="text",
        nullable=False)

    is_internal = Column(
        Boolean,
        default=False,
        nullable=False)

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {})

    # ✅ ИСПРАВЛЕННЫЕ Relationships (убраны дубликаты и строки)
    task = relationship(
        "Task",
        back_populates="comments",
        lazy="selectin")

    user = relationship(
        "User",
        back_populates="task_comments",
        lazy="selectin")

    # ✅ ИСПРАВЛЕНО: правильные self-referential relationships
    parent_comment = relationship(
        "TaskComment",
        remote_side=[id],
        back_populates="replies",
        lazy="selectin")

    replies = relationship(
        "TaskComment",
        back_populates="parent_comment",
        lazy="selectin",
        cascade="all, delete-orphan")

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<TaskComment id={self.id} task_id={self.task_id} user_id={self.user_id}>"


class TaskWatcher(Base, TimestampMixin):
    """Users watching a task"""
    __tablename__ = "task_watchers"

    __table_args__ = (
        UniqueConstraint("task_id", "user_id", name="uq_task_watchers_task_user"),
        Index("ix_task_watchers_task", "task_id"),
        Index("ix_task_watchers_user", "user_id"),
        {"extend_existing": True})

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    task = relationship(
        "Task",
        back_populates="watchers",
        lazy="selectin")

    user = relationship(
        "User",
        back_populates="task_watchers",
        lazy="selectin")

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<TaskWatcher id={self.id} task_id={self.task_id} user_id={self.user_id}>"


class TaskParticipant(Base, TimestampMixin):
    """Participants and their roles on a task"""
    __tablename__ = "task_participants"

    __table_args__ = (
        UniqueConstraint("task_id", "user_id", "role", name="uq_task_participants_task_user_role"),
        Index("ix_task_participants_task", "task_id"),
        Index("ix_task_participants_user", "user_id"),
        Index("ix_task_participants_role", "role"),
        {"extend_existing": True},
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    role = Column(
        SQLEnum(
            TaskParticipantRole,
            name="taskparticipantrole",
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
    )

    task = relationship(
        "Task",
        back_populates="participants",
        lazy="selectin",
        overlaps="participants,task",
    )

    user = relationship(
        "User",
        lazy="selectin",
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<TaskParticipant id={self.id} task_id={self.task_id} user_id={self.user_id} role={self.role.value!r}>"


class TaskApproval(Base, TimestampMixin):
    """Task approval record"""
    __tablename__ = "task_approvals"

    __table_args__ = (
        Index("ix_task_approvals_task", "task_id"),
        Index("ix_task_approvals_status", "status"),
        {"extend_existing": True},
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    status = Column(
        SQLEnum(
            TaskApprovalStatus,
            name="taskapprovalstatus",
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=TaskApprovalStatus.PENDING,
        nullable=False,
    )

    requested_by_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    decided_by_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    decided_at = Column(
        DateTime(timezone=True),
        nullable=True)

    comment = Column(
        Text,
        nullable=True)

    task = relationship(
        "Task",
        back_populates="approvals",
        lazy="selectin",
        overlaps="approvals,task",
    )

    requested_by = relationship(
        "User",
        foreign_keys=[requested_by_id],
        lazy="selectin",
        overlaps="task_approvals,requested_by",
    )

    decided_by = relationship(
        "User",
        foreign_keys=[decided_by_id],
        lazy="selectin",
        overlaps="task_approvals,decided_by",
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<TaskApproval id={self.id} task_id={self.task_id} status={self.status.value!r}>"
class TaskAttachment(Base, TimestampMixin, SoftDeleteMixin):
    """File attachments for tasks"""
    __tablename__ = "task_attachments"

    __table_args__ = (
        Index("ix_attachment_task", "task_id"),
        {"extend_existing": True})

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    uploaded_by_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True)

    filename = Column(
        String(255),
        nullable=False)

    original_filename = Column(
        String(255),
        nullable=False)

    file_path = Column(
        String(500),
        nullable=False)

    file_url = Column(
        String(500),
        nullable=True)

    content_type = Column(
        String(100),
        nullable=True)

    file_size = Column(
        Integer,
        nullable=True)

    description = Column(
        Text,
        nullable=True)

    is_public = Column(
        Boolean,
        default=False,
        nullable=False)

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {})

    # Relationships
    task = relationship(
        "Task",
        lazy="selectin",
        back_populates="attachments",
        overlaps="attachments,task")

    uploaded_by = relationship(
        "User",
        lazy="selectin")

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<TaskAttachment id={self.id} filename={self.filename!r} task_id={self.task_id}>"


class TaskTimeLog(Base, TimestampMixin, SoftDeleteMixin):
    """Time tracking for tasks"""
    __tablename__ = "task_time_logs"

    __table_args__ = (
        Index("ix_time_log_task_user", "task_id", "user_id"),
        Index("ix_time_log_date", "log_date"),
        {"extend_existing": True})

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True)

    log_date = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now())

    hours_spent = Column(
        Float,
        nullable=False)

    description = Column(
        Text,
        nullable=True)

    is_billable = Column(
        Boolean,
        default=True,
        nullable=False)

    hourly_rate = Column(
        Float,
        nullable=True)

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {})

    # Relationships
    task = relationship(
        "Task",
        lazy="selectin",
        back_populates="time_logs",
        overlaps="time_logs,task")

    user = relationship(
        "User",
        lazy="selectin")

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<TaskTimeLog id={self.id} task_id={self.task_id} hours={self.hours_spent}>"


class TaskLabel(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    """Labels/tags for tasks"""
    __tablename__ = "task_labels"

    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_task_label_org_name"),
        {"extend_existing": True})

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    name = Column(
        String(100),
        nullable=False,
        index=True)

    description = Column(
        Text,
        nullable=True)

    color = Column(
        String(7),  # Hex color code
        nullable=True)

    is_active = Column(
        Boolean,
        default=True,
        nullable=False)

    # Relationships
    organization = relationship(
        "Organization",
        lazy="selectin")

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<TaskLabel id={self.id} name={self.name!r} color={self.color}>"


class TaskDependency(Base, TimestampMixin):
    """Task dependencies (blocking relationships)"""
    __tablename__ = "task_dependencies"

    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_task_id", name="uq_task_dependency"),
        Index("ix_task_dep_task", "task_id"),
        Index("ix_task_dep_depends_on", "depends_on_task_id"),
        {"extend_existing": True})

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False)

    task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False)

    depends_on_task_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False)

    dependency_type = Column(
        String(50),
        default="blocks",
        nullable=False)

    # Relationships
    task = relationship(
        "Task",
        foreign_keys=[task_id],
        lazy="selectin")

    depends_on_task = relationship(
        "Task",
        foreign_keys=[depends_on_task_id],
        lazy="selectin")

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<TaskDependency task_id={self.task_id} depends_on={self.depends_on_task_id}>"
