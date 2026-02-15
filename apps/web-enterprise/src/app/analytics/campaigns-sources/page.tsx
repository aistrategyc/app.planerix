"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchInsights, fetchWidgetsBatch, fetchWidgetRange, WidgetRow } from "@/lib/api/analytics-widgets"
import { WidgetTable } from "@/components/analytics/WidgetTable"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { buildLastWeekRange } from "@/app/analytics/utils/defaults"
import { useAuth } from "@/contexts/auth-context"
import { PageHeader } from "@/components/layout/PageHeader"

const toDateInput = (value: Date) => value.toISOString().slice(0, 10)

const shiftDate = (value: string, days: number) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const formatCurrency = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("uk-UA", { style: "currency", currency: "UAH" })

const formatNumber = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("uk-UA"))

const formatRatio = (value: number | null | undefined) => (value == null ? "—" : value.toFixed(2))

const formatPercent = (value: number | null | undefined) => (value == null ? "—" : `${value.toFixed(2)}%`)

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const normalizeKey = (value?: string | null) =>
  value ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : ""

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

const getCoverageBadge = (ratio: number | null) => {
  if (ratio == null) return { label: "No coverage", variant: "outline" as const }
  if (ratio >= 0.4) return { label: "High coverage", variant: "success" as const }
  if (ratio >= 0.2) return { label: "Medium coverage", variant: "warning" as const }
  return { label: "Low coverage", variant: "destructive" as const }
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

export default function CampaignsSourcesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { cities } = useCities()
  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 6)
    return date
  }, [])

  const initialFilters = useMemo<AnalyticsFiltersValue>(
    () => ({
      dateRange: { from: defaultFrom, to: today },
      cityId: "all",
      platform: "all",
      product: "",
      branch: "",
      source: "",
    }),
    [defaultFrom, today]
  )
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersValue>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFiltersValue>(initialFilters)

  const [campaignRows, setCampaignRows] = useState<WidgetRow[]>([])
  const [inventoryRows, setInventoryRows] = useState<WidgetRow[]>([])
  const [revenueRows, setRevenueRows] = useState<WidgetRow[]>([])
  const [metricsRows, setMetricsRows] = useState<WidgetRow[]>([])
  const [sourcePerfRows, setSourcePerfRows] = useState<WidgetRow[]>([])
  const [offlineRows, setOfflineRows] = useState<WidgetRow[]>([])
  const [aiInsights, setAiInsights] = useState<WidgetRow[]>([])

  const [activeAiWidget, setActiveAiWidget] = useState("campaigns.table")
  const [showAllCampaigns, setShowAllCampaigns] = useState(false)
  const [showAllInventory, setShowAllInventory] = useState(false)
  const [showAllSources, setShowAllSources] = useState(false)
  const [showAllSourcePerf, setShowAllSourcePerf] = useState(false)
  const [showAllOffline, setShowAllOffline] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const hasData =
    campaignRows.length > 0 ||
    inventoryRows.length > 0 ||
    revenueRows.length > 0 ||
    metricsRows.length > 0 ||
    sourcePerfRows.length > 0 ||
    offlineRows.length > 0

  const filters = {
    date_from: appliedFilters.dateRange.from ? toDateInput(appliedFilters.dateRange.from) : undefined,
    date_to: appliedFilters.dateRange.to ? toDateInput(appliedFilters.dateRange.to) : undefined,
    id_city: appliedFilters.cityId !== "all" ? Number(appliedFilters.cityId) : undefined,
    platform: appliedFilters.platform !== "all" ? appliedFilters.platform : undefined,
    product: appliedFilters.product || undefined,
    branch: appliedFilters.branch || undefined,
    source: appliedFilters.source || undefined,
  }

  const fetchCampaignsWidgets = async () => {
    if (!isAuthenticated || authLoading) return
    setLoading(true)
    try {
      const batch = await fetchWidgetsBatch({
        global_filters: filters,
        widgets: [
          { widget_key: "campaigns.table", limit: 200 },
          { widget_key: "campaigns.inventory_daily_city", limit: 200, order_by: "-spend" },
          { widget_key: "sources.revenue_split" },
          { widget_key: "campaigns.top_metrics" },
          { widget_key: "crm.sources_performance_daily", limit: 200, order_by: "-leads_cnt" },
          { widget_key: "marketing.offline_sources_active", limit: 200, order_by: "-revenue_sum" },
        ],
      })
      setCampaignRows(batch.items["campaigns.table"]?.items ?? [])
      setInventoryRows(batch.items["campaigns.inventory_daily_city"]?.items ?? [])
      setRevenueRows(batch.items["sources.revenue_split"]?.items ?? [])
      setMetricsRows(batch.items["campaigns.top_metrics"]?.items ?? [])
      setSourcePerfRows(batch.items["crm.sources_performance_daily"]?.items ?? [])
      setOfflineRows(batch.items["marketing.offline_sources_active"]?.items ?? [])
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }

  const fetchInsightsForWidget = async (widgetKey: string) => {
    if (!isAuthenticated || authLoading) return
    const insights = await fetchInsights(widgetKey, {
      limit: 20,
      date_from: filters.date_from,
      date_to: filters.date_to,
      id_city: filters.id_city,
    })
    setAiInsights(insights.items)
  }

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    fetchCampaignsWidgets()
  }, [appliedFilters, isAuthenticated, authLoading])

  useEffect(() => {
    let active = true
    const hydrateRange = async () => {
      try {
        if (!isAuthenticated || authLoading) return
        const range = await fetchWidgetRange("campaigns.table")
        if (!active || !range.max_date) return
        const maxDate = range.max_date.slice(0, 10)
        const fromDate = shiftDate(maxDate, -6)
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
    fetchInsightsForWidget(activeAiWidget)
  }, [activeAiWidget, appliedFilters, isAuthenticated, authLoading])

  const resetFilters = () => {
    const resetValue: AnalyticsFiltersValue = {
      ...initialFilters,
      cityId: "all",
    }
    setDraftFilters(resetValue)
    setAppliedFilters(resetValue)
  }

  const applyFilters = () => {
    setAppliedFilters(draftFilters)
  }

  const filteredCampaignRows = useMemo(() => {
    return campaignRows.filter((row) => {
      const name = row.campaign_name ?? row.campaign_id
      if (!name) return false
      const spend = toNumber(row.spend) ?? 0
      const revenue = toNumber(row.revenue) ?? 0
      const leads = toNumber(row.leads) ?? 0
      const contracts = toNumber(row.contracts) ?? 0
      return spend > 0 || revenue > 0 || leads > 0 || contracts > 0
    })
  }, [campaignRows])

  const campaignCoverage = useMemo(() => {
    if (!filteredCampaignRows.length) return null
    const withContracts = filteredCampaignRows.filter((row) => (toNumber(row.contracts) ?? 0) > 0).length
    return withContracts / filteredCampaignRows.length
  }, [filteredCampaignRows])

  const filteredRevenueRows = useMemo(() => {
    return revenueRows.filter((row) => {
      const name = row.source_name ?? row.source_user_name ?? row.source_type_name
      if (!name) return false
      const contractsSum = toNumber(row.contracts_sum) ?? 0
      const paidSum = toNumber(row.paid_sum) ?? 0
      return contractsSum > 0 || paidSum > 0
    })
  }, [revenueRows])

  const filteredInventoryRows = useMemo(() => {
    return inventoryRows.filter((row) => {
      const name = row.campaign_name ?? row.campaign_id
      if (!name) return false
      const spend = toNumber(row.spend) ?? 0
      const leads = toNumber(row.leads_platform ?? row.leads) ?? 0
      const contracts = toNumber(row.contracts_cnt) ?? toNumber(row.contracts) ?? 0
      const payments = toNumber(row.payments_sum) ?? 0
      return spend > 0 || leads > 0 || contracts > 0 || payments > 0
    })
  }, [inventoryRows])

  const filteredOfflineRows = useMemo(() => {
    return offlineRows.filter((row) => {
      const label = row.source_name ?? row.event_name ?? row.promo_name ?? row.source ?? row.source_type
      if (!label) return false
      const leads = toNumber(row.leads_cnt) ?? 0
      const contracts = toNumber(row.contracts_cnt) ?? 0
      const revenue = toNumber(row.revenue_sum) ?? 0
      const payments = toNumber(row.payments_sum) ?? 0
      return leads > 0 || contracts > 0 || revenue > 0 || payments > 0
    })
  }, [offlineRows])

  const filteredSourcePerfRows = useMemo(() => {
    return sourcePerfRows.filter((row) => {
      const name = row.source_type ?? row.source_owner ?? row.id_source
      if (!name) return false
      const leads = toNumber(row.leads_cnt) ?? 0
      const contracts = toNumber(row.contracts_cnt) ?? 0
      const revenue = toNumber(row.revenue) ?? 0
      return leads > 0 || contracts > 0 || revenue > 0
    })
  }, [sourcePerfRows])

  const totalRevenueSum = useMemo(() => {
    return filteredRevenueRows.reduce((acc, row) => acc + (toNumber(row.contracts_sum) ?? 0), 0)
  }, [filteredRevenueRows])

  const revenueCoverage = useMemo(() => {
    if (!filteredRevenueRows.length) return null
    const totals = filteredRevenueRows.reduce(
      (acc, row) => {
        acc.contractsSum += toNumber(row.contracts_sum) ?? 0
        acc.paidSum += toNumber(row.paid_sum) ?? 0
        return acc
      },
      { contractsSum: 0, paidSum: 0 }
    )
    return totals.contractsSum > 0 ? totals.paidSum / totals.contractsSum : null
  }, [filteredRevenueRows])

  const latestMetrics = useMemo(() => {
    if (!metricsRows.length) return null
    const sorted = [...metricsRows].sort((a, b) => String(b.date_key).localeCompare(String(a.date_key)))
    const hasValue = (row: WidgetRow) => {
      const values = [
        row.ads_spend_total,
        row.meta_spend,
        row.gads_spend,
        row.meta_paid_sum,
        row.crm_paid_sum,
        row.crm_contracts,
        row.crm_requests,
      ]
      return values.some((value) => (toNumber(value) ?? 0) > 0)
    }
    return sorted.find(hasValue) ?? sorted[0]
  }, [metricsRows])

  const metricsCards = useMemo(() => {
    if (!latestMetrics) return []
    return [
      { label: "Ads spend total", value: formatCurrency(toNumber(latestMetrics.ads_spend_total)) },
      { label: "Meta spend", value: formatCurrency(toNumber(latestMetrics.meta_spend)) },
      { label: "GAds spend", value: formatCurrency(toNumber(latestMetrics.gads_spend)) },
      { label: "Meta leads", value: formatNumber(toNumber(latestMetrics.meta_leads)) },
      { label: "CRM requests", value: formatNumber(toNumber(latestMetrics.crm_requests)) },
      { label: "CRM contracts", value: formatNumber(toNumber(latestMetrics.crm_contracts)) },
      { label: "Meta paid sum", value: formatCurrency(toNumber(latestMetrics.meta_paid_sum)) },
      { label: "CRM paid sum", value: formatCurrency(toNumber(latestMetrics.crm_paid_sum)) },
    ]
  }, [latestMetrics])

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
        onPlatformChange={(value) => setDraftFilters((prev) => ({ ...prev, platform: value }))}
        onProductChange={(value) => setDraftFilters((prev) => ({ ...prev, product: value }))}
        onBranchChange={(value) => setDraftFilters((prev) => ({ ...prev, branch: value }))}
        onSourceChange={(value) => setDraftFilters((prev) => ({ ...prev, source: value }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={loading}
        compact
        showCity
        showPlatform={false}
        showProduct
        showBranch
        showSource
      />

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
              <CardDescription>Фокус на витратах, доході та ефективності.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{filteredCampaignRows.length} rows</Badge>
              <Badge variant={getCoverageBadge(campaignCoverage).variant}>
                {getCoverageBadge(campaignCoverage).label}
              </Badge>
              {filteredCampaignRows.length > 8 && (
                <Button size="sm" variant="outline" onClick={() => setShowAllCampaigns((prev) => !prev)}>
                  {showAllCampaigns ? "Collapse" : "Show all"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredCampaignRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Нет данных по кампаниям</div>
            ) : (
              <div className="space-y-2">
                {(showAllCampaigns ? filteredCampaignRows : filteredCampaignRows.slice(0, 8)).map((row, index) => {
                  const name =
                    (row.campaign_name as string | null) ??
                    "Campaign"
                  const channel = (row.channel as string | null) ?? "—"
                  const spend = toNumber(row.spend) ?? 0
                  const impressions = toNumber(row.impressions)
                  const clicks = toNumber(row.clicks)
                  const ctr = impressions && clicks ? (clicks / impressions) * 100 : null
                  const cpm = impressions ? (spend / impressions) * 1000 : null
                  const cpc = clicks ? spend / clicks : null
                  const cpa =
                    toNumber(row.cpa) ??
                    ((toNumber(row.contracts) ?? 0) > 0 ? spend / (toNumber(row.contracts) ?? 1) : null)
                  return (
                    <div key={`${row.campaign_id ?? name}-${index}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {renderPlatformBadge(channel)}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatCurrency(spend)}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Revenue</div>
                          <div className="font-semibold">{formatCurrency(toNumber(row.revenue))}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Leads {formatNumber(toNumber(row.leads))}</span>
                        <span>Contracts {formatNumber(toNumber(row.contracts))}</span>
                        <span>ROAS {formatRatio(toNumber(row.roas))}</span>
                        <span>CPL {formatCurrency(toNumber(row.cpl))}</span>
                        <span>CPA {formatCurrency(cpa)}</span>
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>AI Аналіз Кампаній</CardTitle>
            <div className="flex flex-wrap gap-2">
              {[
                "campaigns.table",
                "campaigns.inventory_daily_city",
                "sources.revenue_split",
                "marketing.offline_sources_active",
              ].map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={activeAiWidget === key ? "default" : "outline"}
                  onClick={() => setActiveAiWidget(key)}
                >
                  {key}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiInsights.length === 0 ? (
              <AnalyticsEmptyState
                title="Немає AI інсайтів"
                description="Після оновлення витрин зʼявляться рекомендації."
                context="campaigns_sources"
                size="sm"
              />
            ) : (
              aiInsights.slice(0, 6).map((insight, index) => {
                const title = (insight.title as string | null) ?? "AI Інсайт"
                const summary = (insight.summary as string | null) ?? ""
                const tone = getInsightTone(insight.severity)
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
                      <span>Widget: {activeAiWidget}</span>
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
              <div className="text-sm text-muted-foreground">Нет данных по инвентарю кампаний</div>
            ) : (
              <div className="space-y-2">
                {(showAllInventory ? filteredInventoryRows : filteredInventoryRows.slice(0, 8)).map((row, index) => {
                  const name = (row.campaign_name as string | null) ?? `Campaign ${row.campaign_id ?? index + 1}`
                  const platform = (row.platform as string | null) ?? (row.channel as string | null) ?? "—"
                  const product =
                    (row.product_intent_primary as string | null) ??
                    (row.product_name as string | null) ??
                    "Unknown product"
                  const spend = toNumber(row.spend) ?? 0
                  const leads = toNumber(row.leads_platform ?? row.leads) ?? 0
                  const requests = toNumber(row.requests_crm ?? row.requests) ?? 0
                  const contracts = toNumber(row.contracts_cnt ?? row.contracts) ?? 0
                  const payments = toNumber(row.payments_sum) ?? 0
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
                        <span>Payments {formatCurrency(payments)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
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
                  const sourceLabel =
                    (row.source_name as string | null) ??
                    (row.event_name as string | null) ??
                    (row.promo_name as string | null) ??
                    `Source ${row.source_owner ?? index + 1}`
                  const leads = toNumber(row.leads_cnt)
                  const contracts = toNumber(row.contracts_cnt)
                  const revenue = toNumber(row.revenue_sum)
                  const payments = toNumber(row.payments_sum)
                  return (
                    <div key={`${sourceLabel}-${index}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{sourceLabel}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {row.source_owner ? `Owner: ${row.source_owner}` : "Owner: —"}
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
                        <span>Payments {formatCurrency(payments)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
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
              <Badge variant="secondary">{filteredRevenueRows.length} rows</Badge>
              <Badge variant={getCoverageBadge(revenueCoverage).variant}>
                {getCoverageBadge(revenueCoverage).label}
              </Badge>
              {filteredRevenueRows.length > 8 && (
                <Button size="sm" variant="outline" onClick={() => setShowAllSources((prev) => !prev)}>
                  {showAllSources ? "Collapse" : "Show all"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredRevenueRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Нет данных по источникам</div>
            ) : (
              <div className="space-y-2">
                {(showAllSources ? filteredRevenueRows : filteredRevenueRows.slice(0, 8)).map((row, index) => {
                  const sourceName =
                    (row.source_name as string | null) ??
                    (row.source_user_name as string | null) ??
                    (row.source_type_name as string | null) ??
                    "Source"
                  const sourceType = (row.source_type_name as string | null) ?? "—"
                  const revenue = toNumber(row.contracts_sum) ?? 0
                  const share = totalRevenueSum > 0 ? revenue / totalRevenueSum : null
                  return (
                    <div key={`${sourceName}-${index}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{sourceName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{sourceType}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Contracts</div>
                          <div className="font-semibold">{formatNumber(toNumber(row.contracts_cnt))}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-xs text-muted-foreground">Revenue</div>
                          <div className="font-semibold">{formatCurrency(revenue)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Paid sum {formatCurrency(toNumber(row.paid_sum))}</span>
                        {share != null && (
                          <Badge variant="outline" className="text-[10px]">
                            Share {formatPercent(share * 100)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Top Metrics</CardTitle>
              <CardDescription>Ключевые показатели эффективности за период.</CardDescription>
            </div>
            <Badge variant="secondary">{metricsRows.length} rows</Badge>
          </CardHeader>
          <CardContent>
            {metricsCards.length === 0 ? (
              <div className="text-sm text-muted-foreground">Нет данных по метрикам</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {metricsCards.map((metric) => (
                  <div key={metric.label} className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{metric.label}</div>
                    <div className="text-lg font-semibold">{metric.value}</div>
                  </div>
                ))}
              </div>
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
            <Badge variant="secondary">{filteredSourcePerfRows.length} rows</Badge>
            {filteredSourcePerfRows.length > 8 && (
              <Button size="sm" variant="outline" onClick={() => setShowAllSourcePerf((prev) => !prev)}>
                {showAllSourcePerf ? "Collapse" : "Show all"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredSourcePerfRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Нет данных по CRM источникам</div>
          ) : (
            <div className="space-y-2">
              {(showAllSourcePerf ? filteredSourcePerfRows : filteredSourcePerfRows.slice(0, 8)).map((row, index) => {
                const label =
                  (row.source_type as string | null) ??
                  (row.source_owner as string | null) ??
                  `Source #${row.id_source ?? index + 1}`
                const leads = toNumber(row.leads_cnt)
                const contracts = toNumber(row.contracts_cnt)
                const revenue = toNumber(row.revenue)
                return (
                  <div key={`${row.id_source ?? label}-${index}`} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.source_owner ? `Owner: ${row.source_owner}` : "Owner: —"}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">Leads {formatNumber(leads)}</Badge>
                        <Badge variant="outline">Contracts {formatNumber(contracts)}</Badge>
                        <Badge variant="outline">Revenue {formatCurrency(revenue)}</Badge>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
