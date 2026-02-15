"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { WidgetTable } from "@/components/analytics/WidgetTable"
import { api } from "@/lib/api/config"
import { RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

interface FreshnessRow {
  agent_key?: string | null
  as_of_date?: string | null
  obj?: string | null
  last_ts?: string | null
}

interface AgentReadyRow {
  date_key?: string | null
  id_city?: number | null
  city_name?: string | null
  contracts_all?: number | null
  contracts_meta?: number | null
  contracts_gads?: number | null
  contracts_offline?: number | null
  spend_all?: number | null
  spend_meta?: number | null
  spend_gads?: number | null
  cpa_all_contracts?: number | null
  cpa_paid_contracts?: number | null
  offline_share?: number | null
  refreshed_at?: string | null
}

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("ru-RU")
}

export default function QualityPage() {
  const [freshness, setFreshness] = useState<FreshnessRow[]>([])
  const [agentReady, setAgentReady] = useState<AgentReadyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [freshnessRes, agentReadyRes] = await Promise.all([
        api.get("/analytics/data-quality/freshness"),
        api.get("/analytics/data-quality/agent-ready"),
      ])
      setFreshness(freshnessRes.data?.items ?? [])
      setAgentReady(agentReadyRes.data?.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
      setFreshness([])
      setAgentReady([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const latestRefresh = useMemo(() => {
    const timestamps = freshness
      .map((row) => row.last_ts)
      .filter(Boolean)
      .map((value) => new Date(value as string))
      .filter((date) => !Number.isNaN(date.getTime()))
    if (!timestamps.length) return null
    return new Date(Math.max(...timestamps.map((date) => date.getTime())))
  }, [freshness])

  const agentsCount = useMemo(() => {
    return new Set(freshness.map((row) => row.agent_key).filter(Boolean)).size
  }, [freshness])

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
            <CardTitle className="text-sm text-muted-foreground">Agents monitored</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{agentsCount || "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Freshness rows</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{freshness.length || "—"}</CardContent>
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
          <CardTitle className="text-lg">Agent-ready signals</CardTitle>
        </CardHeader>
        <CardContent>
          <WidgetTable rows={agentReady} emptyLabel={loading ? "Loading..." : "Нет данных по готовности"} />
        </CardContent>
      </Card>
    </div>
  )
}
