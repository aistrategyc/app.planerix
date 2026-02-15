from fastapi import APIRouter
from . import widgets, data_quality, filters, attribution

router = APIRouter()

# Filters (cities, etc.)
router.include_router(filters.router, prefix="/filters", tags=["Analytics Filters"])

# Widget-based analytics (SEM + AI)
router.include_router(widgets.router, tags=["Analytics Widgets"])

# Attribution (widgets + unified filters)
router.include_router(attribution.router, tags=["Attribution"])

# Data quality/freshness (itstep_final)
router.include_router(data_quality.router, prefix="/data-quality", tags=["Data Quality"])
