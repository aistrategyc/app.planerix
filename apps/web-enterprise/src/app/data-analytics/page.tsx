"use client"

import { useEffect, useMemo, useState } from "react"
import { DataQualityAPI, FreshnessItem, AgentReadyItem } from "@/lib/api/data-quality"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { buildLastWeekRange, resolveDefaultCityId } from "@/app/analytics/utils/defaults"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { fetchWidget, fetchWidgetRange, WidgetRow } from "@/lib/api/analytics-widgets"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/layout/PageHeader"

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("uk-UA", { style: "currency", currency: "UAH" })
}

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return `${(value * 100).toFixed(1)}%`
}

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("uk-UA")
}

const parseDate = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const formatDateTime = (value: string | null | undefined) => {
  const parsed = parseDate(value)
  if (!parsed) return "—"
  return parsed.toLocaleString("uk-UA")
}

const hoursSince = (value: string | null | undefined) => {
  const parsed = parseDate(value)
  if (!parsed) return null
  const diffMs = Date.now() - parsed.getTime()
  return diffMs / 36e5
}

const resolveStatus = (value: string | null | undefined) => {
  const lagHours = hoursSince(value)
  if (lagHours === null) {
    return { label: "Unknown", variant: "outline" as const, lagHours: null }
  }
  if (lagHours <= 24) {
    return { label: "Fresh", variant: "success" as const, lagHours }
  }
  if (lagHours <= 72) {
    return { label: "Warning", variant: "warning" as const, lagHours }
  }
  return { label: "Delayed", variant: "destructive" as const, lagHours }
}

const formatLag = (value: number | null) => {
  if (value === null) return "—"
  return `${value.toFixed(1)}h`
}

const toDateInput = (value: Date | undefined) => (value ? value.toISOString().slice(0, 10) : undefined)

const pickRowValue = (row: WidgetRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== "") {
      return value
    }
  }
  return null
}

const metricNumber = (row: WidgetRow, keys: string[]) => {
  const value = pickRowValue(row, keys)
  if (typeof value === "number") return value
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export default function DataAnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const canFetch = isAuthenticated && !authLoading
  const { cities } = useCities()
  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 6)
    return date
  }, [])

  const initialGa4Filters = useMemo<AnalyticsFiltersValue>(
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
  const [draftGa4Filters, setDraftGa4Filters] = useState<AnalyticsFiltersValue>(initialGa4Filters)
  const [appliedGa4Filters, setAppliedGa4Filters] = useState<AnalyticsFiltersValue>(initialGa4Filters)

  const [freshness, setFreshness] = useState<FreshnessItem[]>([])
  const [agentReady, setAgentReady] = useState<AgentReadyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllFreshness, setShowAllFreshness] = useState(false)
  const [showAllAgents, setShowAllAgents] = useState(false)

  const [ga4TrafficRows, setGa4TrafficRows] = useState<WidgetRow[]>([])
  const [ga4EventsRows, setGa4EventsRows] = useState<WidgetRow[]>([])
  const [ga4CreativeRows, setGa4CreativeRows] = useState<WidgetRow[]>([])
  const [ga4UtmRows, setGa4UtmRows] = useState<WidgetRow[]>([])
  const [ga4Loading, setGa4Loading] = useState(false)
  const [ga4Loaded, setGa4Loaded] = useState(false)

  useEffect(() => {
    let isActive = true

    const load = async () => {
      try {
        if (!canFetch) return
        setIsLoading(true)
        const [freshnessItems, agentReadyItems] = await Promise.all([
          DataQualityAPI.getFreshness({ limit: 200 }),
          DataQualityAPI.getAgentReady({ limit: 200 }),
        ])
        if (!isActive) return
        setFreshness(freshnessItems)
        setAgentReady(agentReadyItems)
        setError(null)
      } catch (err) {
        if (!isActive) return
        setError(err instanceof Error ? err.message : "Failed to load data analytics")
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    load()
    return () => {
      isActive = false
    }
  }, [canFetch])

  const ga4Params = useMemo(
    () => ({
      date_from: toDateInput(appliedGa4Filters.dateRange.from),
      date_to: toDateInput(appliedGa4Filters.dateRange.to),
      id_city: appliedGa4Filters.cityId !== "all" ? Number(appliedGa4Filters.cityId) : undefined,
    }),
    [appliedGa4Filters]
  )

  useEffect(() => {
    let active = true
    const loadGa4 = async () => {
      if (!canFetch) return
      setGa4Loading(true)
      try {
        const [traffic, events, creatives, utm] = await Promise.all([
          fetchWidget("ga4.traffic_overview_daily", { ...ga4Params, limit: 200 }),
          fetchWidget("ga4.events_conversions_daily", { ...ga4Params, limit: 200, order_by: "-conversions" }),
          fetchWidget("ga4.ads_creative_performance_daily", { ...ga4Params, limit: 200, order_by: "-spend" }),
          fetchWidget("ga4.utm_daily", { ...ga4Params, limit: 200, order_by: "-sessions" }),
        ])
        if (!active) return
        setGa4TrafficRows(traffic.items)
        setGa4EventsRows(events.items)
        setGa4CreativeRows(creatives.items)
        setGa4UtmRows(utm.items)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Failed to load GA4 widgets")
      } finally {
        if (active) {
          setGa4Loading(false)
          setGa4Loaded(true)
        }
      }
    }
    loadGa4()
    return () => {
      active = false
    }
  }, [ga4Params, canFetch])

  useEffect(() => {
    let active = true
    const hydrateRange = async () => {
      try {
        if (!canFetch) return
        const range = await fetchWidgetRange("ga4.traffic_overview_daily")
        if (!active) return
        const dateRange = buildLastWeekRange(range.max_date)
        if (!dateRange) return
        const nextFilters: AnalyticsFiltersValue = {
          ...initialGa4Filters,
          dateRange,
        }
        setDraftGa4Filters(nextFilters)
        setAppliedGa4Filters(nextFilters)
      } catch {
        // fallback to default range
      }
    }
    hydrateRange()
    return () => {
      active = false
    }
  }, [initialGa4Filters, canFetch])

  useEffect(() => {
    if (draftGa4Filters.cityId !== "all") return
    const cityId = resolveDefaultCityId(cities)
    if (!cityId) return
    setDraftGa4Filters((prev) => ({ ...prev, cityId: String(cityId) }))
    setAppliedGa4Filters((prev) => ({ ...prev, cityId: String(cityId) }))
  }, [cities, draftGa4Filters.cityId])

  const applyGa4Filters = () => {
    setAppliedGa4Filters(draftGa4Filters)
  }

  const resetGa4Filters = () => {
    setDraftGa4Filters(initialGa4Filters)
    setAppliedGa4Filters(initialGa4Filters)
  }

  const freshnessRows = useMemo(
    () => (showAllFreshness ? freshness : freshness.slice(0, 20)),
    [freshness, showAllFreshness]
  )
  const agentRows = useMemo(
    () => (showAllAgents ? agentReady : agentReady.slice(0, 20)),
    [agentReady, showAllAgents]
  )
  const summary = useMemo(() => {
    const freshnessStatuses = freshness.map((row) => resolveStatus(row.last_ts))
    const staleSources = freshnessStatuses.filter((status) => status.label === "Delayed").length
    const warningSources = freshnessStatuses.filter((status) => status.label === "Warning").length
    const freshnessDates = freshness
      .map((row) => parseDate(row.last_ts))
      .filter((value): value is Date => value !== null)
    const agentDates = agentReady
      .map((row) => parseDate(row.refreshed_at ?? undefined))
      .filter((value): value is Date => value !== null)
    const latestFreshness = freshnessDates.sort((a, b) => b.getTime() - a.getTime())[0]
    const latestAgent = agentDates.sort((a, b) => b.getTime() - a.getTime())[0]
    const uniqueAgents = new Set(freshness.map((row) => row.agent_key)).size
    return {
      freshnessCount: freshness.length,
      agentReadyCount: agentReady.length,
      uniqueAgents,
      staleSources,
      warningSources,
      latestFreshness: latestFreshness?.toISOString() ?? null,
      latestAgent: latestAgent?.toISOString() ?? null,
    }
  }, [freshness, agentReady])

  const ga4Summary = useMemo(() => {
    const totals = ga4TrafficRows.reduce(
      (acc, row) => {
        acc.sessions += metricNumber(row, ["sessions", "session_cnt", "session_count"]) ?? 0
        acc.activeUsers += metricNumber(row, ["active_users", "activeUsers"]) ?? 0
        acc.newUsers += metricNumber(row, ["new_users", "newUsers"]) ?? 0
        acc.engagedSessions += metricNumber(row, ["engaged_sessions", "engagedSessions"]) ?? 0
        acc.conversions += metricNumber(row, ["conversions", "conversion_cnt"]) ?? 0
        acc.revenue += metricNumber(row, ["revenue", "purchase_revenue"]) ?? 0
        return acc
      },
      { sessions: 0, activeUsers: 0, newUsers: 0, engagedSessions: 0, conversions: 0, revenue: 0 }
    )
    const engagementRate = totals.sessions > 0 ? totals.engagedSessions / totals.sessions : null
    return { ...totals, engagementRate }
  }, [ga4TrafficRows])

  const ga4UtmDisplay = useMemo(() => {
    return [...ga4UtmRows]
      .map((row) => ({
        source: pickRowValue(row, ["source", "utm_source"]) ?? "Unknown",
        medium: pickRowValue(row, ["medium", "utm_medium"]) ?? "—",
        sessions: metricNumber(row, ["sessions", "session_cnt"]) ?? 0,
        conversions: metricNumber(row, ["conversions", "conversion_cnt"]) ?? 0,
        revenue: metricNumber(row, ["revenue", "purchase_revenue"]) ?? 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10)
  }, [ga4UtmRows])

  const ga4EventsDisplay = useMemo(() => {
    return [...ga4EventsRows]
      .map((row) => ({
        eventName: pickRowValue(row, ["event_name", "event"]) ?? "Event",
        conversions: metricNumber(row, ["conversions", "conversion_cnt"]) ?? 0,
        revenue: metricNumber(row, ["revenue", "purchase_revenue"]) ?? 0,
      }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 12)
  }, [ga4EventsRows])

  const ga4CreativeDisplay = useMemo(() => {
    return [...ga4CreativeRows]
      .map((row) => ({
        campaign: pickRowValue(row, ["campaign_name", "campaign"]) ?? "Campaign",
        adGroup: pickRowValue(row, ["ad_group_name", "ad_group"]) ?? "Ad group",
        creative: pickRowValue(row, ["creative_name", "creative"]) ?? "Creative",
        sessions: metricNumber(row, ["sessions", "session_cnt"]) ?? 0,
        conversions: metricNumber(row, ["conversions", "conversion_cnt"]) ?? 0,
        revenue: metricNumber(row, ["revenue", "purchase_revenue"]) ?? 0,
      }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 8)
  }, [ga4CreativeRows])

  const criticalSources = useMemo(() => {
    return freshness
      .map((row) => ({ row, status: resolveStatus(row.last_ts) }))
      .filter(({ status }) => status.label === "Delayed")
      .sort((a, b) => (b.status.lagHours ?? 0) - (a.status.lagHours ?? 0))
      .slice(0, 6)
  }, [freshness])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Analytics"
        description="Freshness and readiness signals from itstep_final."
        meta={<Badge variant="outline">itstep_final</Badge>}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">GA4 Overview</h2>
          <p className="text-sm text-muted-foreground">
            Основні показники трафіку, конверсій і UTM-джерел.
          </p>
        </div>
        <AnalyticsFilters
          value={draftGa4Filters}
          onDateChange={(value) => setDraftGa4Filters((prev) => ({ ...prev, dateRange: value }))}
          onCityChange={(value) => setDraftGa4Filters((prev) => ({ ...prev, cityId: value }))}
          onPlatformChange={(value) => setDraftGa4Filters((prev) => ({ ...prev, platform: value }))}
          onApply={applyGa4Filters}
          onReset={resetGa4Filters}
          isLoading={ga4Loading}
          showPlatform={false}
          showProduct={false}
          showBranch={false}
          showSource={false}
        />
      </div>

      {ga4Loaded && ga4TrafficRows.length === 0 ? (
        <AnalyticsEmptyState
          title="GA4 data empty"
          description="Немає даних GA4 у вибраному періоді."
          context="analytics"
          size="sm"
        />
      ) : (
        <>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>GA4 KPI</CardTitle>
              <CardDescription>Сумарні показники за період.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-sm text-muted-foreground">Sessions</div>
                <div className="text-2xl font-semibold">{formatNumber(ga4Summary.sessions)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-sm text-muted-foreground">Active users</div>
                <div className="text-2xl font-semibold">{formatNumber(ga4Summary.activeUsers)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-sm text-muted-foreground">New users</div>
                <div className="text-2xl font-semibold">{formatNumber(ga4Summary.newUsers)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-sm text-muted-foreground">Conversions</div>
                <div className="text-2xl font-semibold">{formatNumber(ga4Summary.conversions)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-sm text-muted-foreground">Revenue</div>
                <div className="text-2xl font-semibold">{formatCurrency(ga4Summary.revenue)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-sm text-muted-foreground">Engagement rate</div>
                <div className="text-2xl font-semibold">{formatPercent(ga4Summary.engagementRate ?? null)}</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>GA4 UTM sources</CardTitle>
                <CardDescription>Сессии и конверсии по источникам.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {ga4UtmDisplay.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Нет данных UTM.</div>
                ) : (
                  ga4UtmDisplay.map((row) => (
                    <div key={`${row.source}-${row.medium}`} className="rounded-xl border border-border bg-card/40 p-4">
                      <div className="text-sm font-semibold">{row.source}</div>
                      <div className="text-xs text-muted-foreground">{row.medium}</div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Sessions</div>
                          <div className="font-semibold">{formatNumber(row.sessions)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Conv</div>
                          <div className="font-semibold">{formatNumber(row.conversions)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Revenue</div>
                          <div className="font-semibold">{formatCurrency(row.revenue)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Top events</CardTitle>
                <CardDescription>Конверсии по событиям.</CardDescription>
              </CardHeader>
              <CardContent>
                {ga4EventsDisplay.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Нет событий GA4.</div>
                ) : (
                  <Table wrapperClassName="glass-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead className="text-right">Conversions</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ga4EventsDisplay.map((row) => (
                        <TableRow key={row.eventName}>
                          <TableCell>{row.eventName}</TableCell>
                          <TableCell className="text-right">{formatNumber(row.conversions)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>GA4 Ads creatives</CardTitle>
              <CardDescription>Топ креативів за конверсіями.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {ga4CreativeDisplay.length === 0 ? (
                <div className="text-sm text-muted-foreground">Нет данных по креативам.</div>
              ) : (
                ga4CreativeDisplay.map((row, index) => (
                  <div key={`${row.campaign}-${row.creative}-${index}`} className="rounded-xl border border-border bg-card/40 p-4">
                    <div className="text-sm font-semibold">{row.creative}</div>
                    <div className="text-xs text-muted-foreground">{row.campaign} · {row.adGroup}</div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Sessions</div>
                        <div className="font-semibold">{formatNumber(row.sessions)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Conv</div>
                        <div className="font-semibold">{formatNumber(row.conversions)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Revenue</div>
                        <div className="font-semibold">{formatCurrency(row.revenue)}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>Сводка по готовности данных и активности агентов.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="text-sm text-muted-foreground">Источники свежести</div>
            <div className="text-2xl font-semibold">{formatNumber(summary.freshnessCount)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Последнее обновление: {formatDateTime(summary.latestFreshness)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="text-sm text-muted-foreground">Агенты в работе</div>
            <div className="text-2xl font-semibold">{formatNumber(summary.uniqueAgents)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Последний запуск: {formatDateTime(summary.latestAgent)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="text-sm text-muted-foreground">Проблемные источники</div>
            <div className="text-2xl font-semibold">{formatNumber(summary.staleSources)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Warning: {formatNumber(summary.warningSources)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="text-sm text-muted-foreground">Готовность по городам</div>
            <div className="text-2xl font-semibold">{formatNumber(summary.agentReadyCount)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Строк готовности: {formatNumber(agentReady.length)}
            </div>
          </div>
        </CardContent>
      </Card>

      {criticalSources.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Critical Sources</CardTitle>
            <CardDescription>Источники с максимальным лагом обновления.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {criticalSources.map(({ row, status }) => (
              <div
                key={`${row.agent_key}-${row.row_idx}-${row.obj}`}
                className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{row.obj}</div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{row.agent_key}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  Lag: {formatLag(status.lagHours)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Last update: {formatDateTime(row.last_ts)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Data Freshness</CardTitle>
            <CardDescription>Latest timestamps per agent + source table.</CardDescription>
          </div>
          {freshness.length > 20 && (
            <Button size="sm" variant="outline" onClick={() => setShowAllFreshness((prev) => !prev)}>
              {showAllFreshness ? "Collapse" : "Show all"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : freshnessRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No freshness data available.</p>
          ) : (
            <Table wrapperClassName="glass-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Object</TableHead>
                  <TableHead>As Of</TableHead>
                  <TableHead>Last Update (UTC)</TableHead>
                  <TableHead>Lag</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {freshnessRows.map((row) => {
                  const status = resolveStatus(row.last_ts)
                  return (
                    <TableRow key={`${row.agent_key}-${row.row_idx}-${row.obj}`}>
                      <TableCell className="font-medium">{row.agent_key}</TableCell>
                      <TableCell>{row.obj}</TableCell>
                      <TableCell>{row.as_of_date}</TableCell>
                      <TableCell>{row.last_ts}</TableCell>
                      <TableCell>{formatLag(status.lagHours)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Agent Ready (by City)</CardTitle>
            <CardDescription>Contracts + spend readiness signals per city.</CardDescription>
          </div>
          {agentReady.length > 20 && (
            <Button size="sm" variant="outline" onClick={() => setShowAllAgents((prev) => !prev)}>
              {showAllAgents ? "Collapse" : "Show all"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : agentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agent readiness data available.</p>
          ) : (
            <Table wrapperClassName="glass-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Contracts</TableHead>
                  <TableHead>Spend</TableHead>
                  <TableHead>CPA Paid</TableHead>
                  <TableHead>Offline Share</TableHead>
                  <TableHead>Refreshed</TableHead>
                  <TableHead>Lag</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentRows.map((row) => {
                  const status = resolveStatus(row.refreshed_at ?? undefined)
                  return (
                    <TableRow key={`${row.date_key}-${row.id_city}`}>
                      <TableCell>{row.date_key}</TableCell>
                      <TableCell className="font-medium">{row.city_name}</TableCell>
                      <TableCell>{formatNumber(row.contracts_all)}</TableCell>
                      <TableCell>{formatCurrency(row.spend_all ?? undefined)}</TableCell>
                      <TableCell>{formatCurrency(row.cpa_paid_contracts ?? undefined)}</TableCell>
                      <TableCell>{formatPercent(row.offline_share ?? undefined)}</TableCell>
                      <TableCell>{row.refreshed_at ?? "—"}</TableCell>
                      <TableCell>{formatLag(status.lagHours)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
