"""
Data Analytics routes for ITstep client
Includes v5 (basic + advanced) and v6 (recommendations, sales, contracts) endpoints
Updated: October 19, 2025
"""
from fastapi import APIRouter, Depends

# Import all subroutes (v5 basic endpoints)
from . import kpi, trends, campaigns, utm_sources, share

# Import v5 advanced endpoints
from . import scatter_matrix, anomalies, paid_split, campaign_insights

# Import v4 compare endpoints (already exist from previous sessions)
from . import trends_compare, campaigns_compare, share_compare, top_movers, budget_recommendations

# Import v6 sales and contracts endpoints (Oct 14, 2025)
from . import sales_v6, contracts_v6

# Import contracts attribution endpoints (Oct 19, 2025) - detailed contract source analysis
from . import contracts_attribution
from liderix_api.routes.analytics.deprecation import mark_legacy_deprecated

router = APIRouter(deprecated=True, dependencies=[Depends(mark_legacy_deprecated)])

# Include v5 basic data analytics subroutes
router.include_router(kpi.router, prefix="/v5", tags=["Data Analytics v5 - KPI"])
router.include_router(trends.router, prefix="/v5/trend", tags=["Data Analytics v5 - Trends"])
router.include_router(campaigns.router, prefix="/v5/campaigns", tags=["Data Analytics v5 - Campaigns"])
router.include_router(utm_sources.router, prefix="/v5", tags=["Data Analytics v5 - UTM Sources"])
router.include_router(share.router, prefix="/v5/share", tags=["Data Analytics v5 - Share"])

# Include v5 advanced endpoints (Oct 6-7, 2025)
router.include_router(scatter_matrix.router, prefix="/v5/campaigns", tags=["Data Analytics v5 - Advanced"])
router.include_router(anomalies.router, prefix="/v5/campaigns", tags=["Data Analytics v5 - Advanced"])
router.include_router(campaign_insights.router, prefix="/v5", tags=["Data Analytics v5 - Campaign Insights"])

# Include v4 compare endpoints (already exist from previous sessions)
router.include_router(trends_compare.router, prefix="/v5", tags=["Data Analytics v5 - Compare"])
router.include_router(campaigns_compare.router, prefix="/v5/campaigns", tags=["Data Analytics v5 - Compare"])
router.include_router(share_compare.router, prefix="/v5/share", tags=["Data Analytics v5 - Compare"])
router.include_router(top_movers.router, prefix="/v5/campaigns", tags=["Data Analytics v5 - Top Movers"])

# Include v6 recommendations and paid split
router.include_router(budget_recommendations.router, prefix="/v6", tags=["Data Analytics v6 - Recommendations"])
router.include_router(paid_split.router, prefix="/v6/leads/paid-split", tags=["Data Analytics v6 - Paid Split"])

# Include v6 sales endpoints (Oct 14, 2025)
router.include_router(sales_v6.router, prefix="/sales/v6", tags=["Data Analytics v6 - Sales"])

# Include v6 contracts endpoints (Oct 14, 2025) - FIXED PREFIX Oct 23, 2025
router.include_router(contracts_v6.router, prefix="/v6/contracts", tags=["Data Analytics v6 - Contracts"])

# Include contracts attribution endpoints (Oct 19, 2025) - detailed contract source analysis
router.include_router(contracts_attribution.router, prefix="/v8/contracts", tags=["Data Analytics v8 - Contracts Attribution"])
