from __future__ import annotations

from urllib.parse import urlparse
import base64
import hashlib
import json
import os
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response

from liderix_api.models.users import User
from liderix_api.services.auth import get_current_user
from liderix_api.config.settings import settings

router = APIRouter(prefix="/media", tags=["Media"])

_ALLOWED_SUFFIXES = (
    ".fbcdn.net",
    ".facebook.com",
    ".instagram.com",
    ".cdninstagram.com",
)

_MAX_BYTES = 5 * 1024 * 1024  # 5MB
_CACHE_DIRNAME = "preview-cache"

_TRANSPARENT_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
)


def _is_allowed_host(host: str) -> bool:
    host = host.strip().lower()
    if not host:
        return False
    return any(host == suffix.lstrip(".") or host.endswith(suffix) for suffix in _ALLOWED_SUFFIXES)


def _placeholder() -> Response:
    return Response(
        content=_TRANSPARENT_PNG,
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )


def _cache_root() -> Path:
    root = Path(settings.UPLOADS_DIR).resolve() / _CACHE_DIRNAME
    root.mkdir(parents=True, exist_ok=True)
    return root


def _hash_url(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def _content_type_to_ext(content_type: str) -> str:
    ct = content_type.split(";")[0].strip().lower()
    if ct == "image/jpeg":
        return ".jpg"
    if ct == "image/png":
        return ".png"
    if ct == "image/webp":
        return ".webp"
    if ct == "image/gif":
        return ".gif"
    if ct == "image/avif":
        return ".avif"
    return ".img"


def _cache_paths(cache_key: str, ext: str | None = None) -> tuple[Path, Path]:
    root = _cache_root()
    subdir = root / cache_key[:2]
    subdir.mkdir(parents=True, exist_ok=True)
    filename = cache_key if ext is None else f"{cache_key}{ext}"
    return subdir / filename, subdir / f"{cache_key}.json"


def _read_cache(cache_key: str) -> tuple[Path | None, str | None]:
    root = _cache_root()
    subdir = root / cache_key[:2]
    if not subdir.exists():
        return None, None
    meta_path = subdir / f"{cache_key}.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
            content_type = meta.get("content_type")
            filename = meta.get("filename")
            if filename:
                cached_path = subdir / filename
                if cached_path.exists():
                    return cached_path, content_type
        except (OSError, json.JSONDecodeError, TypeError):
            pass
    for candidate in subdir.glob(f"{cache_key}.*"):
        if candidate.name.endswith(".json"):
            continue
        return candidate, None
    return None, None


def _write_cache(cache_key: str, content: bytes, content_type: str, url: str) -> Path:
    ext = _content_type_to_ext(content_type)
    cached_path, meta_path = _cache_paths(cache_key, ext)
    tmp_path = cached_path.with_suffix(cached_path.suffix + ".tmp")
    tmp_path.write_bytes(content)
    os.replace(tmp_path, cached_path)
    meta = {
        "content_type": content_type,
        "filename": cached_path.name,
        "url": url,
    }
    meta_path.write_text(json.dumps(meta))
    return cached_path


@router.get("/preview")
async def preview_image(
    url: str = Query(..., description="Absolute image URL"),
    current_user: User = Depends(get_current_user),
):
    if not url or not url.strip():
        return _placeholder()
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Invalid URL scheme")
    host = parsed.hostname or ""
    if not _is_allowed_host(host):
        raise HTTPException(status_code=403, detail="Host not allowed")

    cache_key = _hash_url(url)
    cached_path, cached_content_type = _read_cache(cache_key)
    if cached_path:
        return FileResponse(
            path=str(cached_path),
            media_type=cached_content_type,
            headers={"Cache-Control": "public, max-age=86400"},
        )

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
    except httpx.HTTPError:
        return _placeholder()

    if resp.status_code >= 400:
        return _placeholder()

    content = resp.content or b""
    if not content:
        return _placeholder()

    if len(content) > _MAX_BYTES:
        return _placeholder()

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    if not content_type.startswith("image/"):
        return _placeholder()

    try:
        cached_path = _write_cache(cache_key, content, content_type, url)
        return FileResponse(
            path=str(cached_path),
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except OSError:
        return Response(
            content=content,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=3600"},
        )
