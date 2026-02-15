from __future__ import annotations

"""
Compatibility layer for legacy routes.

Do NOT duplicate auth logic here. Re-export canonical helpers from
`liderix_api.services.auth` to keep token validation consistent
across the codebase.
"""

from liderix_api.services.auth import (  # noqa: F401
    oauth2_scheme,
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    require_admin,
)

__all__ = [
    "oauth2_scheme",
    "hash_password",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "get_current_user",
    "require_admin",
]
