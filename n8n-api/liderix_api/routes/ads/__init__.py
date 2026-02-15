"""
Ads Analytics API Routes (v6)
Data source: dashboards.v6_fb_ads_performance, dashboards.v6_google_ads_performance
"""
from fastapi import APIRouter
from . import overview, campaigns, creatives

router = APIRouter(prefix="/ads", tags=["ads"])

# Register sub-routers
router.include_router(overview.router)
router.include_router(campaigns.router)
router.include_router(creatives.router)
