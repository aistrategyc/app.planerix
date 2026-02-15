import os

from fastapi.testclient import TestClient


def _ensure_test_env() -> None:
    # Prevent startup DB warmup in `liderix_api.main`.
    os.environ.setdefault("LIDERIX_TESTING", "1")
    # Must be present for settings validation and SQLAlchemy engine creation (no connection happens in tests).
    os.environ.setdefault("LIDERIX_DB_URL", "postgresql+asyncpg://user:pass@localhost:5432/liderix_test")
    os.environ.setdefault("API_PREFIX", "/api")
    os.environ.setdefault("ENABLE_LEGACY_ANALYTICS_ROUTES", "1")


def test_openapi_includes_wired_routes() -> None:
    _ensure_test_env()

    from liderix_api.main import app

    with TestClient(app) as client:
        spec = client.get("/api/openapi.json").json()
        paths = set(spec.get("paths", {}).keys())

    # Newly wired top-level routers
    assert "/api/ads/overview" in paths
    assert "/api/ads-manager" in paths
    assert "/api/marketing-campaigns" in paths
    assert "/api/data-analytics/v5/kpi" in paths

    # Newly wired legacy analytics subrouters
    assert "/api/analytics/campaigns/performance" in paths
    assert "/api/analytics/sales/revenue-trend" in paths
    assert "/api/analytics/ads/" in paths
