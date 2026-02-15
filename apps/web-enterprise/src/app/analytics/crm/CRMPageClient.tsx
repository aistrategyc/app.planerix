"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchWidget, fetchWidgetsBatch, fetchWidgetRange, WidgetRow } from "@/lib/api/analytics-widgets"
import { WidgetTable } from "@/components/analytics/WidgetTable"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"
import { KpiSparkline } from "@/app/analytics/components/KpiSparkline"
import { WidgetStatus } from "@/app/analytics/components/WidgetStatus"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { buildLastWeekRange } from "@/app/analytics/utils/defaults"
import { formatCurrency, formatNumber, formatPercent } from "@/app/analytics/utils/formatters"
import { useAuth } from "@/contexts/auth-context"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"

const toDateInput = (value: Date) => value.toISOString().slice(0, 10)

const shiftDate = (value: string, days: number) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

type MetricFormat = "number" | "currency" | "percent"

const formatMetric = (value: unknown, format: MetricFormat = "number") => {
  if (value === null || value === undefined) return "—"
  const numeric = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(numeric)) return String(value)
  if (format === "currency") {
    return formatCurrency(numeric)
  }
  if (format === "percent") {
    return formatPercent(numeric, { digits: 2 })
  }
  return formatNumber(numeric)
}

const toNumber = (value: unknown) => {
  if (value == null) return null
  if (typeof value === "number") return Number.isNaN(value) ? null : value
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const resolveLeadId = (row: WidgetRow) => {
  const leadId = row.lead_id ?? row.leadId ?? row.id
  return leadId ? String(leadId) : null
}

const pickLeadValue = (row: WidgetRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== "") {
      return value
    }
  }
  return null
}

const resolveLeadName = (row: WidgetRow) => {
  const fullName = pickLeadValue(row, ["full_name", "fullName", "name"])
  if (fullName) return String(fullName)
  const firstName = pickLeadValue(row, ["first_name", "firstName"])
  const lastName = pickLeadValue(row, ["last_name", "lastName"])
  const combined = [firstName, lastName].filter(Boolean).join(" ")
  if (combined) return combined
  const leadId = resolveLeadId(row)
  return leadId ? `Lead #${leadId}` : "Lead"
}

const resolveLeadTemperature = (row: WidgetRow) =>
  (pickLeadValue(row, ["temperature", "lead_temperature", "lead_temp"]) as string | null) ?? null

const resolveLeadChannel = (row: WidgetRow) =>
  (pickLeadValue(row, ["first_utm_source", "source", "channel", "utm_source"]) as string | null) ?? null

const resolveLeadProduct = (row: WidgetRow) =>
  (pickLeadValue(row, ["first_course_name", "product", "course_name"]) as string | null) ?? null

const resolveLeadStatus = (row: WidgetRow) =>
  (pickLeadValue(row, ["status", "lead_status", "stage"]) as string | null) ?? null

const resolveLeadCpa = (row: WidgetRow) =>
  (pickLeadValue(row, ["cpa", "cpl", "cost_per_lead", "total_cost"]) as number | string | null) ?? null

const resolveLeadContact = (row: WidgetRow) =>
  (pickLeadValue(row, ["first_phone", "phone", "first_email", "email"]) as string | null) ?? null

const resolveLeadCreated = (row: WidgetRow) =>
  (pickLeadValue(row, ["crm_created_at", "created_at", "date_key", "day_key"]) as string | null) ?? null

const resolveLeadCity = (row: WidgetRow) =>
  (pickLeadValue(row, ["city_name", "city", "branch", "branch_name"]) as string | null) ?? null

const resolveLeadScore = (row: WidgetRow) =>
  (pickLeadValue(row, ["lead_score", "score"]) as number | string | null) ?? null

const getTemperatureBadge = (value: string | null) => {
  if (!value) return { label: "—", variant: "outline" as const }
  const normalized = value.toLowerCase()
  if (normalized.includes("hot")) return { label: "hot", variant: "destructive" as const }
  if (normalized.includes("warm")) return { label: "warm", variant: "warning" as const }
  if (normalized.includes("cold")) return { label: "cold", variant: "secondary" as const }
  return { label: value, variant: "outline" as const }
}

const resolveSourceLabel = (row: WidgetRow) =>
  (pickLeadValue(row, ["source", "utm_source", "channel", "first_utm_source"]) as string | null) ?? "Unknown"

const resolveSourceBranch = (row: WidgetRow) =>
  (pickLeadValue(row, ["branch_name", "branch", "branchName"]) as string | null) ?? null

const resolveSourceMetric = (row: WidgetRow, keys: string[]) => {
  const value = pickLeadValue(row, keys)
  if (typeof value === "number") return value
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export default function CRMAnalyticsPage({ showCrmRawWidgets = false }: { showCrmRawWidgets?: boolean }) {
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
      product: "",
      branch: "",
      source: "",
    }),
    [defaultFrom, today]
  )
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersValue>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFiltersValue>(initialFilters)

  const [kpiRows, setKpiRows] = useState<WidgetRow[]>([])
  const [leadsRows, setLeadsRows] = useState<WidgetRow[]>([])
  const [leadProfileRows, setLeadProfileRows] = useState<WidgetRow[]>([])
  const [funnelRows, setFunnelRows] = useState<WidgetRow[]>([])
  const [sourcePerfRows, setSourcePerfRows] = useState<WidgetRow[]>([])
  const [contractsRows, setContractsRows] = useState<WidgetRow[]>([])
  const [contractsDailyRows, setContractsDailyRows] = useState<WidgetRow[]>([])
  const [funnelDailyRows, setFunnelDailyRows] = useState<WidgetRow[]>([])
  const [kpiCityRows, setKpiCityRows] = useState<WidgetRow[]>([])
  const [crmLeadsRows, setCrmLeadsRows] = useState<WidgetRow[]>([])
  const [metaCreativesRows, setMetaCreativesRows] = useState<WidgetRow[]>([])
  const [paymentsDailyRows, setPaymentsDailyRows] = useState<WidgetRow[]>([])
  const [requestsRows, setRequestsRows] = useState<WidgetRow[]>([])
  const [revenueBySourceRows, setRevenueBySourceRows] = useState<WidgetRow[]>([])
  const [revenueBySourceDailyRows, setRevenueBySourceDailyRows] = useState<WidgetRow[]>([])
  const [slaDailyRows, setSlaDailyRows] = useState<WidgetRow[]>([])
  const [sourcesRows, setSourcesRows] = useState<WidgetRow[]>([])
  const [crmMissing, setCrmMissing] = useState<Record<string, boolean>>({})
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [showAllLeads, setShowAllLeads] = useState(false)
  const [showAllSources, setShowAllSources] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const hasData = kpiRows.length > 0 || leadsRows.length > 0 || funnelRows.length > 0 || sourcePerfRows.length > 0

  const filters = {
    date_from: appliedFilters.dateRange.from ? toDateInput(appliedFilters.dateRange.from) : undefined,
    date_to: appliedFilters.dateRange.to ? toDateInput(appliedFilters.dateRange.to) : undefined,
    id_city: appliedFilters.cityId !== "all" ? Number(appliedFilters.cityId) : undefined,
    product: appliedFilters.product || undefined,
    branch: appliedFilters.branch || undefined,
    source: appliedFilters.source || undefined,
  }

  const fetchCRMWidgets = async () => {
    if (!isAuthenticated || authLoading) return
    setLoading(true)
    try {
      const batch = await fetchWidgetsBatch({
        global_filters: filters,
        widgets: [
          { widget_key: "crm.kpi_cards" },
          { widget_key: "crm.leads_table", limit: 200 },
          { widget_key: "crm.funnel" },
          { widget_key: "crm.sources_performance_daily", limit: 200, order_by: "-contracts_cnt" },
          { widget_key: "crm.contracts", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.contracts_daily", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.funnel_daily", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.kpi_daily_city", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.leads", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.meta_creatives_contracts_daily", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.payments_daily", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.requests", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.revenue_by_source", limit: 200, order_by: "-revenue_sum" },
          { widget_key: "crm.revenue_by_source_daily_city", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.sla_daily", limit: 200, order_by: "-date_key" },
          { widget_key: "crm.sources", limit: 200 },
        ],
      })
      setKpiRows(batch.items["crm.kpi_cards"]?.items ?? [])
      setLeadsRows(batch.items["crm.leads_table"]?.items ?? [])
      setFunnelRows(batch.items["crm.funnel"]?.items ?? [])
      setSourcePerfRows(batch.items["crm.sources_performance_daily"]?.items ?? [])
      setContractsRows(batch.items["crm.contracts"]?.items ?? [])
      setContractsDailyRows(batch.items["crm.contracts_daily"]?.items ?? [])
      setFunnelDailyRows(batch.items["crm.funnel_daily"]?.items ?? [])
      setKpiCityRows(batch.items["crm.kpi_daily_city"]?.items ?? [])
      setCrmLeadsRows(batch.items["crm.leads"]?.items ?? [])
      setMetaCreativesRows(batch.items["crm.meta_creatives_contracts_daily"]?.items ?? [])
      setPaymentsDailyRows(batch.items["crm.payments_daily"]?.items ?? [])
      setRequestsRows(batch.items["crm.requests"]?.items ?? [])
      setRevenueBySourceRows(batch.items["crm.revenue_by_source"]?.items ?? [])
      setRevenueBySourceDailyRows(batch.items["crm.revenue_by_source_daily_city"]?.items ?? [])
      setSlaDailyRows(batch.items["crm.sla_daily"]?.items ?? [])
      setSourcesRows(batch.items["crm.sources"]?.items ?? [])
      setCrmMissing({
        contracts: Boolean(batch.items["crm.contracts"]?.missing_view),
        contracts_daily: Boolean(batch.items["crm.contracts_daily"]?.missing_view),
        funnel_daily: Boolean(batch.items["crm.funnel_daily"]?.missing_view),
        kpi_city: Boolean(batch.items["crm.kpi_daily_city"]?.missing_view),
        leads: Boolean(batch.items["crm.leads"]?.missing_view),
        meta_creatives: Boolean(batch.items["crm.meta_creatives_contracts_daily"]?.missing_view),
        payments: Boolean(batch.items["crm.payments_daily"]?.missing_view),
        requests: Boolean(batch.items["crm.requests"]?.missing_view),
        revenue_by_source: Boolean(batch.items["crm.revenue_by_source"]?.missing_view),
        revenue_by_source_daily: Boolean(batch.items["crm.revenue_by_source_daily_city"]?.missing_view),
        sla: Boolean(batch.items["crm.sla_daily"]?.missing_view),
        sources: Boolean(batch.items["crm.sources"]?.missing_view),
      })
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }

  const fetchLeadProfile = async (leadId: string) => {
    if (!isAuthenticated || authLoading) return
    const profile = await fetchWidget("crm.lead_profile", {
      ...filters,
      entity_id: leadId,
      limit: 200,
    })
    setLeadProfileRows(profile.items)
  }

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    fetchCRMWidgets()
  }, [appliedFilters, isAuthenticated, authLoading])

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    if (activeLeadId) {
      fetchLeadProfile(activeLeadId)
    }
  }, [activeLeadId, appliedFilters, isAuthenticated, authLoading])

  useEffect(() => {
    let isActive = true
    const hydrateRange = async () => {
      try {
        if (!isAuthenticated || authLoading) return
        const range = await fetchWidgetRange("crm.funnel")
        if (!isActive) return
        const dateRange = buildLastWeekRange(range.max_date)
        if (!dateRange) return
        const nextFilters: AnalyticsFiltersValue = {
          ...initialFilters,
          dateRange: dateRange,
        }
        setDraftFilters(nextFilters)
        setAppliedFilters(nextFilters)
      } catch {
        // fallback to default
      }
    }
    hydrateRange()
    return () => {
      isActive = false
    }
  }, [cities, initialFilters, isAuthenticated, authLoading])

  const resetFilters = () => {
    setDraftFilters(initialFilters)
    setAppliedFilters(initialFilters)
  }

  const applyFilters = () => {
    setAppliedFilters(draftFilters)
  }

  const kpiSeries = useMemo(() => {
    const map = new Map<string, Array<{ date: string; value: number; delta: number | null }>>()
    kpiRows.forEach((row) => {
      const key = (row.metric_key ?? row.metricKey ?? row.key) as string | null
      if (!key) return
      const date =
        (row.as_of_date ?? row.asOfDate ?? row.date_key ?? row.dateKey) as string | null
      if (!date) return
      const value = toNumber(row.metric_value ?? row.metricValue ?? row.value)
      if (value == null) return
      const delta = toNumber(row.delta_value ?? row.deltaValue ?? row.delta)
      const series = map.get(key) ?? []
      series.push({ date, value, delta })
      map.set(key, series)
    })

    map.forEach((series) => {
      series.sort((a, b) => a.date.localeCompare(b.date))
    })
    return map
  }, [kpiRows])

  const kpiByKey = useMemo(() => {
    const map = new Map<string, { value: number | null; delta: number | null }>()
    kpiSeries.forEach((series, key) => {
      const latest = series[series.length - 1]
      map.set(key, {
        value: latest?.value ?? null,
        delta: latest?.delta ?? null,
      })
    })
    return map
  }, [kpiSeries])

  const kpiSparklines = useMemo(() => {
    const map = new Map<string, Array<{ value: number | null }>>()
    kpiSeries.forEach((series, key) => {
      map.set(
        key,
        series.map((item) => ({ value: item.value }))
      )
    })
    return map
  }, [kpiSeries])

  const sourcesTableRows = useMemo(() => {
    const rows = sourcePerfRows
      .map((row) => {
        const leads = resolveSourceMetric(row, ["leads_cnt", "leads", "requests_cnt"]) ?? 0
        const contracts = resolveSourceMetric(row, ["contracts_cnt", "contracts"]) ?? 0
        const revenue = resolveSourceMetric(row, ["revenue", "paid_sum", "crm_paid_sum"]) ?? 0
        return {
          label: resolveSourceLabel(row),
          branch: resolveSourceBranch(row),
          leads,
          contracts,
          revenue,
          conversion: leads > 0 ? contracts / leads : null,
        }
      })
      .filter((row) => row.leads > 0 || row.contracts > 0 || row.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue || b.contracts - a.contracts)
    return showAllSources ? rows : rows.slice(0, 12)
  }, [showAllSources, sourcePerfRows])

  const topSources = useMemo(() => {
    const rows = sourcePerfRows
      .map((row) => {
        const leads = resolveSourceMetric(row, ["leads_cnt", "leads", "requests_cnt"])
        const contracts = resolveSourceMetric(row, ["contracts_cnt", "contracts"])
        const revenue = resolveSourceMetric(row, ["revenue", "paid_sum", "crm_paid_sum"])
        return {
          label: resolveSourceLabel(row),
          leads: leads ?? 0,
          contracts: contracts ?? 0,
          revenue: revenue ?? 0,
        }
      })
      .filter((row) => row.leads > 0 || row.contracts > 0 || row.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue || b.contracts - a.contracts)
    const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0)
    const totalContracts = rows.reduce((sum, row) => sum + row.contracts, 0)
    return rows.slice(0, 8).map((row) => ({
      ...row,
      revenueShare: totalRevenue > 0 ? row.revenue / totalRevenue : null,
      contractsShare: totalContracts > 0 ? row.contracts / totalContracts : null,
    }))
  }, [sourcePerfRows])

  const funnelTotals = useMemo(() => {
    type FunnelTotals = {
      requests: number
      leads: number
      contracts: number
      contractsSum: number
      paidSum: number
      paymentsSum: number
    }

    return funnelRows.reduce<FunnelTotals>(
      (acc, row) => {
        acc.requests += toNumber(row.requests_cnt) ?? 0
        acc.leads += toNumber(row.leads_cnt) ?? 0
        acc.contracts += toNumber(row.contracts_cnt) ?? 0
        acc.contractsSum += toNumber(row.contracts_sum) ?? 0
        acc.paidSum += toNumber(row.paid_sum) ?? 0
        acc.paymentsSum += toNumber(row.payments_sum) ?? 0
        return acc
      },
      { requests: 0, leads: 0, contracts: 0, contractsSum: 0, paidSum: 0, paymentsSum: 0 }
    )
  }, [funnelRows])

  const derivedKpis = useMemo(() => {
    const avgCheck = funnelTotals.contracts > 0 ? funnelTotals.paidSum / funnelTotals.contracts : null
    const leadToContract = funnelTotals.leads > 0 ? funnelTotals.contracts / funnelTotals.leads : null
    return [
      { key: "requests", label: "Requests", value: funnelTotals.requests, format: "number" as MetricFormat },
      { key: "leads", label: "Leads", value: funnelTotals.leads, format: "number" as MetricFormat },
      { key: "contracts", label: "Contracts", value: funnelTotals.contracts, format: "number" as MetricFormat },
      { key: "paid_sum", label: "Paid revenue", value: funnelTotals.paidSum, format: "currency" as MetricFormat },
      { key: "avg_check", label: "Avg check", value: avgCheck, format: "currency" as MetricFormat },
      { key: "lead_to_contract", label: "Lead → Contract", value: leadToContract, format: "percent" as MetricFormat },
    ]
  }, [funnelTotals])

  const marketingKpis = useMemo(() => {
    const items = [
      { key: "ads_spend_total", label: "Ads spend", format: "currency" as MetricFormat },
      { key: "meta_leads", label: "Meta leads", format: "number" as MetricFormat },
      { key: "meta_cpl", label: "Meta CPL", format: "currency" as MetricFormat },
      { key: "meta_roas_paid", label: "Meta ROAS", format: "number" as MetricFormat },
    ]
    return items
      .map((item) => ({ ...item, value: kpiByKey.get(item.key)?.value ?? null, delta: kpiByKey.get(item.key)?.delta }))
      .filter((item) => item.value !== null)
  }, [kpiByKey])

  const highlightItems = useMemo(() => {
    const items = []
    if (funnelTotals.paidSum > 0) {
      items.push({ label: "Paid revenue", value: formatMetric(funnelTotals.paidSum, "currency") })
    }
    if (funnelTotals.contracts > 0) {
      items.push({ label: "Contracts", value: formatMetric(funnelTotals.contracts, "number") })
    }
    if (funnelTotals.leads > 0) {
      const leadToContract = funnelTotals.contracts / funnelTotals.leads
      items.push({ label: "Lead → Contract", value: formatMetric(leadToContract, "percent") })
    }
    if (funnelTotals.contracts > 0 && funnelTotals.paidSum > 0) {
      items.push({
        label: "Avg check",
        value: formatMetric(funnelTotals.paidSum / funnelTotals.contracts, "currency"),
      })
    }
    if (items.length === 0) {
      const paidRevenue = kpiByKey.get("crm_paid_sum")?.value ?? null
      if (paidRevenue !== null) {
        items.push({ label: "Paid revenue", value: formatMetric(paidRevenue, "currency") })
      }
    }
    return items
  }, [funnelTotals, kpiByKey])

  const renderDelta = (value: number | null) => {
    if (value == null) return null
    const isPositive = value >= 0
    const formatted = formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (
      <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
        {isPositive && value !== 0 ? "+" : ""}
        {formatted}
      </span>
    )
  }

  const crmTrendData = useMemo(() => {
    if (funnelRows.length > 0) {
      return funnelRows
        .map((row) => ({
          date: (row.date_key ?? row.day_key) as string,
          leads: toNumber(row.leads_cnt) ?? 0,
          contracts: toNumber(row.contracts_cnt) ?? 0,
          revenue: (toNumber(row.paid_sum) ?? 0) || (toNumber(row.contracts_sum) ?? 0),
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }
    const bucket = new Map<string, { date: string; leads: number; contracts: number; revenue: number }>()
    sourcePerfRows.forEach((row) => {
      const date = (row.date_key ?? row.dateKey) as string | null
      if (!date) return
      const entry = bucket.get(date) ?? { date, leads: 0, contracts: 0, revenue: 0 }
      entry.leads += toNumber(row.leads_cnt) ?? 0
      entry.contracts += toNumber(row.contracts_cnt) ?? 0
      entry.revenue += toNumber(row.revenue) ?? 0
      bucket.set(date, entry)
    })
    return Array.from(bucket.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [funnelRows, sourcePerfRows])

  const resolveCityName = (id?: number | null) => {
    if (!id) return "—"
    const city = cities.find((item) => item.id_city === id)
    return city?.city_name ?? `City #${id}`
  }

  const funnelTableRows = useMemo(() => {
    return [...funnelRows]
      .map((row) => ({
        date: (row.date_key ?? row.day_key) as string,
        city: resolveCityName(toNumber(row.city_id ?? row.id_city) ?? null),
        requests: toNumber(row.requests_cnt) ?? 0,
        leads: toNumber(row.leads_cnt) ?? 0,
        contracts: toNumber(row.contracts_cnt) ?? 0,
        paid: toNumber(row.paid_sum) ?? 0,
        payments: toNumber(row.payments_sum) ?? 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [funnelRows, cities])

  const leadSummary = useMemo(() => {
    const row = leadProfileRows[0]
    if (!row) return []
    const hasFullName = row.full_name || row.fullName
    const candidates = [
      { key: "full_name", label: "Имя" },
      { key: "fullName", label: "Имя" },
      { key: "first_name", label: "Имя" },
      { key: "last_name", label: "Фамилия" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Телефон" },
      { key: "temperature", label: "Температура" },
      { key: "lead_score", label: "Lead score" },
      { key: "status", label: "Статус" },
      { key: "city_name", label: "Город" },
      { key: "first_course_name", label: "Продукт" },
      { key: "first_utm_source", label: "Источник" },
    ]
    const items = []
    for (const candidate of candidates) {
      if (hasFullName && (candidate.key === "first_name" || candidate.key === "last_name")) {
        continue
      }
      const value = row[candidate.key]
      if (value === null || value === undefined || value === "") continue
      items.push({ label: candidate.label, value: String(value) })
      if (items.length >= 6) break
    }
    return items
  }, [leadProfileRows])

  const filteredLeadProfileRows = useMemo(() => {
    if (!leadProfileRows.length) return leadProfileRows
    const keys = Object.keys(leadProfileRows[0])
    const keep = keys.filter((key) =>
      leadProfileRows.some((row) => row[key] !== null && row[key] !== undefined && row[key] !== "")
    )
    return leadProfileRows.map((row) => {
      const filtered: WidgetRow = {}
      keep.forEach((key) => {
        filtered[key] = row[key]
      })
      return filtered
    })
  }, [leadProfileRows])

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM & Client Analytics"
        description="Воронка, лиды и эффективность коммуникаций по выбранным фильтрам."
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

      {hasLoaded && !loading && !hasData && (
        <AnalyticsEmptyState
          context="crm"
          title="Нет данных CRM"
          description="Подключите CRM/формы заявок, чтобы лиды и воронка начали заполняться."
          connectionGate
          className="max-w-3xl mx-auto"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ключевые показатели</CardTitle>
          <CardDescription>Основные метрики по воронке за выбранный период.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {derivedKpis.map((item) => (
            <div key={item.key} className="rounded-xl border border-border bg-card/40 p-4">
              <div className="text-sm text-muted-foreground">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold">{formatMetric(item.value, item.format)}</div>
            </div>
          ))}
        </CardContent>
        {marketingKpis.length > 0 && (
          <CardContent className="grid gap-4 md:grid-cols-4 pt-0">
            {marketingKpis.map((item) => {
              const sparkline = kpiSparklines.get(item.key) ?? []
              return (
                <div key={item.key} className="rounded-xl border border-border bg-card/40 p-4">
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xl font-semibold">{formatMetric(item.value, item.format)}</div>
                      {item.delta != null && (
                        <div className="mt-1 text-xs text-muted-foreground">Δ {renderDelta(item.delta)}</div>
                      )}
                    </div>
                    <div className="w-20 shrink-0">
                      <KpiSparkline data={sparkline} />
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CRM trend</CardTitle>
          <CardDescription>Динамика лидов, контрактов и выручки за период.</CardDescription>
        </CardHeader>
        <CardContent>
          {crmTrendData.length === 0 ? (
            <WidgetStatus
              title="Нет данных для тренда"
              description="Источник crm.sources_performance_daily ещё не обновился."
            />
          ) : (
            <div className="h-[260px]">
              <SafeResponsiveContainer>
                <ComposedChart data={crmTrendData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="crmLeadsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="crmRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...chartGridProps} vertical={false} />
                  <XAxis dataKey="date" {...chartAxisProps} />
                  <YAxis yAxisId="left" {...chartAxisProps} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    {...chartAxisProps}
                    tickFormatter={(value) => formatNumber(value as number)}
                  />
	                  <Tooltip
	                    formatter={(value, name) => {
	                      const label = String(name)
	                      if (value === null || value === undefined) return ["—", label]
	                      const numeric = typeof value === "number" ? value : Number(value)
	                      if (label === "revenue") return [formatCurrency(numeric), "Revenue"]
	                      return [formatNumber(numeric), label === "leads" ? "Leads" : "Contracts"]
	                    }}
	                    contentStyle={chartTooltipStyle}
	                    itemStyle={chartTooltipItemStyle}
	                  />
                  <Area type="monotone" dataKey="leads" stroke={CHART_COLORS.primary} fill="url(#crmLeadsFill)" strokeWidth={2} dot={false} yAxisId="left" />
                  <Line type="monotone" dataKey="contracts" stroke={CHART_COLORS.quaternary} strokeWidth={2} dot={false} yAxisId="left" />
                  <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.secondary} fill="url(#crmRevenueFill)" strokeWidth={2} dot={false} yAxisId="right" />
                </ComposedChart>
              </SafeResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CRM Highlights</CardTitle>
          <CardDescription>Быстрые выводы по текущим показателям.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {highlightItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Недостаточно данных для выводов.</div>
          ) : (
            highlightItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-sm text-muted-foreground">{item.label}</div>
                <div className="text-xl font-semibold">{item.value}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Sources performance</CardTitle>
            <CardDescription>Лиды, контракты и выручка по ключевым каналам.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{sourcePerfRows.length} rows</Badge>
            {sourcePerfRows.length > 10 && (
              <Button size="sm" variant="outline" onClick={() => setShowAllSources((prev) => !prev)}>
                {showAllSources ? "Collapse" : "Show all"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="table" className="w-full space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="table">Sources table</TabsTrigger>
              <TabsTrigger value="top">Top by revenue</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              {sourcesTableRows.length === 0 ? (
                <AnalyticsEmptyState
                  context="crm"
                  title="Нет данных по источникам"
                  description="Проверьте витрину crm.sources_performance_daily."
                  size="sm"
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Source</th>
                        <th className="px-3 py-2 text-left">Branch</th>
                        <th className="px-3 py-2 text-right">Leads</th>
                        <th className="px-3 py-2 text-right">Contracts</th>
                        <th className="px-3 py-2 text-right">CR</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourcesTableRows.map((row) => (
                        <tr key={`${row.label}-${row.branch ?? ""}`} className="border-t border-border">
                          <td className="px-3 py-2">{row.label}</td>
                          <td className="px-3 py-2">{row.branch ?? "—"}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(row.leads)}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(row.contracts)}</td>
                          <td className="px-3 py-2 text-right">
                            {row.conversion != null ? formatPercent(row.conversion, { digits: 1 }) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
            <TabsContent value="top">
              {topSources.length === 0 ? (
                <WidgetStatus title="Нет данных по источникам" description="Данные по источникам пока отсутствуют." />
              ) : (
                <div className="space-y-3">
                  {topSources.map((row) => (
                    <div key={row.label} className="rounded-xl border border-border bg-card/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{row.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(row.revenue)} · {formatNumber(row.contracts)} contracts
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Revenue share</span>
                          <span>{row.revenueShare != null ? formatPercent(row.revenueShare, { digits: 1 }) : "—"}</span>
                        </div>
                        <Progress value={row.revenueShare != null ? row.revenueShare * 100 : 0} />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Contracts share</span>
                          <span>{row.contractsShare != null ? formatPercent(row.contractsShare, { digits: 1 }) : "—"}</span>
                        </div>
                        <Progress value={row.contractsShare != null ? row.contractsShare * 100 : 0} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Leads Table</CardTitle>
            <CardDescription>Список лидов с температурой, продуктом и каналом.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{leadsRows.length} rows</Badge>
            {leadsRows.length > 24 && (
              <Button size="sm" variant="outline" onClick={() => setShowAllLeads((prev) => !prev)}>
                {showAllLeads ? "Collapse" : "Show all"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {leadsRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Нет лидов для выбранных фильтров.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(showAllLeads ? leadsRows : leadsRows.slice(0, 24)).map((row) => {
                const leadId = resolveLeadId(row)
                const name = resolveLeadName(row)
                const temperature = resolveLeadTemperature(row)
                const channel = resolveLeadChannel(row)
                const productValue = resolveLeadProduct(row)
                const status = resolveLeadStatus(row)
                const city = resolveLeadCity(row)
                const score = resolveLeadScore(row)
                const cpaValue = resolveLeadCpa(row)
                const contactValue = resolveLeadContact(row)
                const createdValue = resolveLeadCreated(row)
                const hasContract = row.has_contract ?? row.hasContract
                const tempBadge = getTemperatureBadge(temperature)
                return (
                  <button
                    key={leadId ?? name}
                    type="button"
                    onClick={() => leadId && setActiveLeadId(leadId)}
                    className="rounded-xl border border-border bg-card/40 p-4 text-left transition hover:border-primary/30 hover:bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{name}</div>
                        {city && <div className="text-xs text-muted-foreground">{city}</div>}
                      </div>
                      <Badge variant={tempBadge.variant} className="text-xs uppercase">
                        {tempBadge.label}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {createdValue && <span>{String(createdValue).slice(0, 10)}</span>}
                      {contactValue && <span>{contactValue}</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {channel && (
                        <Badge variant="secondary" className="text-xs">
                          {channel}
                        </Badge>
                      )}
                      {productValue && (
                        <Badge variant="outline" className="text-xs">
                          {productValue}
                        </Badge>
                      )}
                      {status && (
                        <Badge variant="outline" className="text-xs">
                          {status}
                        </Badge>
                      )}
                      {typeof hasContract === "boolean" && (
                        <Badge variant={hasContract ? "success" : "outline"} className="text-xs">
                          {hasContract ? "Contract" : "No contract"}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">CPA</div>
                        <div className="font-semibold">
                          {typeof cpaValue === "number"
                            ? formatMetric(cpaValue, "currency")
                            : cpaValue
                            ? formatMetric(Number(cpaValue), "currency")
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Lead score</div>
                        <div className="font-semibold">
                          {score == null ? "—" : formatMetric(Number(score), "number")}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
              {leadsRows.length > 24 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                  Показано 24 з {leadsRows.length}. Уточните фильтры, чтобы видеть больше.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Lead Profile</CardTitle>
            <CardDescription>Детальная карточка выбранного лида.</CardDescription>
          </div>
          {activeLeadId && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Lead {activeLeadId}</Badge>
              <Button variant="ghost" size="sm" onClick={() => setActiveLeadId(null)}>
                Очистить
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {activeLeadId ? (
            <div className="space-y-4">
              {leadSummary.length > 0 && (
                <div className="grid gap-3 md:grid-cols-3">
                  {leadSummary.map((item) => (
                    <div key={item.label} className="rounded-xl border border-border bg-card/40 p-4">
                      <div className="text-sm text-muted-foreground">{item.label}</div>
                      <div className="text-base font-semibold">{item.value}</div>
                    </div>
                  ))}
                </div>
              )}
              <WidgetTable rows={filteredLeadProfileRows} emptyLabel="Нет данных профиля" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Выберите лид из таблицы выше.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Contracts by City</CardTitle>
            <CardDescription>Города, заявки, лиды и платежи по дням.</CardDescription>
          </div>
          <Badge variant="secondary">{funnelTableRows.length} rows</Badge>
        </CardHeader>
        <CardContent>
          {funnelTableRows.length === 0 ? (
            <WidgetStatus title="Нет данных по контрактам" description="Витрина crm.funnel ещё пуста." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">City</th>
                    <th className="px-3 py-2 text-right">Requests</th>
                    <th className="px-3 py-2 text-right">Leads</th>
                    <th className="px-3 py-2 text-right">Contracts</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelTableRows.slice(0, 14).map((row) => (
                    <tr key={`${row.date}-${row.city}`} className="border-t border-border">
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">{row.city}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(row.requests)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(row.leads)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(row.contracts)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(row.paid)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(row.payments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {funnelTableRows.length > 14 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Показано 14 из {funnelTableRows.length}. Уточните фильтры, чтобы видеть больше.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showCrmRawWidgets && (
        <Card>
          <CardHeader>
            <CardTitle>CRM raw widgets</CardTitle>
            <CardDescription>Служебные таблицы CRM (для проверки наполненности).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-semibold">Contracts</div>
              {crmMissing.contracts ? (
                <WidgetStatus title="Нет витрины contracts" description="crm.contracts не подключена." />
              ) : (
                <WidgetTable rows={contractsRows} emptyLabel="Нет данных contracts." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Contracts daily</div>
              {crmMissing.contracts_daily ? (
                <WidgetStatus title="Нет витрины contracts_daily" description="crm.contracts_daily не подключена." />
              ) : (
                <WidgetTable rows={contractsDailyRows} emptyLabel="Нет данных contracts_daily." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Funnel daily</div>
              {crmMissing.funnel_daily ? (
                <WidgetStatus title="Нет витрины funnel_daily" description="crm.funnel_daily не подключена." />
              ) : (
                <WidgetTable rows={funnelDailyRows} emptyLabel="Нет данных funnel_daily." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">KPI daily city</div>
              {crmMissing.kpi_city ? (
                <WidgetStatus title="Нет витрины kpi_daily_city" description="crm.kpi_daily_city не подключена." />
              ) : (
                <WidgetTable rows={kpiCityRows} emptyLabel="Нет данных kpi_daily_city." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Leads</div>
              {crmMissing.leads ? (
                <WidgetStatus title="Нет витрины leads" description="crm.leads не подключена." />
              ) : (
                <WidgetTable rows={crmLeadsRows} emptyLabel="Нет данных leads." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Meta creatives contracts</div>
              {crmMissing.meta_creatives ? (
                <WidgetStatus
                  title="Нет витрины meta_creatives"
                  description="crm.meta_creatives_contracts_daily не подключена."
                />
              ) : (
                <WidgetTable rows={metaCreativesRows} emptyLabel="Нет данных meta_creatives." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Payments daily</div>
              {crmMissing.payments ? (
                <WidgetStatus title="Нет витрины payments_daily" description="crm.payments_daily не подключена." />
              ) : (
                <WidgetTable rows={paymentsDailyRows} emptyLabel="Нет данных payments_daily." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Requests</div>
              {crmMissing.requests ? (
                <WidgetStatus title="Нет витрины requests" description="crm.requests не подключена." />
              ) : (
                <WidgetTable rows={requestsRows} emptyLabel="Нет данных requests." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Revenue by source</div>
              {crmMissing.revenue_by_source ? (
                <WidgetStatus title="Нет витрины revenue_by_source" description="crm.revenue_by_source не подключена." />
              ) : (
                <WidgetTable rows={revenueBySourceRows} emptyLabel="Нет данных revenue_by_source." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Revenue by source (daily)</div>
              {crmMissing.revenue_by_source_daily ? (
                <WidgetStatus
                  title="Нет витрины revenue_by_source_daily"
                  description="crm.revenue_by_source_daily_city не подключена."
                />
              ) : (
                <WidgetTable rows={revenueBySourceDailyRows} emptyLabel="Нет данных revenue_by_source_daily." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">SLA daily</div>
              {crmMissing.sla ? (
                <WidgetStatus title="Нет витрины SLA" description="crm.sla_daily не подключена." />
              ) : (
                <WidgetTable rows={slaDailyRows} emptyLabel="Нет данных SLA." />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold">Sources</div>
              {crmMissing.sources ? (
                <WidgetStatus title="Нет витрины sources" description="crm.sources не подключена." />
              ) : (
                <WidgetTable rows={sourcesRows} emptyLabel="Нет данных sources." />
              )}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
