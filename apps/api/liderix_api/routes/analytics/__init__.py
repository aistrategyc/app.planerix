from fastapi import APIRouter
from . import (
    widgets,
    data_quality,
    filters,
    attribution,
    marketing_v6,
    overview,
    campaigns,
    sales,
    ads,
    creatives,
    contracts,
)

router = APIRouter()

# Filters (cities, etc.)
router.include_router(filters.router, prefix="/filters", tags=["Analytics Filters"])

# Widget-based analytics (SEM + AI)
router.include_router(widgets.router, tags=["Analytics Widgets"])

# Attribution (widgets + unified filters)
router.include_router(attribution.router, tags=["Attribution"])

# Data quality/freshness (itstep_final)
router.include_router(data_quality.router, prefix="/data-quality", tags=["Data Quality"])

# Marketing overview (legacy-compatible, sem_ui-backed)
router.include_router(marketing_v6.router, prefix="/marketing", tags=["Marketing"])

# Legacy/non-widget endpoints (still used by some clients; keep deprecated where marked)
router.include_router(overview.router, tags=["Legacy Analytics"])
router.include_router(campaigns.router, prefix="/campaigns", tags=["Legacy Campaigns"])
router.include_router(sales.router, prefix="/sales", tags=["Legacy Sales"])
router.include_router(ads.router, prefix="/ads", tags=["Legacy Ads"])
router.include_router(creatives.router, prefix="/creatives", tags=["Legacy Creatives"])
router.include_router(contracts.router, prefix="/contracts", tags=["Legacy Contracts"])
