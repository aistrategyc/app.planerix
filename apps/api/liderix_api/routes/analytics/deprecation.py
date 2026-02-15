from __future__ import annotations

from fastapi import Response


LEGACY_WIDGETS_URL = "/api/analytics/widgets"


def mark_legacy_deprecated(response: Response) -> None:
    response.headers["X-Deprecated"] = "true"
    response.headers["X-Deprecated-By"] = LEGACY_WIDGETS_URL
    response.headers["X-Deprecated-Message"] = "Use /api/analytics/widgets or /api/analytics/widgets/batch"
