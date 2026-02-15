"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { WidgetTable } from "@/components/analytics/WidgetTable"
import { fetchWidget, WidgetRow } from "@/lib/api/analytics-widgets"
import { RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

interface FreshnessRow {
  [k: string]: unknown
  table_name?: string | null
  max_ts?: string | null
  row_count?: number | null
}

interface GapRow {
  [k: string]: unknown
  gap_key?: string | null
  is_gap?: boolean | null
}

interface QualityRow {
  [k: string]: unknown
  check_name?: string | null
  rows_cnt?: number | null
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("ru-RU")
}

export default function QualityPage() {
  const [freshness, setFreshness] = useState<FreshnessRow[]>([])
  const [gaps, setGaps] = useState<GapRow[]>([])
  const [quality, setQuality] = useState<QualityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [freshnessRes, gapsRes, qualityRes] = await Promise.all([
        fetchWidget("data.freshness", { limit: 200 }),
        fetchWidget("data.gaps", { limit: 200 }),
        fetchWidget("data.quality", { limit: 200 }),
      ])
      setFreshness((freshnessRes.items ?? []) as FreshnessRow[])
      setGaps((gapsRes.items ?? []) as GapRow[])
      setQuality((qualityRes.items ?? []) as QualityRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
      setFreshness([])
      setGaps([])
      setQuality([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const latestRefresh = useMemo(() => {
    const timestamps = freshness
      .map((row) => row.max_ts)
      .filter(Boolean)
      .map((value) => new Date(value as string))
      .filter((date) => !Number.isNaN(date.getTime()))
    if (!timestamps.length) return null
    return new Date(Math.max(...timestamps.map((date) => date.getTime())))
  }, [freshness])

  const gapsCount = useMemo(
    () => gaps.filter((row) => row.is_gap).length,
    [gaps]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality & Freshness"
        description="Сигналы готовности данных и актуальности витрин для агентного слоя."
        actions={
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tables monitored</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{freshness.length || "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Open gaps</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{gapsCount || "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Latest refresh</CardTitle>
          </CardHeader>
          <CardContent className="text-base font-medium">
            {latestRefresh ? formatDateTime(latestRefresh.toISOString()) : "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Freshness signals</CardTitle>
        </CardHeader>
        <CardContent>
          <WidgetTable rows={freshness} emptyLabel={loading ? "Loading..." : "Нет данных по свежести"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data gaps</CardTitle>
        </CardHeader>
        <CardContent>
          <WidgetTable rows={gaps} emptyLabel={loading ? "Loading..." : "Нет данных по gaps"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quality checks</CardTitle>
        </CardHeader>
        <CardContent>
          <WidgetTable rows={quality} emptyLabel={loading ? "Loading..." : "Нет данных по качеству"} />
        </CardContent>
      </Card>
    </div>
  )
}
