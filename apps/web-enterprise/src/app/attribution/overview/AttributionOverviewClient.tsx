"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AttributionFilterBar } from "@/app/attribution/components/AttributionFilterBar"
import { useAttributionFilters } from "@/app/attribution/hooks/useAttributionFilters"
import { buildDateKey } from "@/app/attribution/utils/filters"
import { buildLastWeekRange, resolveDefaultCityId } from "@/app/analytics/utils/defaults"
import { formatCurrency, formatNumber, formatPercent } from "@/app/analytics/utils/formatters"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { KpiSparkline } from "@/app/analytics/components/KpiSparkline"
import { WidgetStatus } from "@/app/analytics/components/WidgetStatus"
import { fetchAttributionWidgets } from "@/lib/api/attribution"
import { fetchWidgetRange } from "@/lib/api/analytics-widgets"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"

const OVERVIEW_WIDGET_KEYS = [
  "attr.overview.kpi_total",
  "attr.overview.ts_core",
  "attr.overview.channel_mix",
  "attr.overview.coverage",
]

type AttributionKpiRow = {
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  conversions?: number | null
  conversion_value?: number | null
  platform_leads?: number | null
  crm_requests_cnt?: number | null
}

type AttributionTrendRow = {
  date_key?: string | null
  spend?: number | null
  clicks?: number | null
  impressions?: number | null
  platform_leads?: number | null
  crm_requests_cnt?: number | null
}

type ChannelMixRow = {
  date_key?: string | null
  channel?: string | null
  platform?: string | null
  spend?: number | null
  leads_cnt?: number | null
  contracts_cnt?: number | null
}

type CoverageRow = {
  date_key?: string | null
  id_city?: number | null
  gads_clicks?: number | null
  gads_uniq_gclid?: number | null
  requests_cnt?: number | null
  requests_with_gclid?: number | null
  leads_cnt?: number | null
  leads_with_gclid?: number | null
  contracts_cnt?: number | null
  contracts_with_request_id?: number | null
  contracts_with_request_gclid?: number | null
  paid_gads_contracts?: number | null
}

type AttributionWidgetsPayload = {
  widgets: Record<string, { data: { current: any[]; compare?: any[] }; meta: { missing_view?: boolean } }>
}

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const buildSparkline = (rows: AttributionTrendRow[], key: keyof AttributionTrendRow) =>
  rows.map((row) => ({ value: toNumber(row[key]) }))

export default function AttributionOverviewClient() {
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const hasDateParam = useMemo(
    () => Boolean(searchParams.get("date_from") || searchParams.get("date_to")),
    [searchKey]
  )
  const hasCityParam = useMemo(() => Boolean(searchParams.get("id_city")), [searchKey])
  const { cities } = useCities()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const canFetch = isAuthenticated && !authLoading

  const {
    draftFilters,
    appliedFilters,
    setDraftFilters,
    setAppliedFilters,
    applyFilters,
    resetFilters,
    updateQuery,
  } = useAttributionFilters()

  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [data, setData] = useState<AttributionWidgetsPayload>({ widgets: {} })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!canFetch) return
    if (defaultsApplied) return
    if (hasDateParam) {
      setDefaultsApplied(true)
      return
    }
    let active = true
    const hydrateDefaults = async () => {
      try {
        const range = await fetchWidgetRange("attr.overview.kpi_total")
        if (!active) return
        const dateRange = buildLastWeekRange(range?.max_date ?? null)
        if (!dateRange) {
          setDefaultsApplied(true)
          return
        }
        setDraftFilters((prev) => ({ ...prev, dateRange }))
        setAppliedFilters((prev) => ({ ...prev, dateRange }))
        updateQuery({
          date_from: buildDateKey(dateRange.from),
          date_to: buildDateKey(dateRange.to),
        })
      } catch (error) {
        console.warn("Failed to load attribution default date range", error)
      } finally {
        if (active) setDefaultsApplied(true)
      }
    }
    hydrateDefaults()
    return () => {
      active = false
    }
  }, [canFetch, defaultsApplied, hasDateParam, setAppliedFilters, setDraftFilters, updateQuery])

  useEffect(() => {
    if (hasCityParam) return
    const cityId = resolveDefaultCityId(cities)
    if (!cityId) return
    setDraftFilters((prev) => ({ ...prev, cityId: String(cityId) }))
    setAppliedFilters((prev) => ({ ...prev, cityId: String(cityId) }))
    updateQuery({ id_city: String(cityId) })
  }, [cities, hasCityParam, setAppliedFilters, setDraftFilters, updateQuery])

  const requestParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {}
    if (appliedFilters.dateRange.from) {
      params.date_from = buildDateKey(appliedFilters.dateRange.from)
    }
    if (appliedFilters.dateRange.to) {
      params.date_to = buildDateKey(appliedFilters.dateRange.to)
    }
    if (appliedFilters.compareMode !== "none") {
      params.compare = appliedFilters.compareMode
    }
    if (appliedFilters.compareMode === "custom") {
      if (appliedFilters.compareRange.from) {
        params.compare_from = buildDateKey(appliedFilters.compareRange.from)
      }
      if (appliedFilters.compareRange.to) {
        params.compare_to = buildDateKey(appliedFilters.compareRange.to)
      }
    }
    if (appliedFilters.cityId !== "all") {
      params.id_city = appliedFilters.cityId
    }
    if (appliedFilters.platform !== "all") {
      params.platform = appliedFilters.platform
    }
    if (appliedFilters.channel !== "all") {
      params.channel = appliedFilters.channel
    }
    if (appliedFilters.device !== "all") {
      params.device = appliedFilters.device
    }
    if (appliedFilters.conversionType !== "all") {
      params.conversion_type = appliedFilters.conversionType
    }
    return params
  }, [appliedFilters])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch) return
      setIsLoading(true)
      try {
        const response = await fetchAttributionWidgets({
          widgetKeys: OVERVIEW_WIDGET_KEYS,
          filters: requestParams,
        })
        if (!active) return
        setData(response)
      } catch (error) {
        if (!active) return
        console.error("Failed to load attribution overview widgets", error)
        setData({ widgets: {} })
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [canFetch, requestParams])

  const kpiWidget = data.widgets["attr.overview.kpi_total"] as
    | { data: { current: AttributionKpiRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const trendWidget = data.widgets["attr.overview.ts_core"] as
    | { data: { current: AttributionTrendRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const channelWidget = data.widgets["attr.overview.channel_mix"] as
    | { data: { current: ChannelMixRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const coverageWidget = data.widgets["attr.overview.coverage"] as
    | { data: { current: CoverageRow[] }; meta: { missing_view?: boolean } }
    | undefined

  const kpiRow = kpiWidget?.data?.current?.[0]
  const trendRows = trendWidget?.meta?.missing_view ? [] : trendWidget?.data?.current ?? []
  const channelRows = channelWidget?.data?.current ?? []
  const coverageRows = coverageWidget?.data?.current ?? []

  const spendSparkline = buildSparkline(trendRows, "spend")
  const clickSparkline = buildSparkline(trendRows, "clicks")
  const impressionSparkline = buildSparkline(trendRows, "impressions")
  const platformLeadsSparkline = buildSparkline(trendRows, "platform_leads")
  const crmLeadsSparkline = buildSparkline(trendRows, "crm_requests_cnt")

  const trendChartData = trendRows.map((row) => ({
    date: row.date_key ?? "",
    spend: toNumber(row.spend) ?? 0,
    platform_leads: toNumber(row.platform_leads) ?? 0,
    crm_requests_cnt: toNumber(row.crm_requests_cnt) ?? 0,
  }))

  const topChannels = [...channelRows]
    .sort((a, b) => (toNumber(b.spend) ?? 0) - (toNumber(a.spend) ?? 0))
    .slice(0, 6)

  const coverageTotals = coverageRows.reduce(
    (acc, row) => {
      acc.gadsClicks += toNumber(row.gads_clicks) ?? 0
      acc.gadsGclid += toNumber(row.gads_uniq_gclid) ?? 0
      acc.requests += toNumber(row.requests_cnt) ?? 0
      acc.requestsWithGclid += toNumber(row.requests_with_gclid) ?? 0
      acc.leads += toNumber(row.leads_cnt) ?? 0
      acc.leadsWithGclid += toNumber(row.leads_with_gclid) ?? 0
      acc.contracts += toNumber(row.contracts_cnt) ?? 0
      acc.contractsWithRequest += toNumber(row.contracts_with_request_id) ?? 0
      acc.contractsWithGclid += toNumber(row.contracts_with_request_gclid) ?? 0
      acc.paidGadsContracts += toNumber(row.paid_gads_contracts) ?? 0
      return acc
    },
    {
      gadsClicks: 0,
      gadsGclid: 0,
      requests: 0,
      requestsWithGclid: 0,
      leads: 0,
      leadsWithGclid: 0,
      contracts: 0,
      contractsWithRequest: 0,
      contractsWithGclid: 0,
      paidGadsContracts: 0,
    }
  )

  const coverageRates = {
    requests: coverageTotals.requests > 0 ? coverageTotals.requestsWithGclid / coverageTotals.requests : null,
    leads: coverageTotals.leads > 0 ? coverageTotals.leadsWithGclid / coverageTotals.leads : null,
    contracts: coverageTotals.contracts > 0 ? coverageTotals.contractsWithGclid / coverageTotals.contracts : null,
    paidShare: coverageTotals.contracts > 0 ? coverageTotals.paidGadsContracts / coverageTotals.contracts : null,
  }

  const renderMetric = (label: string, value: string, sparkline: { value: number | null }[], tone = "#3b82f6") => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="w-24 shrink-0">
          <KpiSparkline data={sparkline} stroke={tone} />
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attribution Overview"
        description="KPI, тренды и канальный микс по выбранным фильтрам."
      />
      <AttributionFilterBar
        value={draftFilters}
        onChange={(next) => setDraftFilters((prev) => ({ ...prev, ...next }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={isLoading}
      />

      {kpiWidget?.meta?.missing_view && (
        <WidgetStatus
          title="Витрина KPI не найдена"
          description="Нужно зарегистрировать attr.overview.kpi_total в core и создать view в SEM."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {isLoading ? (
          [...Array(5)].map((_, index) => <Skeleton key={index} className="h-[104px]" />)
        ) : (
          <>
            {renderMetric("Spend", formatCurrency(kpiRow?.spend), spendSparkline)}
            {renderMetric("Clicks", formatNumber(kpiRow?.clicks), clickSparkline, "#0ea5e9")}
            {renderMetric("Impressions", formatNumber(kpiRow?.impressions), impressionSparkline, "#38bdf8")}
            {renderMetric("Platform Leads", formatNumber(kpiRow?.platform_leads), platformLeadsSparkline, "#10b981")}
            {renderMetric("CRM Leads", formatNumber(kpiRow?.crm_requests_cnt), crmLeadsSparkline, "#f97316")}
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Attribution coverage (Paid GAds)</CardTitle>
        </CardHeader>
        <CardContent>
          {coverageWidget?.meta?.missing_view ? (
            <WidgetStatus
              title="Витрина coverage не найдена"
              description="Нужно зарегистрировать attr.overview.coverage и создать view sem_ui.attribution_coverage_daily_city."
            />
          ) : coverageRows.length === 0 && !isLoading ? (
            <div className="text-sm text-muted-foreground">Нет данных coverage для выбранного периода.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">GAds clicks / GCLID</div>
                <div className="text-lg font-semibold">
                  {formatNumber(coverageTotals.gadsClicks)} / {formatNumber(coverageTotals.gadsGclid)}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Requests with GCLID</div>
                <div className="text-lg font-semibold">
                  {formatNumber(coverageTotals.requestsWithGclid)}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({formatPercent(coverageRates.requests, 1)})
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Leads with GCLID</div>
                <div className="text-lg font-semibold">
                  {formatNumber(coverageTotals.leadsWithGclid)}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({formatPercent(coverageRates.leads, 1)})
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Contracts with GCLID</div>
                <div className="text-lg font-semibold">
                  {formatNumber(coverageTotals.contractsWithGclid)}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({formatPercent(coverageRates.contracts, 1)})
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Paid GAds share {formatPercent(coverageRates.paidShare, 1)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Performance over time</CardTitle>
        </CardHeader>
        <CardContent>
          {trendWidget?.meta?.missing_view ? (
            <WidgetStatus
              title="Витрина трендов не найдена"
              description="Нужно зарегистрировать attr.overview.ts_core и создать view для временных рядов."
            />
          ) : (
            <div className="h-[280px]">
              <SafeResponsiveContainer>
                <ComposedChart data={trendChartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attrSpendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...chartGridProps} vertical={false} />
                  <XAxis dataKey="date" {...chartAxisProps} />
                  <YAxis yAxisId="spend" {...chartAxisProps} />
                  <YAxis
                    yAxisId="leads"
                    orientation="right"
                    {...chartAxisProps}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                    formatter={(value: number, name: string) => {
                      if (name === "spend") return [formatCurrency(value), "Spend"]
                      if (name === "platform_leads") return [formatNumber(value), "Platform leads"]
                      if (name === "crm_requests_cnt") return [formatNumber(value), "CRM leads"]
                      return [formatNumber(value), name]
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    yAxisId="spend"
                    stroke={CHART_COLORS.primary}
                    fill="url(#attrSpendFill)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="platform_leads"
                    yAxisId="leads"
                    stroke={CHART_COLORS.secondary}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="crm_requests_cnt"
                    yAxisId="leads"
                    stroke={CHART_COLORS.tertiary}
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </SafeResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Channel mix</CardTitle>
          </CardHeader>
          <CardContent>
            {channelWidget?.meta?.missing_view ? (
              <WidgetStatus
                title="Нет витрины channel mix"
                description="Нужно зарегистрировать attr.overview.channel_mix и подготовить view."
              />
            ) : (
              <div className="space-y-2">
                {topChannels.length === 0 && !isLoading && (
                  <div className="text-sm text-muted-foreground">Нет данных для выбранного периода.</div>
                )}
                {topChannels.map((row, index) => {
                  const label = row.channel ?? row.platform ?? `Channel ${index + 1}`
                  return (
                    <div key={`${label}-${index}`} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px]">
                          Spend {formatCurrency(row.spend)}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          Leads {formatNumber(row.leads_cnt)}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>City breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <WidgetStatus
              title="Витрина городов в очереди"
              description="Добавим attr.overview.city_breakdown на следующем этапе." 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
