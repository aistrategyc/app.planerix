"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import { fetchInsights, fetchWidgetsBatch, fetchWidgetRange, InsightRow, WidgetRow } from "@/lib/api/analytics-widgets"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { resolveDefaultCityId } from "@/app/analytics/utils/defaults"
import { useAuth } from "@/contexts/auth-context"
import { PageHeader } from "@/components/layout/PageHeader"
import { formatCurrency, formatNumber, formatPercent } from "@/app/analytics/utils/formatters"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"
import { camelizeUnknownRecordShallow, parseWidgetRowsSafe } from "@/lib/widgets/widgetParsing"
import { campaignsTopMetricsRowSchema, sourcesRevenueSplitRowSchema } from "@/lib/widgets/widgetSchemas"

const toDateInput = (value: Date) => value.toISOString().slice(0, 10)

const shiftDate = (value: string, days: number) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const formatRatio = (value: number | null | undefined) => (value == null ? "—" : value.toFixed(2))

const formatDuration = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—"
  const totalSeconds = Math.max(0, Math.round(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remMinutes = minutes % 60
    return `${hours}h ${remMinutes}m`
  }
  return `${minutes}m ${seconds}s`
}

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const pickNumber = (row: WidgetRow, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = toNumber(row[key])
    if (value != null && !Number.isNaN(value)) return value
  }
  return fallback
}

const pickText = (row: WidgetRow, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value)
    }
  }
  return fallback
}

const normalizeKey = (value?: string | null) =>
  value ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : ""

const normalizeSourceLabel = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return value
  const lower = trimmed.toLowerCase()
  const typeMatch = lower.match(/^(unknown\s+type|type):?\s*#?\s*(\d+)$/)
  if (typeMatch) {
    const code = Number(typeMatch[2])
    const mapped = CRM_SOURCE_TYPE_MAP.get(code)
    return mapped ?? `Unknown type #${typeMatch[2]}`
  }
  const map: Record<string, string> = {
    internet: "Internet (CRM)",
    "out-call": "Outbound call",
    call: "Inbound call",
    visit: "Visit",
    viber: "Viber",
    sms: "SMS",
    instagram: "Instagram",
    event: "Event",
    contract: "Contract",
  }
  return map[lower] ?? trimmed
}

const CRM_SOURCE_TYPE_MAP = new Map<number, string>([
  [1, "Inbound call"],
  [2, "Visit"],
  [3, "Internet (CRM)"],
  [5, "Event"],
  [6, "Contract"],
  [9, "Outbound call"],
  [17, "Viber"],
  [20, "SMS"],
  [21, "Helpcrunch"],
  [24, "Instagram"],
])

const looksLikeUserLabel = (value: string) => {
  const lower = value.trim().toLowerCase()
  return lower.startsWith("user:") || lower.startsWith("crm user") || /^user\s*#?\d+$/i.test(lower)
}

const pickSourceLabel = (row: WidgetRow) => {
  const candidates = [
    row.source_name,
    row.source_type_name,
    row.source_type,
    row.source_user_name,
  ]
  for (const candidate of candidates) {
    if (candidate == null) continue
    const value = String(candidate).trim()
    if (!value) continue
    if (looksLikeUserLabel(value)) continue
    return value
  }
  return "Unknown source"
}

const formatConfidence = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return null
  return `${Math.round(value * 100)}%`
}

const normalizeOwnerLabel = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return value
  const lower = trimmed.toLowerCase()
  const userMatch = lower.match(/^user:?\s*(\d+)$/)
  if (userMatch) return `CRM user #${userMatch[1]}`
  return trimmed
}

const getRangeDays = (from?: Date | null, to?: Date | null) => {
  if (!from || !to) return null
  const ms = to.getTime() - from.getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
}

const parseDateKey = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const toDateKey = (value: Date) => value.toISOString().slice(0, 10)

const startOfWeek = (value: Date) => {
  const date = new Date(value)
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

const formatShortDate = (value?: string | null) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
}

const formatDelta = (current: number | null, previous: number | null) => {
  if (current == null || previous == null || previous === 0) return null
  const delta = ((current - previous) / Math.abs(previous)) * 100
  if (!Number.isFinite(delta)) return null
  return delta
}

const renderDeltaBadge = (delta: number | null) => {
  if (delta == null) return null
  const rounded = Math.abs(delta) < 0.1 ? 0 : delta
  const variant = rounded > 0 ? "success" : rounded < 0 ? "destructive" : "outline"
  const sign = rounded > 0 ? "+" : ""
  return (
    <Badge variant={variant} className="text-[10px]">
      {sign}
      {rounded.toFixed(1)}% vs prev
    </Badge>
  )
}

const getPlatformMeta = (value?: string | null) => {
  const key = normalizeKey(value)
  if (["meta", "facebook", "fb", "paidmeta", "paidfacebook"].includes(key)) {
    return { label: "Meta", dotClass: "bg-blue-500", hint: "Meta Ads", short: "M" }
  }
  if (["gads", "googleads", "google", "paidgads"].includes(key)) {
    return { label: "Google Ads", dotClass: "bg-amber-500", hint: "Google Ads", short: "G" }
  }
  if (["offline"].includes(key)) {
    return { label: "Offline", dotClass: "bg-slate-400", hint: "Offline", short: "O" }
  }
  if (!value) {
    return { label: "—", dotClass: "bg-slate-300", hint: "Unknown platform", short: "?" }
  }
  return { label: value, dotClass: "bg-slate-400", hint: value, short: value.slice(0, 1).toUpperCase() }
}

const renderPlatformBadge = (value?: string | null) => {
  const meta = getPlatformMeta(value)
  return (
    <Badge variant="outline" className="gap-1.5 text-xs font-medium" title={meta.hint}>
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold text-white ${meta.dotClass}`}
        aria-hidden
      >
        {meta.short}
      </span>
      {meta.label}
    </Badge>
  )
}

const mixPlatformRows = <T extends WidgetRow>(
  rows: T[],
  limit: number,
  getPlatform: (row: T) => string,
  getSpend: (row: T) => number
) => {
  if (rows.length <= limit) return rows
  const sorted = [...rows].sort((a, b) => getSpend(b) - getSpend(a))
  const platforms = Array.from(
    new Set(sorted.map((row) => normalizeKey(getPlatform(row)) || "unknown"))
  )
  const picked = new Set<T>()
  const selected: T[] = []
  platforms.forEach((platform) => {
    const candidate = sorted.find((row) => normalizeKey(getPlatform(row)) === platform)
    if (candidate) {
      picked.add(candidate)
      selected.push(candidate)
    }
  })
  for (const row of sorted) {
    if (selected.length >= limit) break
    if (!picked.has(row)) {
      picked.add(row)
      selected.push(row)
    }
  }
  return selected.slice(0, limit)
}

const getCoverageBadge = (ratio: number | null) => {
  if (ratio == null) return { label: "No coverage", variant: "outline" as const }
  if (ratio >= 0.4) return { label: "High coverage", variant: "success" as const }
  if (ratio >= 0.2) return { label: "Medium coverage", variant: "warning" as const }
  return { label: "Low coverage", variant: "destructive" as const }
}

const getAttributionStatus = (coverage: { contractsPct: number; paymentsPct: number }) => {
  if (coverage.contractsPct >= 30 && coverage.paymentsPct >= 20) {
    return { label: "OK", variant: "success" as const, description: "Повна атрибуція та стабільні метрики." }
  }
  if (coverage.contractsPct >= 10 || coverage.paymentsPct >= 5) {
    return { label: "Partial", variant: "warning" as const, description: "Часткова атрибуція, потрібні донастройки." }
  }
  return { label: "Poor", variant: "destructive" as const, description: "Низька повнота атрибуції." }
}

const getInsightTone = (value: unknown) => {
  const severity = typeof value === "string" ? value.toLowerCase() : ""
  if (severity.includes("high") || severity.includes("critical") || severity.includes("error")) {
    return { label: "Аномалия", variant: "destructive" as const }
  }
  if (severity.includes("medium") || severity.includes("warn")) {
    return { label: "Риск", variant: "warning" as const }
  }
  if (severity.includes("success") || severity.includes("ok")) {
    return { label: "Успіх", variant: "success" as const }
  }
  return { label: "Інсайт", variant: "secondary" as const }
}

const renderInsightsBlock = (insights: InsightRow[], widgetLabel: string, compact = false) => {
  if (!insights.length) return null
  return (
    <div className={`mt-3 rounded-xl border border-border bg-card/40 p-3 ${compact ? "text-xs" : "text-sm"}`}>
      <div className="mb-2 text-xs text-muted-foreground">AI insights · {widgetLabel}</div>
      <div className="space-y-2">
        {insights.slice(0, compact ? 2 : 4).map((insight, index) => {
          const title = insight.title ?? "AI Інсайт"
          const summary = insight.summary ?? ""
          const tone = getInsightTone(insight.severity)
          const confidence = formatConfidence(insight.confidence ?? null)
          return (
            <div key={`${title}-${index}`} className="rounded-lg border border-border/60 bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{title}</span>
                <Badge variant={tone.variant}>{tone.label}</Badge>
              </div>
              {summary && <p className="mt-2 text-xs text-muted-foreground">{summary}</p>}
              {(confidence || insight.tags?.length) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {confidence && <span>Confidence {confidence}</span>}
                  {insight.tags?.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CampaignsSourcesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { cities } = useCities()
  const defaultCityId = useMemo(() => resolveDefaultCityId(cities), [cities])
  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 120)
    return date
  }, [])

  const initialFilters = useMemo<AnalyticsFiltersValue>(
    () => ({
      dateRange: { from: defaultFrom, to: today },
      cityId: defaultCityId ? String(defaultCityId) : "all",
      product: "",
      branch: "",
      source: "",
    }),
    [defaultFrom, today, defaultCityId]
  )
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersValue>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFiltersValue>(initialFilters)

  const [campaignRows, setCampaignRows] = useState<WidgetRow[]>([])
  const [inventoryRows, setInventoryRows] = useState<WidgetRow[]>([])
  const [revenueRows, setRevenueRows] = useState<WidgetRow[]>([])
  const [metricsRows, setMetricsRows] = useState<WidgetRow[]>([])
  const [sourcePerfRows, setSourcePerfRows] = useState<WidgetRow[]>([])
  const [offlineRows, setOfflineRows] = useState<WidgetRow[]>([])
  const [ga4TrafficRows, setGa4TrafficRows] = useState<WidgetRow[]>([])
  const [ga4UtmRows, setGa4UtmRows] = useState<WidgetRow[]>([])
  const [ga4EventsRows, setGa4EventsRows] = useState<WidgetRow[]>([])
  const [ga4CreativeRows, setGa4CreativeRows] = useState<WidgetRow[]>([])
  const [aiInsightsByWidget, setAiInsightsByWidget] = useState<Record<string, InsightRow[]>>({})
  const [aiLoading, setAiLoading] = useState(false)

  const AI_WIDGETS = [
    { key: "campaigns.table", label: "Campaign Performance" },
    { key: "campaigns.top_metrics", label: "Top Metrics" },
    { key: "campaigns.inventory_daily_city", label: "Campaign Inventory" },
    { key: "sources.revenue_split", label: "Revenue by Source" },
    { key: "marketing.offline_sources_active", label: "Offline & Unknown" },
    { key: "crm.sources_performance_daily", label: "CRM Sources" },
    { key: "ga4.traffic_overview_daily", label: "GA4 Traffic" },
    { key: "ga4.utm_daily", label: "GA4 UTM" },
    { key: "ga4.events_conversions_daily", label: "GA4 Events" },
  ]

  const [activeAiWidget, setActiveAiWidget] = useState("campaigns.table")
  const [showAllCampaigns, setShowAllCampaigns] = useState(false)
  const [showAllInventory, setShowAllInventory] = useState(false)
  const [showAllSources, setShowAllSources] = useState(false)
  const [showAllSourcePerf, setShowAllSourcePerf] = useState(false)
  const [showAllOffline, setShowAllOffline] = useState(false)
  const [showZeroCrmSources, setShowZeroCrmSources] = useState(false)
  const [campaignSort, setCampaignSort] = useState<"spend" | "revenue" | "contracts">("spend")
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const activeInsights = aiInsightsByWidget[activeAiWidget] ?? []
  const hasData =
    campaignRows.length > 0 ||
    inventoryRows.length > 0 ||
    revenueRows.length > 0 ||
    metricsRows.length > 0 ||
    sourcePerfRows.length > 0 ||
    offlineRows.length > 0 ||
    ga4TrafficRows.length > 0 ||
    ga4UtmRows.length > 0 ||
    ga4EventsRows.length > 0 ||
    ga4CreativeRows.length > 0

  const filters = {
    date_from: appliedFilters.dateRange.from ? toDateInput(appliedFilters.dateRange.from) : undefined,
    date_to: appliedFilters.dateRange.to ? toDateInput(appliedFilters.dateRange.to) : undefined,
    id_city: appliedFilters.cityId !== "all" ? Number(appliedFilters.cityId) : undefined,
    product: appliedFilters.product || undefined,
    branch: appliedFilters.branch || undefined,
    source: appliedFilters.source || undefined,
  }
  const globalFilters = {
    date_from: filters.date_from,
    date_to: filters.date_to,
    id_city: filters.id_city,
  }
  const marketingScopeFilters = {
    product: filters.product,
    branch: filters.branch,
    source: filters.source,
  }
  const ga4ScopeFilters = {
    source: filters.source,
  }

  const periodLabel =
    filters.date_from && filters.date_to ? `${filters.date_from} → ${filters.date_to}` : ""

  const rangeDays = useMemo(
    () => getRangeDays(appliedFilters.dateRange.from, appliedFilters.dateRange.to),
    [appliedFilters]
  )

  const metricsParsed = useMemo(() => {
    return parseWidgetRowsSafe(
      metricsRows.map((row) => camelizeUnknownRecordShallow(row)),
      campaignsTopMetricsRowSchema
    )
  }, [metricsRows])

  const revenueParsed = useMemo(() => {
    return parseWidgetRowsSafe(
      revenueRows.map((row) => camelizeUnknownRecordShallow(row)),
      sourcesRevenueSplitRowSchema
    )
  }, [revenueRows])

  const fetchCampaignsWidgets = async () => {
    if (!isAuthenticated || authLoading) return
    setLoading(true)
    try {
      const batch = await fetchWidgetsBatch({
        global_filters: globalFilters,
        widgets: [
          { widget_key: "campaigns.table", limit: 1000, filters: marketingScopeFilters },
          { widget_key: "campaigns.inventory_daily_city", limit: 1000, order_by: "-spend", filters: marketingScopeFilters },
          { widget_key: "sources.revenue_split", limit: 1000, filters: marketingScopeFilters },
          { widget_key: "campaigns.top_metrics", limit: 1000, filters: marketingScopeFilters },
          { widget_key: "crm.sources_performance_daily", limit: 1000, order_by: "-leads_cnt", filters: marketingScopeFilters },
          { widget_key: "marketing.offline_sources_active", limit: 500, order_by: "-revenue_sum", filters: marketingScopeFilters },
          { widget_key: "ga4.traffic_overview_daily", limit: 1000, order_by: "-date_key", filters: ga4ScopeFilters },
          { widget_key: "ga4.utm_daily", limit: 1000, order_by: "-date_key", filters: ga4ScopeFilters },
          { widget_key: "ga4.events_conversions_daily", limit: 1000, order_by: "-date_key", filters: ga4ScopeFilters },
          { widget_key: "ga4.ads_creative_performance_daily", limit: 1000, order_by: "-date_key", filters: ga4ScopeFilters },
        ],
      })
      setCampaignRows(batch.items["campaigns.table"]?.items ?? [])
      setInventoryRows(batch.items["campaigns.inventory_daily_city"]?.items ?? [])
      setRevenueRows(batch.items["sources.revenue_split"]?.items ?? [])
      setMetricsRows(batch.items["campaigns.top_metrics"]?.items ?? [])
      setSourcePerfRows(batch.items["crm.sources_performance_daily"]?.items ?? [])
      setOfflineRows(batch.items["marketing.offline_sources_active"]?.items ?? [])
      setGa4TrafficRows(batch.items["ga4.traffic_overview_daily"]?.items ?? [])
      setGa4UtmRows(batch.items["ga4.utm_daily"]?.items ?? [])
      setGa4EventsRows(batch.items["ga4.events_conversions_daily"]?.items ?? [])
      setGa4CreativeRows(batch.items["ga4.ads_creative_performance_daily"]?.items ?? [])
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }

  const fetchInsightsForWidget = async () => {
    if (!isAuthenticated || authLoading) return
    setAiLoading(true)
    try {
      const results = await Promise.all(
        AI_WIDGETS.map((widget) =>
          fetchInsights(widget.key, {
            limit: 12,
            date_from: filters.date_from,
            date_to: filters.date_to,
            id_city: filters.id_city,
          })
        )
      )
      const next: Record<string, InsightRow[]> = {}
      results.forEach((result, index) => {
        const key = AI_WIDGETS[index]?.key ?? result.widget_key
        next[key] = result.items ?? []
      })
      setAiInsightsByWidget(next)
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    fetchCampaignsWidgets()
  }, [appliedFilters, isAuthenticated, authLoading])

  useEffect(() => {
    if (!defaultCityId) return
    if (draftFilters.cityId === "all") {
      setDraftFilters((prev) => ({ ...prev, cityId: String(defaultCityId) }))
      setAppliedFilters((prev) => ({ ...prev, cityId: String(defaultCityId) }))
    }
  }, [defaultCityId])

  useEffect(() => {
    let active = true
    const hydrateRange = async () => {
      try {
        if (!isAuthenticated || authLoading) return
        const range = await fetchWidgetRange("campaigns.table")
        if (!active || !range.max_date) return
        const maxDate = range.max_date.slice(0, 10)
        const fromDate = shiftDate(maxDate, -120)
        const nextFilters: AnalyticsFiltersValue = {
          ...initialFilters,
          dateRange: { from: new Date(fromDate), to: new Date(maxDate) },
        }
        setDraftFilters(nextFilters)
        setAppliedFilters(nextFilters)
      } catch {
        // fallback to defaults
      }
    }
    hydrateRange()
    return () => {
      active = false
    }
  }, [initialFilters, isAuthenticated, authLoading])

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    fetchInsightsForWidget()
  }, [appliedFilters, isAuthenticated, authLoading])

  const resetFilters = () => {
    const resetValue: AnalyticsFiltersValue = {
      ...initialFilters,
      cityId: defaultCityId ? String(defaultCityId) : "all",
    }
    setDraftFilters(resetValue)
    setAppliedFilters(resetValue)
  }

  const applyFilters = () => {
    setAppliedFilters(draftFilters)
  }

  const applyQuickRange = (days: number) => {
    const to = draftFilters.dateRange.to ?? new Date()
    const from = new Date(to)
    from.setDate(from.getDate() - days)
    const next: AnalyticsFiltersValue = {
      ...draftFilters,
      dateRange: { from, to },
    }
    setDraftFilters(next)
    setAppliedFilters(next)
  }

  const filteredCampaignRows = useMemo(() => {
    const buckets = new Map<string, WidgetRow & { _key: string }>()
    campaignRows.forEach((row) => {
      const platform = pickText(row, ["platform", "channel"], "unknown")
      const campaignId = row.campaign_id ?? ""
      const campaignName = pickText(row, ["campaign_name"], campaignId ? `Campaign ${campaignId}` : "Campaign")
      const key = `${platform}::${campaignId || campaignName}`
      const existing = buckets.get(key)
      if (!existing) {
        buckets.set(key, {
          ...row,
          _key: key,
          platform,
          campaign_name: campaignName,
          campaign_id: campaignId,
          spend: pickNumber(row, ["spend"]),
          leads: pickNumber(row, ["leads", "platform_leads", "leads_cnt"]),
          contracts: pickNumber(row, ["contracts", "contracts_cnt"]),
          revenue: pickNumber(row, ["revenue", "revenue_sum", "contracts_sum", "revenue_total_cost"]),
          payments: pickNumber(row, ["payments_sum", "paid_sum"]),
          prepayment: pickNumber(row, ["prepayment_sum", "prepayment"]),
          impressions: pickNumber(row, ["impressions"]),
          clicks: pickNumber(row, ["clicks"]),
        })
        return
      }
      existing.spend = pickNumber(existing, ["spend"]) + pickNumber(row, ["spend"])
      existing.leads = pickNumber(existing, ["leads"]) + pickNumber(row, ["leads", "platform_leads", "leads_cnt"])
      existing.contracts =
        pickNumber(existing, ["contracts"]) + pickNumber(row, ["contracts", "contracts_cnt"])
      existing.revenue =
        pickNumber(existing, ["revenue"]) +
        pickNumber(row, ["revenue", "revenue_sum", "contracts_sum", "revenue_total_cost"])
      existing.payments =
        pickNumber(existing, ["payments"]) + pickNumber(row, ["payments_sum", "paid_sum"])
      existing.prepayment =
        pickNumber(existing, ["prepayment"]) + pickNumber(row, ["prepayment_sum", "prepayment"])
      existing.impressions = pickNumber(existing, ["impressions"]) + pickNumber(row, ["impressions"])
      existing.clicks = pickNumber(existing, ["clicks"]) + pickNumber(row, ["clicks"])
    })
    return Array.from(buckets.values()).filter((row) => {
      const spend = pickNumber(row, ["spend"])
      const revenue = pickNumber(row, ["revenue"])
      const leads = pickNumber(row, ["leads"])
      const contracts = pickNumber(row, ["contracts"])
      const prepayment = pickNumber(row, ["prepayment"])
      return spend > 0 || revenue > 0 || leads > 0 || contracts > 0 || prepayment > 0
    })
  }, [campaignRows])

  const campaignRollups = filteredCampaignRows.map((row) => {
    const platform = pickText(row, ["platform", "channel"], "unknown")
    const channel = pickText(row, ["channel"], platform)
    const campaignId = pickText(row, ["campaign_id"], "")
    const campaignName = pickText(row, ["campaign_name"], campaignId ? `Campaign ${campaignId}` : "Campaign")
    const spend = pickNumber(row, ["spend"])
    const leads = pickNumber(row, ["leads"])
    const contracts = pickNumber(row, ["contracts"])
    const revenue = pickNumber(row, ["revenue"])
    const payments = pickNumber(row, ["payments"])
    const prepayment = pickNumber(row, ["prepayment"])
    const impressions = pickNumber(row, ["impressions"])
    const clicks = pickNumber(row, ["clicks"])
    const ctr = impressions > 0 ? clicks / impressions : null
    const cpc = clicks > 0 ? spend / clicks : null
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : null
    const cpl = leads > 0 ? spend / leads : null
    const cpa = contracts > 0 ? spend / contracts : null
    const roas = spend > 0 ? revenue / spend : null
    const paybackRate = revenue > 0 ? payments / revenue : null
    return {
      ...row,
      platform,
      channel,
      campaign_id: campaignId,
      campaign_name: campaignName,
      spend,
      leads,
      contracts,
      revenue,
      payments,
      prepayment,
      impressions,
      clicks,
      ctr,
      cpc,
      cpm,
      cpl,
      cpa,
      roas,
      paybackRate,
    }
  })

  const platformSummary = useMemo(() => {
    const buckets = new Map<string, number>()
    campaignRollups.forEach((row) => {
      const key = String(row.platform ?? row.channel ?? "unknown")
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    })
    return Array.from(buckets.entries()).sort((a, b) => b[1] - a[1])
  }, [campaignRollups])

  const campaignCoverage = useMemo(() => {
    if (!campaignRollups.length) return null
    const withContracts = campaignRollups.filter((row) => pickNumber(row, ["contracts"]) > 0).length
    return withContracts / campaignRollups.length
  }, [campaignRollups])

  const filteredRevenueRows = useMemo(() => {
    return revenueRows.filter((row) => {
      const name = row.source_name ?? row.source_user_name ?? row.source_type_name
      if (!name) return false
      const contractsSum = pickNumber(row, ["contracts_sum", "revenue_sum"])
      const paidSum = pickNumber(row, ["payments_sum", "paid_sum"])
      const prepaymentSum = pickNumber(row, ["prepayment_sum", "prepayment"])
      return contractsSum > 0 || paidSum > 0 || prepaymentSum > 0
    })
  }, [revenueRows])

  const filteredRevenueParsedRows = useMemo(() => {
    return revenueParsed.items.filter((row) => {
      const name = row.sourceName ?? row.sourceUserName ?? row.sourceTypeName
      if (!name) return false
      const revenue = row.contractsSum ?? row.revenueSum ?? row.revenueTotalCost ?? 0
      const payments = row.paymentsSum ?? row.paidSum ?? 0
      const prepayment = row.prepaymentSum ?? row.prepayment ?? 0
      return revenue > 0 || payments > 0 || prepayment > 0
    })
  }, [revenueParsed.items])

  const filteredInventoryRows = useMemo(() => {
    const buckets = new Map<string, WidgetRow & { _key: string }>()
    inventoryRows.forEach((row) => {
      const platform = pickText(row, ["platform"], "unknown")
      const campaignId = row.campaign_id ?? ""
      const campaignName = pickText(row, ["campaign_name"], campaignId ? `Campaign ${campaignId}` : "Campaign")
      const product = pickText(row, ["product_intent_primary", "product_line", "product_intent_secondary"], "Unknown")
      const key = `${platform}::${campaignId || campaignName}::${product}`
      const existing = buckets.get(key)
      if (!existing) {
        buckets.set(key, {
          ...row,
          _key: key,
          platform,
          campaign_name: campaignName,
          campaign_id: campaignId,
          product_intent_primary: product,
          spend: pickNumber(row, ["spend"]),
          platform_leads: pickNumber(row, ["platform_leads", "leads_platform", "leads", "leads_cnt"]),
          crm_requests_cnt: pickNumber(row, ["crm_requests_cnt"]),
          contracts_cnt: pickNumber(row, ["contracts_cnt", "contracts"]),
          revenue_total_cost: pickNumber(row, ["revenue_total_cost"]),
          payments_sum: pickNumber(row, ["payments_sum", "paid_sum"]),
        })
        return
      }
      existing.spend = pickNumber(existing, ["spend"]) + pickNumber(row, ["spend"])
      existing.platform_leads =
        pickNumber(existing, ["platform_leads"]) +
        pickNumber(row, ["platform_leads", "leads_platform", "leads", "leads_cnt"])
      existing.crm_requests_cnt =
        pickNumber(existing, ["crm_requests_cnt"]) + pickNumber(row, ["crm_requests_cnt"])
      existing.contracts_cnt =
        pickNumber(existing, ["contracts_cnt"]) + pickNumber(row, ["contracts_cnt", "contracts"])
      existing.revenue_total_cost =
        pickNumber(existing, ["revenue_total_cost"]) + pickNumber(row, ["revenue_total_cost"])
      existing.payments_sum = pickNumber(existing, ["payments_sum"]) + pickNumber(row, ["payments_sum", "paid_sum"])
    })
    return Array.from(buckets.values()).filter((row) => {
      const spend = pickNumber(row, ["spend"])
      const leads = pickNumber(row, ["platform_leads"])
      const contracts = pickNumber(row, ["contracts_cnt"])
      const payments = pickNumber(row, ["payments_sum"])
      const prepayment = pickNumber(row, ["prepayment_sum", "prepayment"])
      return spend > 0 || leads > 0 || contracts > 0 || payments > 0 || prepayment > 0
    })
  }, [inventoryRows])

  const inventoryDisplayRows = useMemo(() => {
    return mixPlatformRows(
      filteredInventoryRows,
      8,
      (row) => String(row.platform ?? row.channel ?? ""),
      (row) => pickNumber(row, ["spend"])
    )
  }, [filteredInventoryRows])

  const filteredOfflineRows = useMemo(() => {
    const buckets = new Map<string, WidgetRow & { _label: string; _owner: string }>()
    offlineRows.forEach((row) => {
      const labelRaw = pickText(row, ["source_name", "event_name", "promo_name", "source", "source_type"], "Unknown")
      const label = normalizeSourceLabel(labelRaw)
      const ownerRaw = pickText(row, ["source_owner", "owner_name", "user_name"], "")
      const owner = ownerRaw ? normalizeOwnerLabel(ownerRaw) : "—"
      const key = `${label}::${owner}`
      const existing = buckets.get(key)
      if (!existing) {
        buckets.set(key, {
          ...row,
          _label: label,
          _owner: owner,
          leads_cnt: pickNumber(row, ["leads_cnt"]),
          contracts_cnt: pickNumber(row, ["contracts_cnt"]),
          revenue_sum: pickNumber(row, ["revenue_sum", "contracts_sum"]),
          payments_sum: pickNumber(row, ["payments_sum", "paid_sum"]),
        })
        return
      }
      existing.leads_cnt = pickNumber(existing, ["leads_cnt"]) + pickNumber(row, ["leads_cnt"])
      existing.contracts_cnt = pickNumber(existing, ["contracts_cnt"]) + pickNumber(row, ["contracts_cnt"])
      existing.revenue_sum =
        pickNumber(existing, ["revenue_sum"]) + pickNumber(row, ["revenue_sum", "contracts_sum"])
      existing.payments_sum =
        pickNumber(existing, ["payments_sum"]) + pickNumber(row, ["payments_sum", "paid_sum"])
    })
    return Array.from(buckets.values()).filter((row) => {
      const leads = pickNumber(row, ["leads_cnt"])
      const contracts = pickNumber(row, ["contracts_cnt"])
      const revenue = pickNumber(row, ["revenue_sum"])
      const payments = pickNumber(row, ["payments_sum"])
      const prepayment = pickNumber(row, ["prepayment_sum", "prepayment"])
      return leads > 0 || contracts > 0 || revenue > 0 || payments > 0 || prepayment > 0
    })
  }, [offlineRows])

  const offlineTotals = useMemo(() => {
    return filteredOfflineRows.reduce(
      (acc, row) => {
        acc.revenue += pickNumber(row, ["revenue_sum", "contracts_sum"])
        acc.payments += pickNumber(row, ["payments_sum", "paid_sum"])
        acc.contracts += pickNumber(row, ["contracts_cnt"])
        return acc
      },
      { revenue: 0, payments: 0, contracts: 0 }
    )
  }, [filteredOfflineRows])

  const filteredSourcePerfRows = useMemo(() => {
    return sourcePerfRows.filter((row) => {
      const name = row.source_type ?? row.source_owner ?? row.id_source
      if (!name) return false
      const leads = pickNumber(row, ["leads_cnt"])
      const contracts = pickNumber(row, ["contracts_cnt"])
      const revenue = pickNumber(row, ["revenue", "revenue_sum", "contracts_sum"])
      const prepayment = pickNumber(row, ["prepayment_sum", "prepayment"])
      return showZeroCrmSources ? true : leads > 0 || contracts > 0 || revenue > 0 || prepayment > 0
    })
  }, [sourcePerfRows, showZeroCrmSources])

  const groupedSourcePerfRows = useMemo(() => {
    const buckets = new Map<string, WidgetRow & { _label: string; _owner: string }>()
    filteredSourcePerfRows.forEach((row) => {
      const labelRaw = pickSourceLabel(row)
      const label = normalizeSourceLabel(labelRaw)
      const ownerRaw = pickText(row, ["source_owner", "owner_name", "user_name"], "—")
      const owner = ownerRaw ? normalizeOwnerLabel(ownerRaw) : "—"
      const typeRaw = pickText(row, ["source_type", "source_type_name"], "")
      const typeLabel = typeRaw ? normalizeSourceLabel(typeRaw) : ""
      const key = `${label}::${owner}`
      const existing = buckets.get(key)
      if (!existing) {
        buckets.set(key, {
          ...row,
          _label: label,
          _owner: owner,
          _type: typeLabel,
          leads_cnt: pickNumber(row, ["leads_cnt"]),
          contracts_cnt: pickNumber(row, ["contracts_cnt"]),
          revenue_sum: pickNumber(row, ["revenue_sum", "revenue", "contracts_sum"]),
          payments_sum: pickNumber(row, ["payments_sum", "paid_sum"]),
        })
        return
      }
      existing.leads_cnt = pickNumber(existing, ["leads_cnt"]) + pickNumber(row, ["leads_cnt"])
      existing.contracts_cnt = pickNumber(existing, ["contracts_cnt"]) + pickNumber(row, ["contracts_cnt"])
      existing.revenue_sum =
        pickNumber(existing, ["revenue_sum"]) + pickNumber(row, ["revenue_sum", "revenue", "contracts_sum"])
      existing.payments_sum = pickNumber(existing, ["payments_sum"]) + pickNumber(row, ["payments_sum", "paid_sum"])
    })
    return Array.from(buckets.values())
  }, [filteredSourcePerfRows])

  const sortedSourcePerfRows = useMemo(() => {
    return [...groupedSourcePerfRows].sort((a, b) => {
      const revenueDiff =
        pickNumber(b, ["revenue", "revenue_sum", "contracts_sum"]) -
        pickNumber(a, ["revenue", "revenue_sum", "contracts_sum"])
      if (revenueDiff !== 0) return revenueDiff
      const contractsDiff = pickNumber(b, ["contracts_cnt"]) - pickNumber(a, ["contracts_cnt"])
      if (contractsDiff !== 0) return contractsDiff
      return pickNumber(b, ["leads_cnt"]) - pickNumber(a, ["leads_cnt"])
    })
  }, [groupedSourcePerfRows])

  const crmSourceTotals = useMemo(() => {
    return sortedSourcePerfRows.reduce(
      (acc, row) => {
        acc.revenue += pickNumber(row, ["revenue", "revenue_sum", "contracts_sum"])
        acc.contracts += pickNumber(row, ["contracts_cnt"])
        acc.leads += pickNumber(row, ["leads_cnt"])
        return acc
      },
      { revenue: 0, contracts: 0, leads: 0 }
    )
  }, [sortedSourcePerfRows])

  const totalRevenueSum = useMemo(() => {
    return filteredRevenueRows.reduce((acc, row) => acc + pickNumber(row, ["contracts_sum", "revenue_sum"]), 0)
  }, [filteredRevenueRows])

  const groupedRevenueRows = useMemo(() => {
    const buckets = new Map<string, WidgetRow & { _label: string; _owner: string; _meta: string }>()
    filteredRevenueRows.forEach((row) => {
      const labelRaw = pickSourceLabel(row)
      const label = normalizeSourceLabel(labelRaw)
      const ownerRaw = pickText(row, ["source_owner", "source_user_name"], "")
      const owner = ownerRaw ? normalizeOwnerLabel(ownerRaw) : ""
      const typeRaw = pickText(row, ["source_type_name", "source_type"], "")
      const typeLabel = typeRaw ? normalizeSourceLabel(typeRaw) : ""
      const metaParts = [typeLabel, row.id_source ? `#${row.id_source}` : ""]
        .filter(Boolean)
        .map((item) => normalizeSourceLabel(String(item)))
      const meta = metaParts.join(" · ")
      const key = `${label}::${owner || "—"}`
      const existing = buckets.get(key)
      if (!existing) {
        buckets.set(key, {
          ...row,
          _label: label,
          _owner: owner,
          _meta: meta,
          contracts_cnt: pickNumber(row, ["contracts_cnt"]),
          revenue_sum: pickNumber(row, ["contracts_sum", "revenue_sum"]),
          payments_sum: pickNumber(row, ["payments_sum", "paid_sum"]),
        })
        return
      }
      existing.contracts_cnt = pickNumber(existing, ["contracts_cnt"]) + pickNumber(row, ["contracts_cnt"])
      existing.revenue_sum =
        pickNumber(existing, ["revenue_sum"]) + pickNumber(row, ["contracts_sum", "revenue_sum"])
      existing.payments_sum = pickNumber(existing, ["payments_sum"]) + pickNumber(row, ["payments_sum", "paid_sum"])
    })
    return Array.from(buckets.values())
  }, [filteredRevenueRows])

  const coverageSummary = useMemo(() => {
    if (!campaignRollups.length) return null
    const total = campaignRollups.length
    const withContracts = campaignRollups.filter((row) => pickNumber(row, ["contracts"]) > 0).length
    const withPayments = campaignRollups.filter((row) => pickNumber(row, ["payments"]) > 0).length
    const withRevenue = campaignRollups.filter((row) => pickNumber(row, ["revenue"]) > 0).length
    const totalLeads = campaignRollups.reduce((acc, row) => acc + pickNumber(row, ["leads"]), 0)
    const totalContracts = campaignRollups.reduce((acc, row) => acc + pickNumber(row, ["contracts"]), 0)
    return {
      total,
      withContracts,
      withPayments,
      withRevenue,
      totalLeads,
      totalContracts,
      leadToContractPct: totalLeads > 0 ? (totalContracts / totalLeads) * 100 : 0,
      contractsPct: (withContracts / total) * 100,
      paymentsPct: (withPayments / total) * 100,
      revenuePct: (withRevenue / total) * 100,
    }
  }, [campaignRollups])

  const executiveSummary = useMemo(() => {
    if (!campaignRollups.length) return null
    type ExecutiveTotals = {
      spend: number
      revenue: number
      payments: number
      prepayment: number
      contracts: number
    }

    const totals = campaignRollups.reduce<ExecutiveTotals>(
      (acc, row) => {
        acc.spend += pickNumber(row, ["spend"])
        acc.revenue += pickNumber(row, ["revenue"])
        acc.payments += pickNumber(row, ["payments"])
        acc.prepayment += pickNumber(row, ["prepayment"])
        acc.contracts += pickNumber(row, ["contracts"])
        return acc
      },
      { spend: 0, revenue: 0, payments: 0, prepayment: 0, contracts: 0 }
    )
    const roas = totals.spend > 0 ? totals.revenue / totals.spend : null
    const payback = totals.revenue > 0 ? totals.payments / totals.revenue : null
    return { ...totals, roas, payback }
  }, [campaignRollups])

  const metricsTotals = useMemo(() => {
    if (!metricsParsed.items.length) return null
    type MetricsTotals = { spend: number; contracts: number; payments: number }
    return metricsParsed.items.reduce<MetricsTotals>(
      (acc, row) => {
        acc.spend += row.adsSpendTotal ?? row.metaSpend ?? row.gadsSpend ?? row.spend ?? 0
        acc.contracts += row.crmContracts ?? row.contractsCnt ?? row.contracts ?? 0
        acc.payments += row.crmPaidSum ?? row.paymentsSum ?? row.paidSum ?? 0
        return acc
      },
      { spend: 0, contracts: 0, payments: 0 }
    )
  }, [metricsParsed.items])

  const revenueTotals = useMemo(() => {
    if (!filteredRevenueParsedRows.length) return null
    type RevenueTotals = { revenue: number; payments: number; prepayment: number; contracts: number }
    return filteredRevenueParsedRows.reduce<RevenueTotals>(
      (acc, row) => {
        acc.revenue += row.revenueSum ?? row.contractsSum ?? row.revenueTotalCost ?? 0
        acc.payments += row.paymentsSum ?? row.paidSum ?? 0
        acc.contracts += row.contractsCnt ?? row.contracts ?? 0
        acc.prepayment += row.prepaymentSum ?? row.prepayment ?? 0
        return acc
      },
      { revenue: 0, payments: 0, prepayment: 0, contracts: 0 }
    )
  }, [filteredRevenueParsedRows])

  const resolveMetricValue = (primary: number | null, fallback?: number) => {
    if (primary == null) return fallback ?? null
    if (primary === 0 && (fallback ?? 0) > 0) return fallback ?? primary
    return primary
  }

  const executiveSummaryResolved = useMemo(() => {
    if (!executiveSummary && !metricsTotals && !revenueTotals) return null
    const spend = resolveMetricValue(metricsTotals?.spend ?? null, executiveSummary?.spend)
    const revenue = resolveMetricValue(revenueTotals?.revenue ?? null, executiveSummary?.revenue)
    const payments = resolveMetricValue(
      revenueTotals?.payments ?? null,
      executiveSummary?.payments ?? metricsTotals?.payments
    )
    const prepayment = resolveMetricValue(revenueTotals?.prepayment ?? null, executiveSummary?.prepayment)
    const contracts = resolveMetricValue(metricsTotals?.contracts ?? null, executiveSummary?.contracts)
    const roas = spend && spend > 0 ? (revenue ?? 0) / spend : null
    const payback = revenue && revenue > 0 ? (payments ?? 0) / revenue : null
    const derived =
      executiveSummary != null &&
      (spend !== executiveSummary.spend ||
        revenue !== executiveSummary.revenue ||
        payments !== executiveSummary.payments ||
        prepayment !== executiveSummary.prepayment ||
        contracts !== executiveSummary.contracts)
    return { spend, revenue, payments, prepayment, contracts, roas, payback, derived }
  }, [executiveSummary, metricsTotals, revenueTotals])

  const attributionStatus = useMemo(() => {
    if (!coverageSummary) return null
    return getAttributionStatus(coverageSummary)
  }, [coverageSummary])

  const dailyTimeline = useMemo(() => {
    const bucket = new Map<string, { date: string; contracts: number; payments: number; spend: number; revenue: number }>()

    metricsParsed.items.forEach((row) => {
      const date = String(row.dateKey ?? row.asOfDate ?? "")
      if (!date) return
      const entry = bucket.get(date) ?? { date, contracts: 0, payments: 0, spend: 0, revenue: 0 }
      entry.spend += row.adsSpendTotal ?? row.metaSpend ?? row.gadsSpend ?? row.spend ?? 0
      entry.contracts += row.crmContracts ?? row.contractsCnt ?? row.contracts ?? 0
      entry.payments += row.crmPaidSum ?? row.paymentsSum ?? row.paidSum ?? 0
      bucket.set(date, entry)
    })

    revenueParsed.items.forEach((row) => {
      const date = String(row.dateKey ?? row.dayKey ?? "")
      if (!date) return
      const entry = bucket.get(date) ?? { date, contracts: 0, payments: 0, spend: 0, revenue: 0 }
      entry.revenue += row.revenueSum ?? row.contractsSum ?? row.revenueTotalCost ?? 0
      if (entry.payments === 0) entry.payments += row.paymentsSum ?? row.paidSum ?? 0
      bucket.set(date, entry)
    })

    return Array.from(bucket.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [metricsParsed.items, revenueParsed.items])

  const campaignsTimeline = useMemo(() => {
    if (!dailyTimeline.length) return []
    const useWeekly = (rangeDays ?? 0) > 90
    if (!useWeekly) {
      return dailyTimeline.slice(-(rangeDays ?? 90))
    }
    const buckets = new Map<string, { date: string; contracts: number; payments: number; spend: number; revenue: number }>()
    dailyTimeline.forEach((row) => {
      const date = parseDateKey(row.date)
      if (!date) return
      const weekStart = startOfWeek(date)
      const key = toDateKey(weekStart)
      const entry = buckets.get(key) ?? { date: key, contracts: 0, payments: 0, spend: 0, revenue: 0 }
      entry.contracts += row.contracts
      entry.payments += row.payments
      entry.spend += row.spend
      entry.revenue += row.revenue
      buckets.set(key, entry)
    })
    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyTimeline, rangeDays])

  const timelineGranularity = rangeDays && rangeDays > 90 ? "Weekly" : "Daily"

  const timelineSeries = useMemo(() => {
    if (!campaignsTimeline.length) return []
    const window = timelineGranularity === "Weekly" ? 4 : 7
    return campaignsTimeline.map((row, index) => {
      const slice = campaignsTimeline.slice(Math.max(0, index - window + 1), index + 1)
      const average = (key: "spend" | "revenue" | "payments" | "contracts") =>
        slice.reduce((acc, item) => acc + item[key], 0) / slice.length
      return {
        ...row,
        spend_trend: average("spend"),
        revenue_trend: average("revenue"),
        payments_trend: average("payments"),
        contracts_trend: average("contracts"),
      }
    })
  }, [campaignsTimeline, timelineGranularity])

  const periodTotals = useMemo(() => {
    if (!dailyTimeline.length || !filters.date_from || !filters.date_to || !rangeDays) return null
    const from = parseDateKey(filters.date_from)
    const to = parseDateKey(filters.date_to)
    if (!from || !to) return null
    const prevTo = new Date(from)
    prevTo.setDate(prevTo.getDate() - 1)
    const prevFrom = new Date(from)
    prevFrom.setDate(prevFrom.getDate() - rangeDays)

    const sumRange = (start: Date, end: Date) => {
      return dailyTimeline.reduce(
        (acc, row) => {
          const date = parseDateKey(row.date)
          if (!date) return acc
          if (date >= start && date <= end) {
            acc.spend += row.spend
            acc.revenue += row.revenue
            acc.payments += row.payments
            acc.contracts += row.contracts
          }
          return acc
        },
        { spend: 0, revenue: 0, payments: 0, contracts: 0 }
      )
    }

    const current = sumRange(from, to)
    const previous = sumRange(prevFrom, prevTo)
    return { current, previous }
  }, [dailyTimeline, filters.date_from, filters.date_to, rangeDays])

  const periodDeltas = useMemo(() => {
    if (!periodTotals) return null
    return {
      spend: formatDelta(periodTotals.current.spend, periodTotals.previous.spend),
      revenue: formatDelta(periodTotals.current.revenue, periodTotals.previous.revenue),
      payments: formatDelta(periodTotals.current.payments, periodTotals.previous.payments),
      contracts: formatDelta(periodTotals.current.contracts, periodTotals.previous.contracts),
    }
  }, [periodTotals])

  const ratioDeltas = useMemo(() => {
    if (!periodTotals) return null
    const currentRoas =
      periodTotals.current.spend > 0 ? periodTotals.current.revenue / periodTotals.current.spend : null
    const previousRoas =
      periodTotals.previous.spend > 0 ? periodTotals.previous.revenue / periodTotals.previous.spend : null
    const currentPayback =
      periodTotals.current.revenue > 0 ? periodTotals.current.payments / periodTotals.current.revenue : null
    const previousPayback =
      periodTotals.previous.revenue > 0 ? periodTotals.previous.payments / periodTotals.previous.revenue : null
    return {
      roas: formatDelta(currentRoas, previousRoas),
      payback: formatDelta(currentPayback, previousPayback),
    }
  }, [periodTotals])

  const metricsPeriodTotals = useMemo(() => {
    if (!metricsParsed.items.length || !filters.date_from || !filters.date_to || !rangeDays) return null
    const from = parseDateKey(filters.date_from)
    const to = parseDateKey(filters.date_to)
    if (!from || !to) return null
    const prevTo = new Date(from)
    prevTo.setDate(prevTo.getDate() - 1)
    const prevFrom = new Date(from)
    prevFrom.setDate(prevFrom.getDate() - rangeDays)

    const sumRange = (start: Date, end: Date) => {
      type MetricsPeriodAcc = {
        ads_spend_total: number
        meta_spend: number
        gads_spend: number
        meta_leads: number
        gads_leads: number
        crm_requests: number
        crm_contracts: number
        gads_contracts: number
        meta_paid_sum: number
        crm_paid_sum: number
      }

      return metricsParsed.items.reduce<MetricsPeriodAcc>(
        (acc, row) => {
          const date = parseDateKey(String(row.dateKey ?? row.dayKey ?? ""))
          if (!date) return acc
          if (date >= start && date <= end) {
            acc.ads_spend_total += row.adsSpendTotal ?? 0
            acc.meta_spend += row.metaSpend ?? 0
            acc.gads_spend += row.gadsSpend ?? 0
            acc.meta_leads += row.metaLeads ?? 0
            acc.gads_leads += row.gadsLeads ?? 0
            acc.crm_requests += row.crmRequests ?? 0
            acc.crm_contracts += row.crmContracts ?? 0
            acc.gads_contracts += row.gadsContracts ?? 0
            acc.meta_paid_sum += row.metaPaidSum ?? 0
            acc.crm_paid_sum += row.crmPaidSum ?? 0
          }
          return acc
        },
        {
          ads_spend_total: 0,
          meta_spend: 0,
          gads_spend: 0,
          meta_leads: 0,
          gads_leads: 0,
          crm_requests: 0,
          crm_contracts: 0,
          gads_contracts: 0,
          meta_paid_sum: 0,
          crm_paid_sum: 0,
        }
      )
    }

    return {
      current: sumRange(from, to),
      previous: sumRange(prevFrom, prevTo),
    }
  }, [metricsParsed.items, filters.date_from, filters.date_to, rangeDays])

  const metricsPeriodDeltas = useMemo(() => {
    if (!metricsPeriodTotals) return null
    const current = metricsPeriodTotals.current
    const previous = metricsPeriodTotals.previous
    return {
      ads_spend_total: formatDelta(current.ads_spend_total, previous.ads_spend_total),
      meta_spend: formatDelta(current.meta_spend, previous.meta_spend),
      gads_spend: formatDelta(current.gads_spend, previous.gads_spend),
      meta_leads: formatDelta(current.meta_leads, previous.meta_leads),
      gads_leads: formatDelta(current.gads_leads, previous.gads_leads),
      crm_requests: formatDelta(current.crm_requests, previous.crm_requests),
      crm_contracts: formatDelta(current.crm_contracts, previous.crm_contracts),
      gads_contracts: formatDelta(current.gads_contracts, previous.gads_contracts),
      meta_paid_sum: formatDelta(current.meta_paid_sum, previous.meta_paid_sum),
      crm_paid_sum: formatDelta(current.crm_paid_sum, previous.crm_paid_sum),
    }
  }, [metricsPeriodTotals])

  const revenueCoverage = useMemo(() => {
    if (!filteredRevenueRows.length) return null
    type RevenueCoverageAcc = { contractsSum: number; paidSum: number }
    const totals = filteredRevenueRows.reduce<RevenueCoverageAcc>(
      (acc, row) => {
        acc.contractsSum += pickNumber(row, ["contracts_sum", "revenue_sum"])
        acc.paidSum += pickNumber(row, ["payments_sum", "paid_sum"])
        return acc
      },
      { contractsSum: 0, paidSum: 0 }
    )
    return totals.contractsSum > 0 ? totals.paidSum / totals.contractsSum : null
  }, [filteredRevenueRows])

  const sortedRevenueRows = useMemo(() => {
    return [...groupedRevenueRows].sort(
      (a, b) =>
        pickNumber(b, ["contracts_sum", "revenue_sum"]) -
        pickNumber(a, ["contracts_sum", "revenue_sum"])
    )
  }, [groupedRevenueRows])

  const sortedCampaignRows = useMemo(() => {
    const sorted = [...campaignRollups]
    if (campaignSort === "revenue") {
      return sorted.sort(
        (a, b) =>
          pickNumber(b, ["revenue"]) -
          pickNumber(a, ["revenue"])
      )
    }
    if (campaignSort === "contracts") {
      return sorted.sort(
        (a, b) => pickNumber(b, ["contracts"]) - pickNumber(a, ["contracts"])
      )
    }
    return sorted.sort((a, b) => pickNumber(b, ["spend"]) - pickNumber(a, ["spend"]))
  }, [campaignRollups, campaignSort])

  const campaignDisplayRows = useMemo(() => {
    const metricKey =
      campaignSort === "revenue" ? "revenue" : campaignSort === "contracts" ? "contracts" : "spend"
    return mixPlatformRows(
      sortedCampaignRows,
      8,
      (row) => String(row.platform ?? row.channel ?? ""),
      (row) => pickNumber(row, [metricKey])
    )
  }, [sortedCampaignRows, campaignSort])

  const latestMetrics = useMemo(() => {
    if (!metricsParsed.items.length) return null
    const sorted = [...metricsParsed.items].sort((a, b) =>
      String(b.dateKey ?? b.dayKey ?? "").localeCompare(String(a.dateKey ?? a.dayKey ?? ""))
    )
    const hasValue = (row: (typeof metricsParsed.items)[number]) => {
      const values = [
        row.adsSpendTotal,
        row.metaSpend,
        row.gadsSpend,
        row.metaPaidSum,
        row.crmPaidSum,
        row.crmContracts,
        row.crmRequests,
      ]
      return values.some((value) => (value ?? 0) > 0)
    }
    return sorted.find(hasValue) ?? sorted[0]
  }, [metricsParsed])

  const derivedMetrics = useMemo(() => {
    if (!campaignRollups.length) return null
    const totals = campaignRollups.reduce(
      (acc, row) => {
        const platform = String(row.platform ?? row.channel ?? "").toLowerCase()
        const spend = pickNumber(row, ["spend"])
        const leads = pickNumber(row, ["leads"])
        const requests = pickNumber(row, ["crm_requests_cnt", "requests_cnt", "requests"])
        const contracts = pickNumber(row, ["contracts"])
        const payments = pickNumber(row, ["payments"])
        acc.adsSpend += spend
        acc.crmRequests += requests
        acc.crmContracts += contracts
        acc.crmPaid += payments
        if (platform.includes("meta") || platform.includes("facebook") || platform.includes("fb")) {
          acc.metaSpend += spend
          acc.metaLeads += leads
          acc.metaPaid += payments
        } else if (platform.includes("gads") || platform.includes("google")) {
          acc.gadsSpend += spend
          acc.gadsLeads += leads
          acc.gadsContracts += contracts
        }
        return acc
      },
      {
        adsSpend: 0,
        metaSpend: 0,
        gadsSpend: 0,
        metaLeads: 0,
        gadsLeads: 0,
        crmRequests: 0,
        crmContracts: 0,
        gadsContracts: 0,
        metaPaid: 0,
        crmPaid: 0,
      }
    )
    return totals
  }, [campaignRollups])

  const metricsResolved = useMemo(() => {
    const fallback = derivedMetrics
    const hasMetricsValue = (row: typeof latestMetrics) => {
      if (!row) return false
      return [
        row.adsSpendTotal,
        row.metaSpend,
        row.gadsSpend,
        row.metaPaidSum,
        row.crmPaidSum,
        row.crmContracts,
        row.crmRequests,
        row.metaLeads,
        row.gadsLeads,
        row.gadsContracts,
      ].some((value) => (value ?? 0) > 0)
    }
    const useFallback = !hasMetricsValue(latestMetrics) && !!fallback
    const data = useFallback && fallback ? null : latestMetrics
    const resolved = {
      ads_spend_total: resolveMetricValue(data?.adsSpendTotal ?? null, fallback?.adsSpend),
      meta_spend: resolveMetricValue(data?.metaSpend ?? null, fallback?.metaSpend),
      gads_spend: resolveMetricValue(data?.gadsSpend ?? null, fallback?.gadsSpend),
      meta_leads: resolveMetricValue(data?.metaLeads ?? null, fallback?.metaLeads),
      gads_leads: resolveMetricValue(data?.gadsLeads ?? null, fallback?.gadsLeads),
      crm_requests: resolveMetricValue(data?.crmRequests ?? null, fallback?.crmRequests),
      crm_contracts: resolveMetricValue(data?.crmContracts ?? null, fallback?.crmContracts),
      gads_contracts: resolveMetricValue(data?.gadsContracts ?? null, fallback?.gadsContracts),
      meta_paid_sum: resolveMetricValue(data?.metaPaidSum ?? null, fallback?.metaPaid),
      crm_paid_sum: resolveMetricValue(data?.crmPaidSum ?? null, fallback?.crmPaid),
    }
    const derived =
      useFallback ||
      (fallback != null &&
        [
          resolved.ads_spend_total !== (data?.adsSpendTotal ?? null),
          resolved.meta_spend !== (data?.metaSpend ?? null),
          resolved.gads_spend !== (data?.gadsSpend ?? null),
          resolved.meta_leads !== (data?.metaLeads ?? null),
          resolved.gads_leads !== (data?.gadsLeads ?? null),
          resolved.crm_requests !== (data?.crmRequests ?? null),
          resolved.crm_contracts !== (data?.crmContracts ?? null),
          resolved.gads_contracts !== (data?.gadsContracts ?? null),
          resolved.meta_paid_sum !== (data?.metaPaidSum ?? null),
          resolved.crm_paid_sum !== (data?.crmPaidSum ?? null),
        ].some(Boolean))
    if (!resolved) return { items: [], derived: false }
    return {
      derived,
      items: [
        {
          key: "ads_spend_total",
          label: "Ads spend total",
          value: formatCurrency(resolved.ads_spend_total),
          delta: metricsPeriodDeltas?.ads_spend_total ?? null,
        },
        {
          key: "meta_spend",
          label: "Meta spend",
          value: formatCurrency(resolved.meta_spend),
          delta: metricsPeriodDeltas?.meta_spend ?? null,
        },
        {
          key: "gads_spend",
          label: "GAds spend",
          value: formatCurrency(resolved.gads_spend),
          delta: metricsPeriodDeltas?.gads_spend ?? null,
        },
        {
          key: "meta_leads",
          label: "Meta leads",
          value: formatNumber(resolved.meta_leads),
          delta: metricsPeriodDeltas?.meta_leads ?? null,
        },
        {
          key: "gads_leads",
          label: "GAds leads",
          value: formatNumber(resolved.gads_leads),
          delta: metricsPeriodDeltas?.gads_leads ?? null,
        },
        {
          key: "crm_requests",
          label: "CRM requests",
          value: formatNumber(resolved.crm_requests),
          delta: metricsPeriodDeltas?.crm_requests ?? null,
        },
        {
          key: "crm_contracts",
          label: "CRM contracts",
          value: formatNumber(resolved.crm_contracts),
          delta: metricsPeriodDeltas?.crm_contracts ?? null,
        },
        {
          key: "gads_contracts",
          label: "GAds contracts",
          value: formatNumber(resolved.gads_contracts),
          delta: metricsPeriodDeltas?.gads_contracts ?? null,
        },
        {
          key: "meta_paid_sum",
          label: "Meta paid sum",
          value: formatCurrency(resolved.meta_paid_sum),
          delta: metricsPeriodDeltas?.meta_paid_sum ?? null,
        },
        {
          key: "crm_paid_sum",
          label: "CRM paid sum",
          value: formatCurrency(resolved.crm_paid_sum),
          delta: metricsPeriodDeltas?.crm_paid_sum ?? null,
        },
      ],
    }
  }, [latestMetrics, derivedMetrics, metricsPeriodDeltas])

  const ga4TrafficTimeline = useMemo(() => {
    const bucket = new Map<
      string,
      {
        date: string
        sessions: number
        totalUsers: number
        newUsers: number
        engagedSessions: number
        durationWeighted: number
      }
    >()
    ga4TrafficRows.forEach((row) => {
      const date = pickText(row, ["date_key", "day_key"], "")
      if (!date) return
      const sessions = pickNumber(row, ["sessions"])
      const users = pickNumber(row, ["total_users"])
      const newUsers = pickNumber(row, ["new_users"])
      const engaged = pickNumber(row, ["engaged_sessions"])
      const avgDuration = pickNumber(row, ["average_session_duration"])
      const entry =
        bucket.get(date) ?? { date, sessions: 0, totalUsers: 0, newUsers: 0, engagedSessions: 0, durationWeighted: 0 }
      entry.sessions += sessions
      entry.totalUsers += users
      entry.newUsers += newUsers
      entry.engagedSessions += engaged
      entry.durationWeighted += avgDuration * sessions
      bucket.set(date, entry)
    })
    return Array.from(bucket.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        date: row.date,
        sessions: row.sessions,
        totalUsers: row.totalUsers,
        newUsers: row.newUsers,
        engagedSessions: row.engagedSessions,
        engagementRate: row.sessions > 0 ? row.engagedSessions / row.sessions : 0,
        averageSessionDuration: row.sessions > 0 ? row.durationWeighted / row.sessions : 0,
      }))
  }, [ga4TrafficRows])

  const ga4TrafficSummary = useMemo(() => {
    if (!ga4TrafficTimeline.length) return null
    const totals = ga4TrafficTimeline.reduce(
      (acc, row) => {
        acc.sessions += row.sessions
        acc.totalUsers += row.totalUsers
        acc.newUsers += row.newUsers
        acc.engagedSessions += row.engagedSessions
        acc.durationWeighted += row.averageSessionDuration * row.sessions
        return acc
      },
      { sessions: 0, totalUsers: 0, newUsers: 0, engagedSessions: 0, durationWeighted: 0 }
    )
    const engagementRate = totals.sessions > 0 ? totals.engagedSessions / totals.sessions : null
    const avgDuration = totals.sessions > 0 ? totals.durationWeighted / totals.sessions : null
    return {
      ...totals,
      engagementRate,
      bounceRate: engagementRate == null ? null : Math.max(0, 1 - engagementRate),
      avgDuration,
    }
  }, [ga4TrafficTimeline])

  const ga4UtmTopRows = useMemo(() => {
    const buckets = new Map<
      string,
      {
        key: string
        campaign: string
        channel: string
        medium: string
        platform: string
        sessions: number
        users: number
        events: number
      }
    >()
    ga4UtmRows.forEach((row) => {
      const campaign = pickText(row, ["campaign"], "Unknown campaign")
      const channel = pickText(row, ["channel_group"], "unknown")
      const medium = pickText(row, ["medium"], "unknown")
      const platform = pickText(row, ["platform"], "unknown")
      const key = `${campaign}::${channel}::${medium}::${platform}`
      const entry =
        buckets.get(key) ?? {
          key,
          campaign,
          channel,
          medium,
          platform,
          sessions: 0,
          users: 0,
          events: 0,
        }
      entry.sessions += pickNumber(row, ["sessions"])
      entry.users += pickNumber(row, ["total_users"])
      entry.events += pickNumber(row, ["event_count"])
      buckets.set(key, entry)
    })
    return Array.from(buckets.values()).sort((a, b) => b.sessions - a.sessions)
  }, [ga4UtmRows])

  const ga4EventTopRows = useMemo(() => {
    const buckets = new Map<
      string,
      {
        eventName: string
        events: number
        conversions: number
        revenue: number
      }
    >()
    ga4EventsRows.forEach((row) => {
      const eventName = pickText(row, ["event_name"], "event")
      const entry = buckets.get(eventName) ?? { eventName, events: 0, conversions: 0, revenue: 0 }
      entry.events += pickNumber(row, ["event_count"])
      entry.conversions += pickNumber(row, ["conversions", "key_events_consultation"])
      entry.revenue += pickNumber(row, ["purchase_revenue"])
      buckets.set(eventName, entry)
    })
    return Array.from(buckets.values()).sort((a, b) => b.events - a.events)
  }, [ga4EventsRows])

  type Ga4CreativeSummary = { spend: number; clicks: number; impressions: number; users: number }

  const ga4CreativeSummary = useMemo<Ga4CreativeSummary | null>(() => {
    if (!ga4CreativeRows.length) return null
    return ga4CreativeRows.reduce<Ga4CreativeSummary>(
      (acc, row) => {
        acc.spend += pickNumber(row, ["spend"])
        acc.clicks += pickNumber(row, ["clicks"])
        acc.impressions += pickNumber(row, ["impressions"])
        acc.users += pickNumber(row, ["total_users"])
        return acc
      },
      { spend: 0, clicks: 0, impressions: 0, users: 0 }
    )
  }, [ga4CreativeRows])

  const ga4Freshness = useMemo(() => {
    const dates = [
      ...ga4TrafficRows.map((row) => pickText(row, ["date_key", "day_key"], "")),
      ...ga4UtmRows.map((row) => pickText(row, ["date_key", "day_key"], "")),
      ...ga4EventsRows.map((row) => pickText(row, ["date_key", "day_key"], "")),
    ].filter(Boolean)
    if (!dates.length) return null
    return dates.sort().at(-1) ?? null
  }, [ga4TrafficRows, ga4UtmRows, ga4EventsRows])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns & Sources"
        description="Кампанії, джерела та розподіл доходу за вибраний період."
      />

      <AnalyticsFilters
        value={draftFilters}
        onDateChange={(value) => setDraftFilters((prev) => ({ ...prev, dateRange: value }))}
        onCityChange={(value) => setDraftFilters((prev) => ({ ...prev, cityId: value }))}
        onProductChange={(value) => setDraftFilters((prev) => ({ ...prev, product: value }))}
        onBranchChange={(value) => setDraftFilters((prev) => ({ ...prev, branch: value }))}
        onSourceChange={(value) => setDraftFilters((prev) => ({ ...prev, source: value }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={loading}
        compact
        showCity
        showProduct
        showBranch
        showSource
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Quick range:</span>
        {[30, 60, 90, 120, 180].map((days) => (
          <Button
            key={days}
            size="sm"
            variant={rangeDays === days ? "secondary" : "outline"}
            onClick={() => applyQuickRange(days)}
          >
            {days}d
          </Button>
        ))}
      </div>

      {(ga4TrafficSummary || ga4UtmTopRows.length > 0 || ga4EventTopRows.length > 0 || ga4CreativeSummary) && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>GA4 Traffic Snapshot</CardTitle>
                <CardDescription>Прикладна аналітика трафіку та якості сесій для маркетингу.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {ga4Freshness && <Badge variant="outline">Freshness: {ga4Freshness}</Badge>}
                <Badge variant="secondary">{ga4TrafficRows.length + ga4UtmRows.length + ga4EventsRows.length} rows</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Sessions</div>
                  <div className="text-lg font-semibold">{formatNumber(ga4TrafficSummary?.sessions)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Users</div>
                  <div className="text-lg font-semibold">{formatNumber(ga4TrafficSummary?.totalUsers)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">New users</div>
                  <div className="text-lg font-semibold">{formatNumber(ga4TrafficSummary?.newUsers)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Engagement rate</div>
                  <div className="text-lg font-semibold">
                    {ga4TrafficSummary?.engagementRate == null ? "—" : formatPercent(ga4TrafficSummary.engagementRate)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Avg duration</div>
                  <div className="text-lg font-semibold">{formatDuration(ga4TrafficSummary?.avgDuration)}</div>
                </div>
              </div>
              {ga4TrafficTimeline.length > 1 && (
                <SafeResponsiveContainer width="100%" height={260}>
                  <LineChart data={ga4TrafficTimeline}>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis
                      dataKey="date"
                      {...chartAxisProps}
                      tickFormatter={(value) => formatShortDate(String(value))}
                    />
                    <YAxis yAxisId="left" {...chartAxisProps} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      {...chartAxisProps}
                      tickFormatter={(value) => formatPercent(Number(value))}
                    />
                    <Tooltip
                      labelFormatter={(value) => formatShortDate(String(value))}
                      formatter={(value, name) => [
                        name === "Engagement rate" ? formatPercent(Number(value)) : formatNumber(Number(value)),
                        name,
                      ]}
                      contentStyle={chartTooltipStyle}
                      itemStyle={chartTooltipItemStyle}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sessions"
                      stroke={CHART_COLORS.primary}
                      name="Sessions"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalUsers"
                      stroke={CHART_COLORS.secondary}
                      name="Users"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="engagementRate"
                      stroke={CHART_COLORS.quaternary}
                      name="Engagement rate"
                      strokeWidth={2}
                    />
                  </LineChart>
                </SafeResponsiveContainer>
              )}
              {renderInsightsBlock(aiInsightsByWidget["ga4.traffic_overview_daily"] ?? [], "GA4 Traffic", true)}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>GA4 UTM Touchpoints</CardTitle>
                <CardDescription>Топ кампаній/каналів за сесіями.</CardDescription>
              </CardHeader>
              <CardContent>
                {ga4UtmTopRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Нет данных GA4 UTM</div>
                ) : (
                  <div className="space-y-2">
                    {ga4UtmTopRows.slice(0, 8).map((row) => (
                      <div key={row.key} className="rounded-lg border p-3">
                        <div className="truncate text-sm font-semibold">{row.campaign}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {renderPlatformBadge(row.platform)}
                          <span>{row.channel}</span>
                          <span>{row.medium}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">Sessions {formatNumber(row.sessions)}</Badge>
                          <Badge variant="outline">Users {formatNumber(row.users)}</Badge>
                          <Badge variant="outline">Events {formatNumber(row.events)}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {renderInsightsBlock(aiInsightsByWidget["ga4.utm_daily"] ?? [], "GA4 UTM", true)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>GA4 Top Events</CardTitle>
                <CardDescription>Ключові конверсійні події та дохід.</CardDescription>
              </CardHeader>
              <CardContent>
                {ga4EventTopRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Нет данных по событиям</div>
                ) : (
                  <div className="space-y-2">
                    {ga4EventTopRows.slice(0, 8).map((row) => (
                      <div key={row.eventName} className="rounded-lg border p-3">
                        <div className="truncate text-sm font-semibold">{row.eventName}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">Events {formatNumber(row.events)}</Badge>
                          <Badge variant="outline">Conversions {formatNumber(row.conversions)}</Badge>
                          <Badge variant="outline">Revenue {formatCurrency(row.revenue)}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {ga4CreativeSummary && (
                  <div className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    Creative touchpoints: spend {formatCurrency(ga4CreativeSummary.spend)} · clicks {formatNumber(ga4CreativeSummary.clicks)} · impressions{" "}
                    {formatNumber(ga4CreativeSummary.impressions)}.
                  </div>
                )}
                {renderInsightsBlock(aiInsightsByWidget["ga4.events_conversions_daily"] ?? [], "GA4 Events", true)}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {(executiveSummaryResolved || metricsResolved.items.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {executiveSummaryResolved && (
            <Card>
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
                <CardDescription>
                  Підсумок ефективності маркетингу за період{periodLabel ? ` · ${periodLabel}` : ""}.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Spend</div>
                  <div className="text-lg font-semibold">{formatCurrency(executiveSummaryResolved.spend)}</div>
                  <div className="mt-1">{renderDeltaBadge(periodDeltas?.spend ?? null)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Revenue</div>
                  <div className="text-lg font-semibold">{formatCurrency(executiveSummaryResolved.revenue)}</div>
                  <div className="mt-1">{renderDeltaBadge(periodDeltas?.revenue ?? null)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Payments</div>
                  <div className="text-lg font-semibold">{formatCurrency(executiveSummaryResolved.payments)}</div>
                  <div className="mt-1">{renderDeltaBadge(periodDeltas?.payments ?? null)}</div>
                  {executiveSummaryResolved.prepayment != null &&
                    executiveSummaryResolved.prepayment > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Prepayment {formatCurrency(executiveSummaryResolved.prepayment)}
                      </div>
                    )}
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">ROAS</div>
                  <div className="text-lg font-semibold">{formatRatio(executiveSummaryResolved.roas)}</div>
                  <div className="mt-1">{renderDeltaBadge(ratioDeltas?.roas ?? null)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Payback</div>
                  <div className="text-lg font-semibold">
                    {executiveSummaryResolved.payback == null ? "—" : formatPercent(executiveSummaryResolved.payback)}
                  </div>
                  <div className="mt-1">{renderDeltaBadge(ratioDeltas?.payback ?? null)}</div>
                </div>
              </CardContent>
              {executiveSummaryResolved.derived && (
                <div className="px-6 pb-4 text-xs text-muted-foreground">
                  Частина підсумку доповнена з щоденних метрик/джерел для узгодження доходу та оплат.
                </div>
              )}
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Top Metrics</CardTitle>
                <CardDescription>
                  Ключевые показатели эффективности за период{periodLabel ? ` · ${periodLabel}` : ""}.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{metricsRows.length} rows</Badge>
                {metricsResolved.derived && <Badge variant="outline">Mixed sources</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {metricsResolved.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">Нет данных по метрикам</div>
              ) : (
                <div className="space-y-3">
                  {metricsResolved.derived && (
                    <div className="text-xs text-muted-foreground">
                      Частина метрик доповнена з campaigns.table для узгодження з доходом та оплатами.
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {metricsResolved.items.map((metric) => (
                    <div key={metric.label} className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">{metric.label}</div>
                      <div className="text-lg font-semibold">{metric.value}</div>
                      {renderDeltaBadge((metric as { delta?: number | null }).delta ?? null)}
                    </div>
                  ))}
                  </div>
                </div>
              )}
              {renderInsightsBlock(
                aiInsightsByWidget["campaigns.top_metrics"] ?? [],
                "Top Metrics",
                true
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {(coverageSummary || attributionStatus) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {coverageSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Data coverage</CardTitle>
                <CardDescription>Частка кампаній з договорами та оплатами.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Total campaigns</span>
                  <span className="font-semibold">{coverageSummary.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>With contracts</span>
                  <span className="font-semibold">
                    {formatPercent(coverageSummary.contractsPct, { assumeRatio: false })} · {coverageSummary.withContracts}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>With payments</span>
                  <span className="font-semibold">
                    {formatPercent(coverageSummary.paymentsPct, { assumeRatio: false })} · {coverageSummary.withPayments}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>With revenue</span>
                  <span className="font-semibold">
                    {formatPercent(coverageSummary.revenuePct, { assumeRatio: false })} · {coverageSummary.withRevenue}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Lead → Contract</span>
                  <span className="font-semibold">
                    {formatPercent(coverageSummary.leadToContractPct, { assumeRatio: false })}
                  </span>
                </div>
                <div className="pt-2 text-xs text-muted-foreground">
                  Attribution lag: договори можуть зʼявлятися після періоду лідов. Рекомендуємо 90–120 днів.
                </div>
              </CardContent>
            </Card>
          )}

          {attributionStatus && (
            <Card>
              <CardHeader>
                <CardTitle>Attribution status</CardTitle>
                <CardDescription>Якість атрибуції платного трафіку.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={attributionStatus.variant}>{attributionStatus.label}</Badge>
                  <span className="text-muted-foreground">{attributionStatus.description}</span>
                </div>
                {coverageSummary && (
                  <div className="text-xs text-muted-foreground">
                    Contracts coverage {formatPercent(coverageSummary.contractsPct, { assumeRatio: false })} · Payments coverage{" "}
                    {formatPercent(coverageSummary.paymentsPct, { assumeRatio: false })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {campaignsTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payments & Contracts ({rangeDays ?? 90}d)</CardTitle>
            <CardDescription>Динаміка оплат та кількості договорів · {timelineGranularity.toLowerCase()} trend.</CardDescription>
          </CardHeader>
          <CardContent>
            <SafeResponsiveContainer width="100%" height={320}>
              <LineChart data={timelineSeries}>
                <CartesianGrid {...chartGridProps} />
                <XAxis
                  dataKey="date"
                  {...chartAxisProps}
                  tickFormatter={(value) => formatShortDate(String(value))}
                />
                <YAxis yAxisId="left" {...chartAxisProps} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  {...chartAxisProps}
                  tickFormatter={(value) => formatCurrency(Number(value))}
                />
                <Tooltip
                  labelFormatter={(value) => formatShortDate(String(value))}
                  formatter={(value, name) => [
                    name === "Payments" ? formatCurrency(Number(value)) : formatNumber(Number(value)),
                    name,
                  ]}
                  contentStyle={chartTooltipStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="contracts"
                  stroke={CHART_COLORS.secondary}
                  name="Contracts"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="contracts_trend"
                  stroke={CHART_COLORS.secondary}
                  name="Contracts trend"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="payments"
                  stroke={CHART_COLORS.primary}
                  name="Payments"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="payments_trend"
                  stroke={CHART_COLORS.primary}
                  name="Payments trend"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              </LineChart>
            </SafeResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {campaignsTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Spend ({rangeDays ?? 90}d)</CardTitle>
            <CardDescription>Порівняння витрат і суми договорів · {timelineGranularity.toLowerCase()} trend.</CardDescription>
          </CardHeader>
          <CardContent>
            <SafeResponsiveContainer width="100%" height={320}>
              <LineChart data={timelineSeries}>
                <CartesianGrid {...chartGridProps} />
                <XAxis
                  dataKey="date"
                  {...chartAxisProps}
                  tickFormatter={(value) => formatShortDate(String(value))}
                />
                <YAxis yAxisId="left" {...chartAxisProps} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  {...chartAxisProps}
                  tickFormatter={(value) => formatCurrency(Number(value))}
                />
                <Tooltip
                  labelFormatter={(value) => formatShortDate(String(value))}
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    name === "revenue" ? "Revenue" : "Spend",
                  ]}
                  contentStyle={chartTooltipStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="spend"
                  stroke={CHART_COLORS.primary}
                  name="Spend"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="spend_trend"
                  stroke={CHART_COLORS.primary}
                  name="Spend trend"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_COLORS.quaternary}
                  name="Revenue"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue_trend"
                  stroke={CHART_COLORS.quaternary}
                  name="Revenue trend"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              </LineChart>
            </SafeResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasLoaded && !loading && !hasData && (
        <AnalyticsEmptyState
          context="campaigns_sources"
          title="Нет данных по кампаниям"
          description="Подключите рекламные платформы и источники, чтобы видеть эффективность."
          connectionGate
          className="max-w-3xl mx-auto"
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>Фокус на витратах, сумі договорів, оплатах та ефективності.</CardDescription>
              {platformSummary.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {platformSummary.slice(0, 4).map(([platform, count]) => (
                    <Badge key={platform} variant="outline" className="text-[10px]">
                      {platform} · {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{campaignRollups.length} rows</Badge>
              <Badge variant={getCoverageBadge(campaignCoverage).variant}>
                {getCoverageBadge(campaignCoverage).label}
              </Badge>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={campaignSort}
                onChange={(event) => setCampaignSort(event.target.value as "spend" | "revenue" | "contracts")}
              >
                <option value="spend">Sort: Spend</option>
                <option value="revenue">Sort: Revenue</option>
                <option value="contracts">Sort: Contracts</option>
              </select>
              {campaignRollups.length > 8 && (
                <Button size="sm" variant="outline" onClick={() => setShowAllCampaigns((prev) => !prev)}>
                  {showAllCampaigns ? "Collapse" : "Show all"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {campaignRollups.length === 0 ? (
              <div className="text-sm text-muted-foreground">Нет данных по кампаниям</div>
            ) : (
              <div className="space-y-2">
                {(showAllCampaigns ? sortedCampaignRows : campaignDisplayRows).map((row, index) => {
                  const name =
                    (row.campaign_name as string | null) ??
                    "Campaign"
                  const platform = (row.platform as string | null) ?? (row.channel as string | null) ?? "—"
                  const spend = pickNumber(row, ["spend"])
                  const impressions = toNumber(row.impressions)
                  const clicks = toNumber(row.clicks)
                  const ctr = impressions && clicks ? clicks / impressions : null
                  const cpm = impressions ? (spend / impressions) * 1000 : null
                  const cpc = clicks ? spend / clicks : null
                  const contracts = pickNumber(row, ["contracts"])
                  const revenue = pickNumber(row, ["revenue"])
                  const payments = pickNumber(row, ["payments"])
                  const prepayment = pickNumber(row, ["prepayment"])
                  const paybackRate = toNumber((row as { paybackRate?: number | null }).paybackRate)
                  const cpa = toNumber((row as { cpa?: number | null }).cpa) ?? (contracts > 0 ? spend / contracts : null)
                  const roas = toNumber((row as { roas?: number | null }).roas) ?? (spend > 0 ? revenue / spend : null)
                  const leads = pickNumber(row, ["leads"])
                  const cpl = toNumber((row as { cpl?: number | null }).cpl) ?? (leads > 0 ? spend / leads : null)
                  return (
                    <div key={`${row.campaign_id ?? name}-${index}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {renderPlatformBadge(platform)}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatCurrency(spend)}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Contract value</div>
                          <div className="font-semibold">{formatCurrency(revenue)}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Payments</div>
                          <div className="font-semibold">{formatCurrency(payments)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Leads {formatNumber(leads)}</span>
                        <span>Contracts {formatNumber(contracts)}</span>
                        <span>ROAS {formatRatio(roas)}</span>
                        <span>CPL {formatCurrency(cpl)}</span>
                        <span>CPA {formatCurrency(cpa)}</span>
                        {paybackRate != null && (
                          <span>Payback {formatPercent(paybackRate)}</span>
                        )}
                        {revenue > 0 && payments === 0 && (
                          <Badge variant="warning" className="text-[10px]">
                            No payments yet
                          </Badge>
                        )}
                        {prepayment > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            Prepayment {formatCurrency(prepayment)}
                          </Badge>
                        )}
                        {ctr != null && (
                          <Badge variant="outline" className="text-[10px]">
                            CTR {formatPercent(ctr)}
                          </Badge>
                        )}
                        {cpc != null && (
                          <Badge variant="outline" className="text-[10px]">
                            CPC {formatCurrency(cpc)}
                          </Badge>
                        )}
                        {cpm != null && (
                          <Badge variant="outline" className="text-[10px]">
                            CPM {formatCurrency(cpm)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              <div className="text-xs text-muted-foreground">
                Payments показывают подтвержденные оплаты в периоде. Предоплаты могут учитываться отдельно.
              </div>
              {renderInsightsBlock(
                aiInsightsByWidget["campaigns.table"] ?? [],
                "Campaign Performance",
                true
              )}
            </div>
          )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>AI Аналіз Кампаній</CardTitle>
            <div className="flex flex-wrap gap-2">
              {AI_WIDGETS.map((widget) => (
	                <Button
	                  key={widget.key}
	                  size="sm"
	                  variant={activeAiWidget === widget.key ? "default" : "outline"}
	                  onClick={() => setActiveAiWidget(widget.key)}
	                >
                  {widget.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Обраний віджет:{" "}
              <span className="font-medium text-foreground">
                {AI_WIDGETS.find((widget) => widget.key === activeAiWidget)?.label ?? activeAiWidget}
              </span>
            </div>
            {aiLoading ? (
              <div className="text-sm text-muted-foreground">Завантаження інсайтів...</div>
            ) : activeInsights.length === 0 ? (
              <AnalyticsEmptyState
                title="Немає AI інсайтів"
                description="Після оновлення витрин зʼявляться рекомендації."
                context="campaigns_sources"
                size="sm"
              />
            ) : (
              activeInsights.slice(0, 6).map((insight, index) => {
                const title = (insight.title as string | null) ?? "AI Інсайт"
                const summary = (insight.summary as string | null) ?? ""
                const tone = getInsightTone(insight.severity)
                const confidence = typeof insight.confidence === "number" ? insight.confidence : null
                return (
                  <div
                    key={`${title}-${index}`}
                    className="rounded-xl border border-border bg-card/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{title}</span>
                      <Badge variant={tone.variant}>{tone.label}</Badge>
                    </div>
                    {summary && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Widget: {AI_WIDGETS.find((widget) => widget.key === activeAiWidget)?.label ?? activeAiWidget}</span>
                      {confidence != null && <span>Confidence {(confidence * 100).toFixed(0)}%</span>}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Campaign Inventory</CardTitle>
              <CardDescription>Все кампании с продуктом, активностью и результатами.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{filteredInventoryRows.length} rows</Badge>
              {filteredInventoryRows.length > 8 && (
                <Button size="sm" variant="outline" onClick={() => setShowAllInventory((prev) => !prev)}>
                  {showAllInventory ? "Collapse" : "Show all"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredInventoryRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Нет данных по инвентарю кампаний. Проверьте синхронизацию рекламных кабинетов или увеличьте период.
              </div>
            ) : (
              <div className="space-y-2">
                {(showAllInventory ? filteredInventoryRows : inventoryDisplayRows).map((row, index) => {
                  const name = (row.campaign_name as string | null) ?? `Campaign ${row.campaign_id ?? index + 1}`
                  const platform = (row.platform as string | null) ?? (row.channel as string | null) ?? "—"
                  const product =
                    (row.product_intent_primary as string | null) ??
                    (row.product_name as string | null) ??
                    "Unknown product"
                  const spend = pickNumber(row, ["spend"])
                  const leads = pickNumber(row, ["platform_leads", "leads_platform", "leads", "leads_cnt"])
                  const requests = pickNumber(row, ["crm_requests_cnt", "requests_crm", "requests", "requests_cnt"])
                  const contracts = pickNumber(row, ["contracts_cnt", "contracts"])
                  const revenue = pickNumber(row, ["revenue_total_cost", "revenue_sum", "contracts_sum"])
                  const payments = pickNumber(row, ["payments_sum", "paid_sum"])
                  const prepayment = pickNumber(row, ["prepayment_sum", "prepayment"])
                  return (
                    <div key={`${row.campaign_id ?? name}-${index}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {renderPlatformBadge(platform)}
                            <span className="truncate">Product: {product}</span>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatCurrency(spend)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Leads {formatNumber(leads)}</span>
                        <span>Requests {formatNumber(requests)}</span>
                        <span>Contracts {formatNumber(contracts)}</span>
                        <span>Revenue {formatCurrency(revenue)}</span>
                        <span>Payments {formatCurrency(payments)}</span>
                        {prepayment > 0 && <span>Prepayment {formatCurrency(prepayment)}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {renderInsightsBlock(
              aiInsightsByWidget["campaigns.inventory_daily_city"] ?? [],
              "Campaign Inventory",
              true
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Offline & Unknown Sources</CardTitle>
              <CardDescription>Офлайн та інші джерела, що дають контракти.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{filteredOfflineRows.length} rows</Badge>
              {filteredOfflineRows.length > 8 && (
                <Button size="sm" variant="outline" onClick={() => setShowAllOffline((prev) => !prev)}>
                  {showAllOffline ? "Collapse" : "Show all"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredOfflineRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Нет данных по офлайн источникам</div>
            ) : (
              <div className="space-y-2">
                {(showAllOffline ? filteredOfflineRows : filteredOfflineRows.slice(0, 8)).map((row, index) => {
	                  const sourceLabel = pickText(row as WidgetRow & { _label?: string }, ["_label"], "Source")
	                  const owner = pickText(row as WidgetRow & { _owner?: string }, ["_owner"], "—")
	                  const leads = toNumber(row.leads_cnt) ?? 0
	                  const contracts = toNumber(row.contracts_cnt) ?? 0
	                  const revenue = toNumber(row.revenue_sum) ?? 0
	                  const payments = toNumber(row.payments_sum) ?? 0
	                  const prepayment = pickNumber(row, ["prepayment_sum", "prepayment"])
	                  const share = offlineTotals.revenue > 0 ? revenue / offlineTotals.revenue : null
	                  const spend = toNumber((row as { spend?: number | string | null }).spend) ?? 0
	                  const roas =
	                    toNumber((row as { roas?: number | string | null }).roas) ??
	                    (spend > 0 ? revenue / spend : null)
	                  const paybackRate = toNumber((row as { payback_rate?: number | string | null }).payback_rate)
	                  return (
                    <div key={`${sourceLabel}-${index}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{sourceLabel}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {owner ? `Owner: ${owner}` : "Owner: —"}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Revenue</div>
                          <div className="font-semibold">{formatCurrency(revenue)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Leads {formatNumber(leads)}</span>
                        <span>Contracts {formatNumber(contracts)}</span>
                        <span>Revenue {formatCurrency(revenue)}</span>
                        <span>Payments {formatCurrency(payments)}</span>
                        {prepayment > 0 && <span>Prepayment {formatCurrency(prepayment)}</span>}
                        {share != null && <span>Share {formatPercent(share)}</span>}
                        {roas != null && <span>ROAS {roas.toFixed(2)}</span>}
                        {paybackRate != null && <span>Payback {(paybackRate * 100).toFixed(1)}%</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {renderInsightsBlock(
              aiInsightsByWidget["marketing.offline_sources_active"] ?? [],
              "Offline & Unknown",
              true
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Revenue by Source</CardTitle>
              <CardDescription>Вклад каждого источника в общий доход.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{sortedRevenueRows.length} rows</Badge>
              <Badge variant={getCoverageBadge(revenueCoverage).variant}>
                {getCoverageBadge(revenueCoverage).label}
              </Badge>
              {sortedRevenueRows.length > 8 && (
                <Button size="sm" variant="outline" onClick={() => setShowAllSources((prev) => !prev)}>
                  {showAllSources ? "Collapse" : "Show all"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {sortedRevenueRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Нет данных по источникам</div>
            ) : (
              <div className="space-y-2">
                {(showAllSources ? sortedRevenueRows : sortedRevenueRows.slice(0, 8)).map((row, index) => {
                  const sourceName = pickText(row as WidgetRow & { _label?: string }, ["_label"], "Source")
                  const sourceOwner = pickText(row as WidgetRow & { _owner?: string }, ["_owner"], "")
                  const sourceMeta = pickText(row as WidgetRow & { _meta?: string }, ["_meta"], "")
                  const revenue = pickNumber(row, ["contracts_sum", "revenue_sum"])
                  const payments = pickNumber(row, ["payments_sum", "paid_sum"])
                  const prepayment = pickNumber(row, ["prepayment_sum", "prepayment"])
                  const contracts = pickNumber(row, ["contracts_cnt"])
                  const payback = revenue > 0 ? payments / revenue : null
                  const share = totalRevenueSum > 0 ? revenue / totalRevenueSum : null
                  return (
                    <div key={`${sourceName}-${index}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{sourceName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {[sourceMeta ? `Type: ${sourceMeta}` : "", sourceOwner ? `Owner: ${sourceOwner}` : ""].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Contracts</div>
                          <div className="font-semibold">{formatNumber(contracts)}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Revenue</div>
                          <div className="font-semibold">{formatCurrency(revenue)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Payments {formatCurrency(payments)}</span>
                        {prepayment > 0 && <span>Prepayment {formatCurrency(prepayment)}</span>}
                        {share != null && (
                          <Badge variant="outline" className="text-[10px]">
                            Share {formatPercent(share)}
                          </Badge>
                        )}
                        {payback != null && (
                          <Badge variant="outline" className="text-[10px]">
                            Payback {formatPercent(payback)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {renderInsightsBlock(
              aiInsightsByWidget["sources.revenue_split"] ?? [],
              "Revenue by Source",
              true
            )}
          </CardContent>
        </Card>

      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>CRM Sources Performance</CardTitle>
            <CardDescription>Ліди, контракти та дохід за джерелами CRM.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{sortedSourcePerfRows.length} rows</Badge>
            <Button
              size="sm"
              variant={showZeroCrmSources ? "secondary" : "outline"}
              onClick={() => setShowZeroCrmSources((prev) => !prev)}
            >
              {showZeroCrmSources ? "Hide zero sources" : "Show zero sources"}
            </Button>
            {sortedSourcePerfRows.length > 8 && (
              <Button size="sm" variant="outline" onClick={() => setShowAllSourcePerf((prev) => !prev)}>
                {showAllSourcePerf ? "Collapse" : "Show all"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sortedSourcePerfRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Нет данных по CRM источникам</div>
          ) : (
            <div className="space-y-2">
              {(showAllSourcePerf ? sortedSourcePerfRows : sortedSourcePerfRows.slice(0, 8)).map((row, index) => {
                const label = pickText(row as WidgetRow & { _label?: string }, ["_label"], "Unknown source")
                const owner = pickText(row as WidgetRow & { _owner?: string }, ["_owner"], "—")
                const typeLabel = pickText(row as WidgetRow & { _type?: string }, ["_type"], "")
                const meta = [typeLabel ? `Type: ${typeLabel}` : "", owner ? `Owner: ${owner}` : ""]
                  .filter(Boolean)
                  .join(" · ")
                const leads = pickNumber(row, ["leads_cnt"])
                const contracts = pickNumber(row, ["contracts_cnt"])
                const revenue = pickNumber(row, ["revenue", "revenue_sum", "contracts_sum"])
                const payments = pickNumber(row, ["payments_sum", "paid_sum"])
                const prepayment = pickNumber(row, ["prepayment_sum", "prepayment"])
                const share = crmSourceTotals.revenue > 0 ? revenue / crmSourceTotals.revenue : null
                const avgContract = contracts > 0 ? revenue / contracts : null
                const leadToContract = leads > 0 ? contracts / leads : null
                return (
                  <div key={`${row.id_source ?? label}-${index}`} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{meta || "—"}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">Leads {formatNumber(leads)}</Badge>
                        <Badge variant="outline">Contracts {formatNumber(contracts)}</Badge>
                        <Badge variant="outline">Revenue {formatCurrency(revenue)}</Badge>
                        <Badge variant="outline">Payments {formatCurrency(payments)}</Badge>
                        {prepayment > 0 && (
                          <Badge variant="outline">Prepayment {formatCurrency(prepayment)}</Badge>
                        )}
                        {share != null && (
                          <Badge variant="outline" className="text-[10px]">
                            Share {formatPercent(share)}
                          </Badge>
                        )}
                        {avgContract != null && (
                          <Badge variant="outline" className="text-[10px]">
                            Avg {formatCurrency(avgContract)}
                          </Badge>
                        )}
                        {leadToContract != null && (
                          <Badge variant="outline" className="text-[10px]">
                            L→C {formatPercent(leadToContract)}
                          </Badge>
                        )}
                      </div>
                      {share != null && (
                        <div className="mt-3 h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${Math.min(100, Math.max(2, share * 100))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {renderInsightsBlock(
            aiInsightsByWidget["crm.sources_performance_daily"] ?? [],
            "CRM Sources",
            true
          )}
        </CardContent>
      </Card>
    </div>
  )
}
