# apps/api/liderix_api/services/file_upload.py
"""
File upload service for handling user avatars and other files.
Stores files on local disk and returns a public path under /uploads.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse
from typing import Optional
from fastapi import UploadFile
from uuid import UUID

from liderix_api.config.settings import settings

UPLOADS_DIR = Path(settings.UPLOADS_DIR).resolve()
UPLOADS_URL_PREFIX = "/uploads"

CONTENT_TYPE_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _safe_extension(filename: str, content_type: Optional[str], default_ext: str) -> str:
    if content_type and content_type in CONTENT_TYPE_EXT:
        return CONTENT_TYPE_EXT[content_type]
    ext = os.path.splitext(filename or "")[1]
    return ext if ext else default_ext


def _public_path(relative_path: str) -> str:
    if relative_path.startswith("/"):
        return relative_path
    return f"/{relative_path}"


def _resolve_local_path(file_url: str) -> Optional[Path]:
    parsed = urlparse(file_url)
    path = parsed.path if parsed.scheme else file_url
    if not path.startswith(UPLOADS_URL_PREFIX):
        return None
    relative = path[len(UPLOADS_URL_PREFIX):].lstrip("/")
    return UPLOADS_DIR / relative


def _write_upload(src, dest: Path) -> None:
    src.seek(0)
    with dest.open("wb") as out:
        while True:
            chunk = src.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    src.seek(0)


async def handle_avatar_upload(file: UploadFile, user_id: UUID) -> str:
    """
    Handle avatar file upload.
    
    Args:
        file: Uploaded file
        user_id: ID of user uploading the avatar
        
    Returns:
        URL of uploaded avatar
    """
    avatar_dir = UPLOADS_DIR / "avatars"
    _ensure_dir(avatar_dir)

    file_extension = _safe_extension(file.filename or "", file.content_type, ".jpg")
    filename = f"avatar_{user_id}_{uuid.uuid4()}{file_extension}"
    dest = avatar_dir / filename

    await asyncio.to_thread(_write_upload, file.file, dest)

    return _public_path(f"{UPLOADS_URL_PREFIX}/avatars/{filename}")


async def delete_file(file_url: str) -> bool:
    """
    Delete file from storage.
    
    Args:
        file_url: URL of file to delete
        
    Returns:
        True if successful, False otherwise
    """
    local_path = _resolve_local_path(file_url)
    if not local_path:
        return False
    try:
        if local_path.exists():
            local_path.unlink()
        return True
    except OSError:
        return False


async def upload_file(
    file: UploadFile, 
    folder: str, 
    user_id: Optional[UUID] = None
) -> str:
    """
    Upload file to storage.
    
    Args:
        file: Uploaded file
        folder: Folder to upload to
        user_id: Optional user ID for organizing files
        
    Returns:
        URL of uploaded file
    """
    uploads_dir = UPLOADS_DIR / folder
    _ensure_dir(uploads_dir)
    file_extension = _safe_extension(file.filename or "", file.content_type, ".bin")
    filename = f"{folder}_{uuid.uuid4()}{file_extension}"
    dest = uploads_dir / filename

    await asyncio.to_thread(_write_upload, file.file, dest)

    return _public_path(f"{UPLOADS_URL_PREFIX}/{folder}/{filename}")
