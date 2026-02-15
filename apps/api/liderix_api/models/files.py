"""
File and upload management models
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List

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
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from liderix_api.db import Base
from liderix_api.enums import FileType, UploadStatus
from .mixins import TimestampMixin, SoftDeleteMixin, OrgFKMixin


class File(Base, OrgFKMixin, TimestampMixin, SoftDeleteMixin):
    """File storage and management"""
    __tablename__ = "files"

    __table_args__ = (
        Index("ix_file_uploader", "uploaded_by_id"),
        Index("ix_file_type", "file_type"),
        Index("ix_file_status", "upload_status"),
        Index("ix_file_created", "created_at"),
        CheckConstraint("file_size >= 0", name="chk_file_size_positive"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    # File identification
    filename = Column(
        String(255),
        nullable=False,
        index=True
    )

    original_filename = Column(
        String(255),
        nullable=False
    )

    file_path = Column(
        String(1000),
        nullable=False,
        comment="Full path to file on storage"
    )

    file_url = Column(
        String(1000),
        nullable=True,
        comment="Public URL for file access"
    )

    # File properties
    file_type = Column(
        SQLEnum(FileType),
        nullable=False
    )

    mime_type = Column(
        String(100),
        nullable=True
    )

    file_size = Column(
        Integer,
        nullable=False,
        comment="File size in bytes"
    )

    file_hash = Column(
        String(64),
        nullable=True,
        index=True,
        comment="SHA-256 hash for deduplication"
    )

    # Upload information
    upload_status = Column(
        SQLEnum(UploadStatus),
        default=UploadStatus.PENDING,
        nullable=False
    )

    uploaded_by_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    upload_completed_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # Access control
    is_public = Column(
        Boolean,
        default=False,
        nullable=False
    )

    is_temporary = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Temporary files are cleaned up automatically"
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When temporary file expires"
    )

    # Storage information
    storage_provider = Column(
        String(50),
        default="local",
        nullable=False,
        comment="local, s3, gcs, azure, etc."
    )

    storage_bucket = Column(
        String(100),
        nullable=True,
        comment="Storage bucket/container name"
    )

    storage_region = Column(
        String(50),
        nullable=True,
        comment="Storage region"
    )

    # Metadata and tags
    description = Column(
        Text,
        nullable=True
    )

    tags = Column(
        JSONB,
        nullable=True,
        default=lambda: [],
        comment="File tags for organization"
    )

    alt_text = Column(
        String(500),
        nullable=True,
        comment="Alternative text for images"
    )

    # Technical metadata
    image_width = Column(
        Integer,
        nullable=True,
        comment="Image width in pixels"
    )

    image_height = Column(
        Integer,
        nullable=True,
        comment="Image height in pixels"
    )

    duration_seconds = Column(
        Float,
        nullable=True,
        comment="Video/audio duration"
    )

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {},
        comment="Additional file metadata"
    )

    # Relationships
    organization = relationship(
        "Organization",
        lazy="selectin"
    )

    uploaded_by = relationship(
        "User",
        lazy="selectin"
    )

    # File access logs
    access_logs = relationship(
        "FileAccessLog",
        back_populates="file",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<File id={self.id} filename={self.filename!r} type={self.file_type.value}>"

    @property
    def size_mb(self) -> float:
        """File size in megabytes"""
        return round(self.file_size / 1024 / 1024, 2) if self.file_size else 0

    @property
    def is_image(self) -> bool:
        """Check if file is an image"""
        return self.file_type == FileType.IMAGE

    @property
    def is_expired(self) -> bool:
        """Check if temporary file is expired"""
        if not self.is_temporary or not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at


class FileAccessLog(Base, TimestampMixin):
    """Log file access for analytics and security"""
    __tablename__ = "file_access_logs"

    __table_args__ = (
        Index("ix_file_access_file", "file_id"),
        Index("ix_file_access_user", "user_id"),
        Index("ix_file_access_date", "accessed_at"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    file_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    accessed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    # Access details
    access_type = Column(
        String(20),
        nullable=False,
        default="download",
        comment="download, view, thumbnail, etc."
    )

    ip_address = Column(
        String(45),
        nullable=True,
        comment="IPv4 or IPv6 address"
    )

    user_agent = Column(
        String(500),
        nullable=True
    )

    referer = Column(
        String(1000),
        nullable=True
    )

    response_code = Column(
        Integer,
        nullable=True,
        comment="HTTP response code"
    )

    bytes_served = Column(
        Integer,
        nullable=True,
        comment="Number of bytes served"
    )

    # Relationships
    file = relationship(
        "File",
        back_populates="access_logs",
        lazy="selectin"
    )

    user = relationship(
        "User",
        lazy="selectin"
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<FileAccessLog file_id={self.file_id} user_id={self.user_id} type={self.access_type}>"


class FileShare(Base, TimestampMixin, SoftDeleteMixin):
    """File sharing and permissions"""
    __tablename__ = "file_shares"

    __table_args__ = (
        Index("ix_file_share_file", "file_id"),
        Index("ix_file_share_user", "shared_with_user_id"),
        Index("ix_file_share_token", "share_token"),
        CheckConstraint("expires_at > created_at", name="chk_share_expiry_valid"),
        {"extend_existing": True}
    )

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )

    file_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False
    )

    shared_by_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    # Share target (either user or public)
    shared_with_user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        comment="Specific user share (null for public shares)"
    )

    shared_with_email = Column(
        String(255),
        nullable=True,
        comment="Email for external shares"
    )

    # Share configuration
    share_token = Column(
        String(64),
        nullable=True,
        unique=True,
        index=True,
        comment="Unique token for public access"
    )

    permission_level = Column(
        String(20),
        default="view",
        nullable=False,
        comment="view, download, edit"
    )

    password = Column(
        String(255),
        nullable=True,
        comment="Optional password for access"
    )

    # Expiration and limits
    expires_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    max_downloads = Column(
        Integer,
        nullable=True,
        comment="Maximum number of downloads allowed"
    )

    download_count = Column(
        Integer,
        default=0,
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    # Metadata
    share_message = Column(
        Text,
        nullable=True,
        comment="Message from sharer"
    )

    meta_data = Column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )

    # Relationships
    file = relationship(
        "File",
        lazy="selectin"
    )

    shared_by = relationship(
        "User",
        foreign_keys=[shared_by_id],
        lazy="selectin"
    )

    shared_with_user = relationship(
        "User",
        foreign_keys=[shared_with_user_id],
        lazy="selectin"
    )

    __mapper_args__ = {"eager_defaults": True}

    def __repr__(self) -> str:
        return f"<FileShare file_id={self.file_id} shared_by={self.shared_by_id} token={self.share_token}>"

    @property
    def is_expired(self) -> bool:
        """Check if share is expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_download_limit_reached(self) -> bool:
        """Check if download limit is reached"""
        if not self.max_downloads:
            return False
        return self.download_count >= self.max_downloads

    def can_access(self) -> bool:
        """Check if share can be accessed"""
        return (
            self.is_active and
            not self.is_expired and
            not self.is_download_limit_reached
        )