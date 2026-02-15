"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'

import { AttributionFilterBar } from "@/app/attribution/components/AttributionFilterBar"
import { useAttributionFilters } from "@/app/attribution/hooks/useAttributionFilters"
import { buildDateKey } from "@/app/attribution/utils/filters"
import { buildLastWeekRange, resolveDefaultCityId } from "@/app/analytics/utils/defaults"
import { formatCurrency, formatNumber } from "@/app/analytics/utils/formatters"
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
  sources: "attr.interactions.sources_daily",
  sla: "attr.interactions.sla_daily",
  leads: "attr.interactions.leads_table",
  cohort: "attr.interactions.cohort",
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

type SourceRow = {
  date_key?: string | null
  source?: string | null
  leads_cnt?: number | null
  contracts_cnt?: number | null
  revenue?: number | null
  branch_name?: string | null
}

type SlaRow = {
  date_key?: string | null
  leads_total?: number | null
  leads_with_first_contact?: number | null
  avg_hours_to_first_contact?: number | null
  overdue_48h_no_contact?: number | null
}

type LeadRow = {
  lead_id?: string | number | null
  first_contact_at?: string | null
  first_phone?: string | null
  first_email?: string | null
  first_utm_source?: string | null
  first_utm_campaign?: string | null
  has_contract?: boolean | null
  total_payments?: number | null
  branch_name?: string | null
}

type CohortRow = {
  lead_day_key?: string | null
  leads_cnt?: number | null
  contracts_cnt_7d?: number | null
  contracts_cnt_14d?: number | null
  contracts_cnt_30d?: number | null
  revenue_30d?: number | null
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

export default function AttributionInteractionsClient() {
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
        console.error("Failed to load attribution interactions widgets", error)
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
  const sourcesWidget = data.widgets[WIDGET_KEYS.sources] as
    | { data: { current: SourceRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const slaWidget = data.widgets[WIDGET_KEYS.sla] as
    | { data: { current: SlaRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const leadsWidget = data.widgets[WIDGET_KEYS.leads] as
    | { data: { current: LeadRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const cohortWidget = data.widgets[WIDGET_KEYS.cohort] as
    | { data: { current: CohortRow[] }; meta: { missing_view?: boolean } }
    | undefined

  const funnelRows = funnelWidget?.data?.current ?? []
  const sourceRows = sourcesWidget?.data?.current ?? []
  const slaRows = slaWidget?.data?.current ?? []
  const leadRows = leadsWidget?.data?.current ?? []
  const cohortRows = cohortWidget?.data?.current ?? []

  const totalRequests = sumByKey(funnelRows, "requests_cnt")
  const totalLeads = sumByKey(funnelRows, "leads_cnt")
  const totalContracts = sumByKey(funnelRows, "contracts_cnt")
  const totalPaid = sumByKey(funnelRows, "paid_sum")

  const funnelSeries = useMemo(() => {
    const map = new Map<string, { requests: number; leads: number; contracts: number }>()
    funnelRows.forEach((row) => {
      if (!row.date_key) return
      const bucket = map.get(row.date_key) ?? { requests: 0, leads: 0, contracts: 0 }
      bucket.requests += toNumber(row.requests_cnt) ?? 0
      bucket.leads += toNumber(row.leads_cnt) ?? 0
      bucket.contracts += toNumber(row.contracts_cnt) ?? 0
      map.set(row.date_key, bucket)
    })
    return [...map.entries()]
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([date, metrics]) => ({ date, ...metrics }))
  }, [funnelRows])

  const slaSummary = useMemo(() => {
    if (!slaRows.length) return null
    const totalLeads = sumByKey(slaRows, "leads_total")
    const totalContacted = sumByKey(slaRows, "leads_with_first_contact")
    const avgHours =
      slaRows.reduce((acc, row) => acc + (toNumber(row.avg_hours_to_first_contact) ?? 0), 0) /
      Math.max(slaRows.length, 1)
    const overdue = sumByKey(slaRows, "overdue_48h_no_contact")
    return { totalLeads, totalContacted, avgHours, overdue }
  }, [slaRows])

  const topSources = [...sourceRows]
    .sort((a, b) => (toNumber(b.contracts_cnt) ?? 0) - (toNumber(a.contracts_cnt) ?? 0))
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attribution · Interactions"
        description="События, вовлечённость и качество лидов."
      />
      <AttributionFilterBar
        value={draftFilters}
        onChange={(next) => setDraftFilters((prev) => ({ ...prev, ...next }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={isLoading}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Requests</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-20" /> : formatNumber(totalRequests)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Leads</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-20" /> : formatNumber(totalLeads)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Contracts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-20" /> : formatNumber(totalContracts)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Paid sum</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalPaid)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funnel trend</CardTitle>
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
            <CardTitle>Top sources</CardTitle>
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
                    <TableHead className="text-right">Leads</TableHead>
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
                      <TableCell className="text-right">{formatNumber(row.leads_cnt)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.contracts_cnt)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SLA quality</CardTitle>
          </CardHeader>
          <CardContent>
            {slaWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины SLA" description="attr.interactions.sla_daily не подключена." />
            ) : !slaSummary && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет SLA данных.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Leads total</div>
                  <div className="text-lg font-semibold">{formatNumber(slaSummary?.totalLeads)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Leads contacted</div>
                  <div className="text-lg font-semibold">{formatNumber(slaSummary?.totalContacted)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg hours to first contact</div>
                  <div className="text-lg font-semibold">
                    {slaSummary?.avgHours != null ? slaSummary.avgHours.toFixed(1) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Overdue 48h</div>
                  <div className="text-lg font-semibold">{formatNumber(slaSummary?.overdue)}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads → Contracts cohort</CardTitle>
          </CardHeader>
          <CardContent>
            {cohortWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины cohort" description="attr.interactions.cohort не подключена." />
            ) : cohortRows.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет cohort данных.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead date</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Contracts 7d</TableHead>
                    <TableHead className="text-right">Contracts 14d</TableHead>
                    <TableHead className="text-right">Contracts 30d</TableHead>
                    <TableHead className="text-right">Revenue 30d</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohortRows.slice(0, 10).map((row, index) => (
                    <TableRow key={`${row.lead_day_key ?? index}`}>
                      <TableCell>{row.lead_day_key ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.leads_cnt)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.contracts_cnt_7d)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.contracts_cnt_14d)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.contracts_cnt_30d)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.revenue_30d)}</TableCell>
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