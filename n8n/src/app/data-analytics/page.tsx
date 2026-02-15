"use client"

import { useEffect, useMemo, useState } from "react"
import { DataQualityAPI, FreshnessItem, AgentReadyItem, CoverageResponse } from "@/lib/api/data-quality"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

export default function DataAnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const canFetch = isAuthenticated && !authLoading

  const [freshness, setFreshness] = useState<FreshnessItem[]>([])
  const [agentReady, setAgentReady] = useState<AgentReadyItem[]>([])
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllFreshness, setShowAllFreshness] = useState(false)
  const [showAllAgents, setShowAllAgents] = useState(false)
  const [showAllCoverage, setShowAllCoverage] = useState(false)

  useEffect(() => {
    let isActive = true

    const load = async () => {
      try {
        if (!canFetch) return
        setIsLoading(true)
        const dateTo = new Date()
        const dateFrom90 = new Date(dateTo.getTime() - 90 * 864e5)
        const [freshnessItems, agentReadyItems, coverageRes] = await Promise.all([
          DataQualityAPI.getFreshness({ limit: 200 }),
          DataQualityAPI.getAgentReady({ limit: 200 }),
          DataQualityAPI.getCoverage({
            date_from: dateFrom90.toISOString().slice(0, 10),
            date_to: dateTo.toISOString().slice(0, 10),
            limit_views: 40,
          }),
        ])
        if (!isActive) return
        setFreshness(freshnessItems)
        setAgentReady(agentReadyItems)
        setCoverage(coverageRes ?? null)
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

  const criticalSources = useMemo(() => {
    return freshness
      .map((row) => ({ row, status: resolveStatus(row.last_ts) }))
      .filter(({ status }) => status.label === "Delayed")
      .sort((a, b) => (b.status.lagHours ?? 0) - (a.status.lagHours ?? 0))
      .slice(0, 6)
  }, [freshness])

  const paidCoverage = coverage?.paid_contracts_creatives?.total ?? null
  const paidByPlatform = coverage?.paid_contracts_creatives?.by_platform ?? []
  const cityCoverageAll = coverage?.city_id_coverage?.items ?? []
  const cityCoverageRows = useMemo(() => {
    const rows = [...cityCoverageAll]
    rows.sort((a, b) => (b.city_null_ratio ?? -1) - (a.city_null_ratio ?? -1))
    return showAllCoverage ? rows : rows.slice(0, 20)
  }, [cityCoverageAll, showAllCoverage])
  const cityCoverageBad = useMemo(() => cityCoverageAll.filter((r) => (r.city_null_ratio ?? 0) >= 0.05).length, [cityCoverageAll])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Analytics"
        description="Data health hub: freshness, agent readiness, and diagnostics. GA4 moved to /ads and /marketing."
        meta={<Badge variant="outline">itstep_final</Badge>}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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

      <Card className="glass-card">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Coverage</CardTitle>
            <CardDescription>Покрытие `city_id` в sem_ui витринах и привязка креативов для paid-контрактов.</CardDescription>
          </div>
          {cityCoverageAll.length > 20 && (
            <Button size="sm" variant="outline" onClick={() => setShowAllCoverage((prev) => !prev)}>
              {showAllCoverage ? "Collapse" : "Show all"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Paid contracts: creative/preview</div>
              {coverage?.meta?.paid_query_ms != null && (
                <Badge variant="outline">{coverage.meta.paid_query_ms}ms</Badge>
              )}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="text-xs text-muted-foreground">Creative coverage</div>
                <div className="text-xl font-semibold">{formatPercent(paidCoverage?.creative_ratio ?? null)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(paidCoverage?.with_creative ?? null)} / {formatNumber(paidCoverage?.paid_rows ?? null)}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="text-xs text-muted-foreground">Preview coverage</div>
                <div className="text-xl font-semibold">{formatPercent(paidCoverage?.preview_ratio ?? null)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(paidCoverage?.with_preview ?? null)} / {formatNumber(paidCoverage?.paid_rows ?? null)}
                </div>
              </div>
            </div>
            {paidByPlatform.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-2">By platform</div>
                <div className="space-y-2">
                  {paidByPlatform.map((row) => {
                    const paid = row.paid_rows ?? 0
                    const creativeRatio = paid > 0 ? (row.with_creative ?? 0) / paid : null
                    const previewRatio = paid > 0 ? (row.with_preview ?? 0) / paid : null
                    return (
                      <div key={row.attributed_platform ?? "unknown"} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium">{row.attributed_platform ?? "unknown"}</div>
                          <div className="text-xs text-muted-foreground">Paid rows {formatNumber(row.paid_rows)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Creative {formatPercent(creativeRatio)}</Badge>
                          <Badge variant="outline">Preview {formatPercent(previewRatio)}</Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">City ID NULL ratio (sem_ui)</div>
              <Badge variant={cityCoverageBad > 0 ? "warning" : "success"}>
                {cityCoverageBad > 0 ? `Issues ${cityCoverageBad}` : "OK"}
              </Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Threshold: NULL share &lt; 5% per view (90d).
            </div>
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>View</TableHead>
                    <TableHead className="text-right">NULL</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">Max date</TableHead>
                    <TableHead className="text-right">ms</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cityCoverageRows.map((row) => (
                    <TableRow key={row.obj}>
                      <TableCell className="font-mono text-xs">{row.obj}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={(row.city_null_ratio ?? 0) >= 0.05 ? "warning" : "outline"}>
                          {formatPercent(row.city_null_ratio)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.rows_total)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{row.max_date ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {row.query_ms != null ? `${row.query_ms}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {cityCoverageRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-xs text-muted-foreground">
                        Нет данных по покрытиям (endpoint /coverage недоступен или нет витрин с date+city колонками).
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
