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
import { WidgetStatus } from "@/app/analytics/components/WidgetStatus"
import { fetchAttributionWidgets } from "@/lib/api/attribution"
import { fetchWidgetRange } from "@/lib/api/analytics-widgets"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"

const WIDGET_KEYS = {
  funnel: "attr.interactions.funnel",
  sla: "attr.interactions.sla_daily",
  sources: "attr.interactions.sources_daily",
}

type FunnelRow = {
  date_key?: string | null
  city_id?: number | null
  requests_cnt?: number | null
  leads_cnt?: number | null
  contracts_cnt?: number | null
  contracts_sum?: number | null
  paid_sum?: number | null
  payments_sum?: number | null
}

type SlaRow = {
  date_key?: string | null
  leads_total?: number | null
  leads_with_first_contact?: number | null
  avg_hours_to_first_contact?: number | null
  overdue_48h_no_contact?: number | null
}

type SourceRow = {
  date_key?: string | null
  source?: string | null
  leads_cnt?: number | null
  contracts_cnt?: number | null
  revenue?: number | null
  branch_name?: string | null
}

type AttributionWidgetsPayload = {
  widgets: Record<string, { data: { current: any[] }; meta: { missing_view?: boolean } }>
}

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const sumByKey = (rows: Array<Record<string, unknown>>, key: string) =>
  rows.reduce((acc, row) => acc + (toNumber(row[key]) ?? 0), 0)

const buildFunnelSeries = (rows: FunnelRow[]) => {
  const map = new Map<string, { requests: number; leads: number; contracts: number }>()
  rows.forEach((row) => {
    const dateKey = row.date_key
    if (!dateKey) return
    const bucket = map.get(dateKey) ?? { requests: 0, leads: 0, contracts: 0 }
    bucket.requests += toNumber(row.requests_cnt) ?? 0
    bucket.leads += toNumber(row.leads_cnt) ?? 0
    bucket.contracts += toNumber(row.contracts_cnt) ?? 0
    map.set(dateKey, bucket)
  })
  return [...map.entries()]
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([date, metrics]) => ({ date, ...metrics }))
}

export default function AttributionCrmFunnelSlaClient() {
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
          widgetKeys: Object.values(WIDGET_KEYS),
          filters: requestParams,
        })
        if (!active) return
        setData(response)
      } catch (error) {
        if (!active) return
        console.error("Failed to load CRM funnel widgets", error)
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

  const funnelWidget = data.widgets[WIDGET_KEYS.funnel] as
    | { data: { current: FunnelRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const slaWidget = data.widgets[WIDGET_KEYS.sla] as
    | { data: { current: SlaRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const sourcesWidget = data.widgets[WIDGET_KEYS.sources] as
    | { data: { current: SourceRow[] }; meta: { missing_view?: boolean } }
    | undefined

  const funnelRows = funnelWidget?.data?.current ?? []
  const slaRows = slaWidget?.data?.current ?? []
  const sourcesRows = sourcesWidget?.data?.current ?? []

  const funnelTotals = useMemo(() => {
    return {
      requests: sumByKey(funnelRows, "requests_cnt"),
      leads: sumByKey(funnelRows, "leads_cnt"),
      contracts: sumByKey(funnelRows, "contracts_cnt"),
      paid: sumByKey(funnelRows, "paid_sum"),
    }
  }, [funnelRows])

  const funnelSeries = useMemo(() => buildFunnelSeries(funnelRows), [funnelRows])

  const slaSummary = useMemo(() => {
    if (slaRows.length === 0) return null
    const totalLeads = sumByKey(slaRows, "leads_total")
    const contacted = sumByKey(slaRows, "leads_with_first_contact")
    const overdue = sumByKey(slaRows, "overdue_48h_no_contact")
    const weightedHours = slaRows.reduce(
      (acc, row) => acc + (toNumber(row.avg_hours_to_first_contact) ?? 0) * (toNumber(row.leads_total) ?? 0),
      0
    )
    const avgHours = totalLeads > 0 ? weightedHours / totalLeads : null
    return {
      totalLeads,
      contacted,
      overdue,
      contactRate: totalLeads > 0 ? contacted / totalLeads : null,
      avgHours,
    }
  }, [slaRows])

  const topSources = useMemo(() => {
    return [...sourcesRows]
      .sort((a, b) => (toNumber(b.contracts_cnt) ?? 0) - (toNumber(a.contracts_cnt) ?? 0))
      .slice(0, 12)
  }, [sourcesRows])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attribution · CRM Funnel & SLA"
        description="Качество лидов, скорость контакта и SLA-показатели."
      />
      <AttributionFilterBar
        value={draftFilters}
        onChange={(next) => setDraftFilters((prev) => ({ ...prev, ...next }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={isLoading}
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Requests", value: funnelTotals.requests },
          { label: "Leads", value: funnelTotals.leads },
          { label: "Contracts", value: funnelTotals.contracts },
          { label: "Paid sum", value: funnelTotals.paid, format: formatCurrency },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <div className="text-2xl font-semibold">
                  {card.format ? card.format(card.value) : formatNumber(card.value)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CRM funnel trend</CardTitle>
        </CardHeader>
        <CardContent>
          {funnelWidget?.meta?.missing_view ? (
            <WidgetStatus title="Нет витрины funnel" description="attr.interactions.funnel не подключена." />
          ) : funnelSeries.length === 0 && !isLoading ? (
            <div className="text-sm text-muted-foreground">Нет данных по воронке.</div>
          ) : (
            <div className="h-[260px] w-full">
              <SafeResponsiveContainer width="100%" height="100%">
                <ComposedChart data={funnelSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="date" {...chartAxisProps} />
                  <YAxis tickFormatter={(value) => formatNumber(value as number)} {...chartAxisProps} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                    formatter={(value) => [formatNumber(value as number), "count"]}
                  />
                  <Area dataKey="requests" fill={CHART_COLORS.primary} stroke={CHART_COLORS.primary} fillOpacity={0.2} />
                  <Line dataKey="leads" stroke={CHART_COLORS.secondary} strokeWidth={2} />
                  <Line dataKey="contracts" stroke={CHART_COLORS.tertiary} strokeWidth={2} />
                </ComposedChart>
              </SafeResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SLA overview</CardTitle>
          </CardHeader>
          <CardContent>
            {slaWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины SLA" description="attr.interactions.sla_daily не подключена." />
            ) : !slaSummary && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет SLA данных.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Contact rate</div>
                  <div className="text-lg font-semibold">{formatPercent(slaSummary?.contactRate, 1)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg hours to contact</div>
                  <div className="text-lg font-semibold">
                    {slaSummary?.avgHours != null ? slaSummary.avgHours.toFixed(1) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Leads contacted</div>
                  <div className="text-lg font-semibold">{formatNumber(slaSummary?.contacted)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Overdue 48h</div>
                  <div className="text-lg font-semibold">{formatNumber(slaSummary?.overdue)}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top sources (contracts)</CardTitle>
          </CardHeader>
          <CardContent>
            {sourcesWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины источников" description="attr.interactions.sources_daily не подключена." />
            ) : topSources.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет данных по источникам.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Contracts</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSources.map((row, index) => (
                    <TableRow key={`${row.source ?? index}`}>
                      <TableCell>
                        <div className="font-medium">{row.source ?? `Source ${index + 1}`}</div>
                        {row.branch_name && <div className="text-xs text-muted-foreground">{row.branch_name}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{formatNumber(row.contracts_cnt)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
