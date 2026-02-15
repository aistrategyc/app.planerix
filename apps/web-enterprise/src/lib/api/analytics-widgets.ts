import { api } from "./config"

export interface WidgetFilters {
  start_date?: string
  end_date?: string
  // Deprecated: kept for legacy callers; normalized before requests.
  date_from?: string
  // Deprecated: kept for legacy callers; normalized before requests.
  date_to?: string
  product?: string
  branch?: string
  source?: string
  platform?: string
  channel?: string
  status?: string
  objective?: string
  device?: string
  conversion_type?: string
  campaign_id?: string
  adset_id?: string
  ad_group_id?: string
  id_city?: number | string
  city_id?: number | string
  entity_id?: string
  limit?: number
  offset?: number
  order_by?: string
}

export type WidgetRow = Record<string, unknown>

export interface WidgetResponse {
  widget_key: string
  items: WidgetRow[]
  missing_view?: boolean
  missing_columns?: string[]
  has_more?: boolean
}

export interface BatchWidgetRequest {
  widget_key: string
  alias?: string
  filters?: WidgetFilters
  limit?: number
  offset?: number
  order_by?: string
}

export interface BatchWidgetsPayload {
  widgets: BatchWidgetRequest[]
  global_filters?: WidgetFilters
}

export interface BatchWidgetResponse extends WidgetResponse {
  alias?: string
  meta?: Record<string, unknown>
  applied_filters?: Record<string, unknown>
  ignored_filters?: Record<string, unknown>
  error?: string
}

export interface BatchWidgetsResponse {
  items: Record<string, BatchWidgetResponse>
}

export interface WidgetRangeResponse {
  widget_key: string
  min_date: string | null
  max_date: string | null
}

export interface InsightRow {
  id: string
  widget_key: string
  severity: string | null
  title: string | null
  summary: string | null
  metrics_json: Record<string, unknown> | null
  evidence_ref: Record<string, unknown> | null
  confidence: number | null
  valid_from: string | null
  valid_to: string | null
  tags: string[] | null
  created_at: string | null
}

export interface InsightsResponse {
  widget_key: string
  items: InsightRow[]
}

export const fetchWidget = async (
  widgetKey: string,
  filters: WidgetFilters
): Promise<WidgetResponse> => {
  const normalizedFilters = normalizeWidgetFilters(filters, widgetKey)
  const response = await api.get<WidgetResponse>(`/analytics/widgets/${widgetKey}`, {
    params: normalizedFilters,
  })
  return response.data
}

export const fetchWidgetsBatch = async (
  payload: BatchWidgetsPayload
): Promise<BatchWidgetsResponse> => {
  const normalizedWidgets = payload.widgets.map((widget) => ({
    ...widget,
    filters: normalizeWidgetFilters(widget.filters ?? {}, widget.widget_key),
  }))
  const normalizedPayload: BatchWidgetsPayload = {
    widgets: normalizedWidgets,
    global_filters: payload.global_filters
      ? normalizeWidgetFilters(payload.global_filters)
      : undefined,
  }
  const response = await api.post<BatchWidgetsResponse>("/analytics/widgets/batch", normalizedPayload)
  return response.data
}

type InsightsQuery = {
  limit?: number
  agentKey?: string
  date_from?: string
  date_to?: string
  id_city?: number | string
  severity?: string
  tenant?: string
}

export const fetchInsights = async (
  widgetKey: string | null,
  limitOrOptions: number | InsightsQuery = 20,
  agentKey?: string
): Promise<InsightsResponse> => {
  const options: InsightsQuery =
    typeof limitOrOptions === "number"
      ? { limit: limitOrOptions, agentKey }
      : limitOrOptions

  const params: Record<string, unknown> = {
    widget_key: widgetKey ?? undefined,
    agent_key: options.agentKey,
    limit: options.limit ?? 20,
    date_from: options.date_from,
    date_to: options.date_to,
    id_city: options.id_city,
    severity: options.severity,
    tenant: options.tenant,
  }

  if (params.id_city === "all") {
    delete params.id_city
  }

  const response = await api.get<InsightsResponse>("/analytics/insights", { params })
  return response.data
}

export const fetchWidgetRange = async (widgetKey: string): Promise<WidgetRangeResponse> => {
  const response = await api.get<WidgetRangeResponse>(`/analytics/widgets/${widgetKey}/range`)
  return response.data
}

export interface AgentSummary {
  agent_key: string
  last_as_of_date: string | null
  runs: number
  critical_cnt: number
  warning_cnt: number
  info_cnt: number
}

export const fetchAgentRegistry = async (): Promise<AgentSummary[]> => {
  const response = await api.get<{ items: AgentSummary[] }>("/analytics/agents")
  return response.data.items
}

type WidgetFilterKey = keyof WidgetFilters

const BASE_FILTERS: WidgetFilterKey[] = ["start_date", "end_date", "limit", "offset", "order_by"]
const CITY_FILTERS: WidgetFilterKey[] = [...BASE_FILTERS, "id_city", "entity_id"]
const GA4_FILTERS: WidgetFilterKey[] = [...BASE_FILTERS]
const CITY_PLATFORM_FILTERS: WidgetFilterKey[] = [
  ...BASE_FILTERS,
  "id_city",
  "platform",
  "entity_id",
  "conversion_type",
  "campaign_id",
  "adset_id",
  "ad_group_id",
]
const CITY_CHANNEL_FILTERS: WidgetFilterKey[] = [
  ...BASE_FILTERS,
  "id_city",
  "channel",
  "entity_id",
  "conversion_type",
  "campaign_id",
  "adset_id",
  "ad_group_id",
]
const CRM_FILTERS: WidgetFilterKey[] = [
  ...BASE_FILTERS,
  "id_city",
  "platform",
  "source",
  "product",
  "branch",
  "entity_id",
  "conversion_type",
  "campaign_id",
  "adset_id",
  "ad_group_id",
]

const WIDGETS_USE_CHANNEL = new Set<string>([
  "ads.channel_mix_daily",
  "campaigns.table",
  "campaigns.top_metrics",
  "sources.revenue_split",
  "contracts.daily_city",
  "contracts.attribution_daily_city",
  "contracts.attributed",
  "contracts.attributed_detail_v2",
  "contracts.top_campaigns",
  "contracts.meta_by_ad_daily",
  "contracts.gads_by_campaign_daily",
  "contracts.kpi_decomposition",
])

const WIDGET_FILTER_OVERRIDES: Record<string, WidgetFilterKey[]> = {
  "ads.ads_daily": CITY_PLATFORM_FILTERS,
  "ads.ads_ad_profile_daily": CITY_PLATFORM_FILTERS,
  "ads.ads_campaigns_daily": CITY_PLATFORM_FILTERS,
  "ads.ads_anomalies_7d": ["id_city", "platform", "limit", "offset", "order_by"],
  "ads.kpi_total": CITY_PLATFORM_FILTERS,
  "ads.creative_type_summary": CITY_PLATFORM_FILTERS,
  "ads.meta_creatives_daily": CITY_PLATFORM_FILTERS,
  "ads.meta_ads_top_daily": CITY_PLATFORM_FILTERS,
  "ads.meta_creative_fatigue_7d": CITY_PLATFORM_FILTERS,
  "ads.gads_keywords_daily": CITY_PLATFORM_FILTERS,
  "ads.gads_device_hour_daily": CITY_PLATFORM_FILTERS,
  "ads.gads_conversion_actions_daily": CITY_PLATFORM_FILTERS,
  "ads.gads_pmax_daily": CITY_PLATFORM_FILTERS,
  "ads.gads.trend": CITY_PLATFORM_FILTERS,
  "ads.meta_campaigns_by_product": CITY_PLATFORM_FILTERS,
  "ads.creatives_detailed": CITY_PLATFORM_FILTERS,
  "ads.channel_mix_daily": CITY_CHANNEL_FILTERS,
  "campaigns.table": CITY_CHANNEL_FILTERS,
  "campaigns.inventory_daily_city": CITY_PLATFORM_FILTERS,
  "campaigns.top_metrics": CITY_CHANNEL_FILTERS,
  "sources.revenue_split": CITY_CHANNEL_FILTERS,
  "marketing.offline_sources_active": CITY_FILTERS,
  "sources.offline_breakdown_daily_city": CITY_FILTERS,
  "contracts.daily_city": CITY_CHANNEL_FILTERS,
  "contracts.attribution_daily_city": CITY_CHANNEL_FILTERS,
  "contracts.attribution_daily_city_display_current": CITY_CHANNEL_FILTERS,
  "contracts.attributed": CITY_CHANNEL_FILTERS,
  "contracts.attributed_detail_v2": CITY_CHANNEL_FILTERS,
  "contracts.top_campaigns": CITY_CHANNEL_FILTERS,
  "contracts.meta_by_ad_daily": CITY_CHANNEL_FILTERS,
  "contracts.gads_by_campaign_daily": CITY_CHANNEL_FILTERS,
  "contracts.kpi_decomposition": CITY_CHANNEL_FILTERS,
  "contracts.leads_journey": CRM_FILTERS,
  "contracts.lead_creative_interactions": CRM_FILTERS,
  "crm.kpi_cards": CITY_FILTERS,
  "crm.funnel": CITY_FILTERS,
  "crm.leads_table": CRM_FILTERS,
  "crm.lead_profile": [...CRM_FILTERS, "entity_id"],
  "crm.sources_performance_daily": CRM_FILTERS,
  "crm.form_unit_economics_daily": CRM_FILTERS,
  "crm.form_unit_economics_daily_v2": CRM_FILTERS,
  "creatives.type_cards": CITY_PLATFORM_FILTERS,
  "creatives.table": CITY_PLATFORM_FILTERS,
}

const normalizeChannelValue = (value?: string | null) => {
  if (!value) return value
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (key === "meta") return "paid_meta"
  if (key === "gads" || key === "googleads") return "paid_gads"
  if (key === "offline") return "offline"
  return value
}

const resolveFilterAllowlist = (widgetKey?: string): WidgetFilterKey[] => {
  if (!widgetKey) return CITY_PLATFORM_FILTERS
  if (widgetKey && WIDGET_FILTER_OVERRIDES[widgetKey]) return WIDGET_FILTER_OVERRIDES[widgetKey]
  if (widgetKey.startsWith("ads.")) {
    return widgetKey === "ads.channel_mix_daily" ? CITY_CHANNEL_FILTERS : CITY_PLATFORM_FILTERS
  }
  if (widgetKey.startsWith("crm.")) {
    if (widgetKey === "crm.lead_profile") return [...CRM_FILTERS, "entity_id"]
    return CRM_FILTERS
  }
  if (widgetKey.startsWith("contracts.")) return CITY_CHANNEL_FILTERS
  if (widgetKey.startsWith("campaigns.") || widgetKey.startsWith("sources.")) return CITY_CHANNEL_FILTERS
  if (widgetKey.startsWith("creatives.")) return CITY_PLATFORM_FILTERS
  if (widgetKey.startsWith("ga4.")) return GA4_FILTERS
  return CITY_PLATFORM_FILTERS
}

export const normalizeWidgetFilters = (filters: WidgetFilters, widgetKey?: string): WidgetFilters => {
  const normalized: WidgetFilters = { ...filters }
  if (normalized.id_city == null && normalized.city_id != null) {
    normalized.id_city = normalized.city_id
  }
  delete normalized.city_id
  if (normalized.platform == null && normalized.channel != null) {
    normalized.platform = normalized.channel
  }
  const start = normalized.start_date ?? normalized.date_from
  const end = normalized.end_date ?? normalized.date_to
  if (start && end && start > end) {
    normalized.start_date = end
    normalized.end_date = start
  } else {
    if (start) normalized.start_date = start
    if (end) normalized.end_date = end
  }
  delete normalized.date_from
  delete normalized.date_to

  const allowlist = resolveFilterAllowlist(widgetKey)
  if (widgetKey && WIDGETS_USE_CHANNEL.has(widgetKey)) {
    if (normalized.channel) {
      normalized.channel = normalizeChannelValue(normalized.channel)
    } else if (normalized.platform) {
      normalized.channel = normalizeChannelValue(normalized.platform)
    }
    delete normalized.platform
  } else {
    delete normalized.channel
  }

  const cleaned: WidgetFilters = {}
  allowlist.forEach((key) => {
    const value = normalized[key]
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "all"
    ) {
      return
    }
    cleaned[key] = value
  })

  return cleaned
}
