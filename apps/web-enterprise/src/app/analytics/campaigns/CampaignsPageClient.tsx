"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter } from 'recharts'
import { Target, TrendingUp, Activity, Eye, Search, Calendar, BarChart3 } from "lucide-react"
import { AnalyticsAPI } from "@/lib/api/analytics"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"
import { fetchWidgetRange } from "@/lib/api/analytics-widgets"
import { buildLastWeekRange, resolveDefaultCityId } from "@/app/analytics/utils/defaults"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"
import { formatCurrency, formatNumber, formatPercent } from "@/app/analytics/utils/formatters"
import { ExecutiveSummary, type ExecutiveSummaryItem } from "@/components/analytics/ExecutiveSummary"
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton"
import { useCities } from "@/app/analytics/hooks/use_cities"

interface CampaignData {
  campaigns: Array<{
    date: string
    platform: string
    campaign_key: string
    impressions: number
    clicks: number
    cost: number
    ctr_pct: number
    cpc: number
    cpm: number
    leads: number
    contracts: number
    revenue: number
    payments: number
    payback_rate: number
  }>
  latest_activity: Array<{
    platform: string
    campaign_key: string
    first_seen: string
    last_active_date: string
  }>
  rolling_7d: Array<{
    platform: string
    campaign_key: string
    impressions_7d: number
    clicks_7d: number
    cost_7d: number
    leads_7d: number
    contracts_7d: number
    revenue_7d: number
    payments_7d: number
    avg_ctr_7d: number
    avg_cpc_7d: number
    avg_cpm_7d: number
  }>
}

const formatRuble = (value: number) =>
  formatCurrency(value, { currencyCode: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 2 })
const formatPercentValue = (value: number) => formatPercent(value, { digits: 2, assumeRatio: false })

const buildDateKey = (value: Date) => value.toISOString().slice(0, 10)

const parseDateParam = (value: string | null) => {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed
}

export default function CampaignsPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const { cities } = useCities()
  const defaultCityId = useMemo(() => resolveDefaultCityId(cities), [cities])
  const [data, setData] = useState<CampaignData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [viewType, setViewType] = useState<string>("performance")
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersValue>({ dateRange: {}, cityId: "all" })
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFiltersValue>({ dateRange: {}, cityId: "all" })
  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)

  useEffect(() => {
    const cityParam = searchParams.get("city_id") ?? searchParams.get("id_city")
    const cityId = cityParam ?? (defaultCityId ? String(defaultCityId) : "all")
    const nextFilters: AnalyticsFiltersValue = {
      dateRange: {
        from: parseDateParam(searchParams.get("date_from")),
        to: parseDateParam(searchParams.get("date_to")),
      },
      cityId,
    }
    setDraftFilters(nextFilters)
    setAppliedFilters(nextFilters)
  }, [searchKey, searchParams, defaultCityId])

  useEffect(() => {
    if (defaultsApplied) return
    if (searchParams.get("date_from") || searchParams.get("date_to")) {
      setDefaultsApplied(true)
      return
    }
    let active = true
    const hydrateDefaults = async () => {
      try {
        const range = await fetchWidgetRange("campaigns.table")
        if (!active) return
        const dateRange = buildLastWeekRange(range?.max_date ?? null, 59)
        if (!dateRange) {
          setDefaultsApplied(true)
          return
        }
        const nextFilters: AnalyticsFiltersValue = {
          dateRange,
          cityId: defaultCityId ? String(defaultCityId) : "all",
        }
        setDraftFilters(nextFilters)
        setAppliedFilters(nextFilters)
      } finally {
        if (active) setDefaultsApplied(true)
      }
    }
    hydrateDefaults()
    return () => {
      active = false
    }
  }, [defaultsApplied, searchParams, defaultCityId])

  const updateQuery = (updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }

  const applyFilters = () => {
    if (!draftFilters.dateRange.from || !draftFilters.dateRange.to) {
      setDateError("Select a date range to apply filters.")
      return
    }
    setDateError(null)
    setAppliedFilters(draftFilters)
    updateQuery({
      date_from: draftFilters.dateRange.from ? buildDateKey(draftFilters.dateRange.from) : null,
      date_to: draftFilters.dateRange.to ? buildDateKey(draftFilters.dateRange.to) : null,
      city_id: draftFilters.cityId !== "all" ? draftFilters.cityId : null,
    })
  }

  const resetFilters = () => {
    const resetValue: AnalyticsFiltersValue = {
      dateRange: {},
      cityId: defaultCityId ? String(defaultCityId) : "all",
    }
    setDraftFilters(resetValue)
    setAppliedFilters(resetValue)
    setDateError(null)
    updateQuery({
      date_from: null,
      date_to: null,
      city_id: resetValue.cityId !== "all" ? resetValue.cityId : null,
    })
  }

  const apiDateRange = useMemo(() => {
    if (!appliedFilters.dateRange.from || !appliedFilters.dateRange.to) return null
    return {
      start_date: buildDateKey(appliedFilters.dateRange.from),
      end_date: buildDateKey(appliedFilters.dateRange.to),
    }
  }, [appliedFilters.dateRange])

  useEffect(() => {
    fetchData()
  }, [searchTerm, apiDateRange, appliedFilters.cityId])

  const fetchData = async () => {
    if (!apiDateRange) return
    try {
      setLoading(true)
      setError(null)

      const campaignKey = searchTerm || undefined
      const result = await AnalyticsAPI.getMarketingCampaigns(
        apiDateRange,
        undefined,
        campaignKey,
        appliedFilters.cityId
      )
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
      console.error("Fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  // Подготовка данных для временного графика
  const prepareTimelineData = () => {
    if (!data?.campaigns) return []

    const groupedByDate = data.campaigns.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = {
          date: item.date,
          totalCost: 0,
          totalClicks: 0,
          totalImpressions: 0,
          totalLeads: 0,
          totalContracts: 0,
          totalRevenue: 0,
          totalPayments: 0,
        }
      }
      acc[item.date].totalCost += item.cost
      acc[item.date].totalClicks += item.clicks
      acc[item.date].totalImpressions += item.impressions
      acc[item.date].totalLeads += item.leads
      acc[item.date].totalContracts += item.contracts
      acc[item.date].totalRevenue += item.revenue
      acc[item.date].totalPayments += item.payments
      return acc
    }, {} as Record<string, any>)

    return Object.values(groupedByDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // Показать последние 30 дней
      .map((row) => ({
        ...row,
        conversionRate: row.totalLeads > 0 ? (row.totalContracts / row.totalLeads) * 100 : 0,
      }))
  }

  // Подготовка scatter data для эффективности
  const prepareEfficiencyScatter = () => {
    if (!data?.rolling_7d) return []

    return data.rolling_7d
      .filter(item => item.cost_7d > 0 && item.avg_ctr_7d > 0)
      .map(item => ({
        x: item.avg_ctr_7d,
        y: item.avg_cpc_7d,
        size: Math.log(item.cost_7d) * 10,
        campaign: item.campaign_key.substring(0, 20) + "...",
        platform: item.platform,
        cost: item.cost_7d
      }))
  }

  // Топ кампании по затратам
  const prepareTopCampaigns = () => {
    if (!data?.rolling_7d) return []

    return data.rolling_7d
      .sort((a, b) => b.cost_7d - a.cost_7d)
      .slice(0, 15)
  }

  // Вычисление общих метрик
  const calculateTotals = () => {
    if (!data?.rolling_7d) return {
      totalCampaigns: 0,
      totalCost: 0,
      totalClicks: 0,
      totalImpressions: 0,
      totalLeads: 0,
      totalContracts: 0,
      totalRevenue: 0,
      totalPayments: 0,
      avgCTR: 0,
      avgCPC: 0,
      leadToContract: 0,
    }

    const totals = data.rolling_7d.reduce((acc, item) => {
      acc.totalCost += item.cost_7d
      acc.totalClicks += item.clicks_7d
      acc.totalImpressions += item.impressions_7d
      acc.totalLeads += item.leads_7d
      acc.totalContracts += item.contracts_7d
      acc.totalRevenue += item.revenue_7d
      acc.totalPayments += item.payments_7d
      return acc
    }, {
      totalCost: 0,
      totalClicks: 0,
      totalImpressions: 0,
      totalLeads: 0,
      totalContracts: 0,
      totalRevenue: 0,
      totalPayments: 0,
    })

    const avgCTR = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0
    const avgCPC = totals.totalClicks > 0 ? totals.totalCost / totals.totalClicks : 0
    const leadToContract = totals.totalLeads > 0 ? (totals.totalContracts / totals.totalLeads) * 100 : 0

    return {
      totalCampaigns: data.rolling_7d.length,
      ...totals,
      avgCTR,
      avgCPC,
      leadToContract,
    }
  }

  const totals = calculateTotals()
  const timelineData = prepareTimelineData()
  const efficiencyScatter = prepareEfficiencyScatter()
  const topCampaigns = prepareTopCampaigns()
  const spendDelta = useMemo(() => {
    if (!data?.campaigns?.length) return null
    const byDate = new Map<string, number>()
    data.campaigns.forEach((row) => {
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.cost)
    })
    const dates = Array.from(byDate.keys()).sort()
    if (dates.length < 14) return null
    const last7 = dates.slice(-7).reduce((sum, date) => sum + (byDate.get(date) ?? 0), 0)
    const prev7 = dates.slice(-14, -7).reduce((sum, date) => sum + (byDate.get(date) ?? 0), 0)
    if (!prev7) return { last7, prev7, deltaPct: null }
    return { last7, prev7, deltaPct: (last7 - prev7) / prev7 }
  }, [data?.campaigns])
  const summaryItems: ExecutiveSummaryItem[] = [
    {
      title: "Spend (7d)",
      kpi: formatRuble(spendDelta?.last7 ?? totals.totalCost),
      deltaLabel: spendDelta?.deltaPct == null ? "n/a" : formatPercentValue(spendDelta.deltaPct * 100),
      deltaDirection: spendDelta?.deltaPct == null ? "flat" : spendDelta.deltaPct >= 0 ? "up" : "down",
      reason: spendDelta?.deltaPct == null ? "Insufficient prior period for comparison." : "Spend moved vs previous 7d.",
      action: "Reallocate budget to campaigns with best CTR/CPC.",
      impact: spendDelta?.deltaPct == null
        ? "Track spend efficiency by campaign."
        : `${formatRuble(Math.abs((spendDelta.last7 ?? 0) - (spendDelta.prev7 ?? 0)))} delta vs prev 7d.`,
    },
    {
      title: "Contract value",
      kpi: formatRuble(totals.totalRevenue),
      deltaLabel: "n/a",
      deltaDirection: "flat",
      reason: "Sum of contract values for the period.",
      action: "Prioritize campaigns with highest contract value.",
      impact: `Payments: ${formatRuble(totals.totalPayments)}.`,
    },
    {
      title: "Lead → Contract",
      kpi: formatPercentValue(totals.leadToContract),
      deltaLabel: "n/a",
      deltaDirection: "flat",
      reason: "Conversion from leads to contracts.",
      action: "Review lead quality and sales follow-up speed.",
      impact: `Leads: ${formatNumber(totals.totalLeads)}.`,
    },
    {
      title: "Avg CTR",
      kpi: formatPercentValue(totals.avgCTR),
      deltaLabel: "n/a",
      deltaDirection: "flat",
      reason: "CTR aggregated across active campaigns.",
      action: "Refresh creatives for low-CTR campaigns.",
      impact: `Clicks: ${formatNumber(totals.totalClicks)}.`,
    },
    {
      title: "Avg CPC",
      kpi: formatRuble(totals.avgCPC),
      deltaLabel: "n/a",
      deltaDirection: "flat",
      reason: "CPC based on spend and total clicks.",
      action: "Tighten targeting and pause costly adsets.",
      impact: `Impressions: ${formatNumber(totals.totalImpressions)}.`,
    },
  ]

  const coverage = useMemo(() => {
    if (!data?.rolling_7d?.length) return null
    const total = data.rolling_7d.length
    const withContracts = data.rolling_7d.filter((row) => row.contracts_7d > 0).length
    const withPayments = data.rolling_7d.filter((row) => row.payments_7d > 0).length
    return {
      total,
      withContracts,
      withPayments,
      contractsPct: (withContracts / total) * 100,
      paymentsPct: (withPayments / total) * 100,
    }
  }, [data?.rolling_7d])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="🎯 Анализ кампаний"
          description="Эффективность рекламных кампаний и оптимизация"
          actions={<div className="animate-pulse bg-muted rounded h-8 w-32" />}
        />
        <AnalyticsSkeleton variant="grid" count={4} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg font-medium">Error loading data</div>
        <div className="text-slate-500 mt-2">{error}</div>
        <Button onClick={fetchData} className="mt-4">Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="🎯 Анализ кампаний"
        description="Эффективность рекламных кампаний и оптимизация"
      />

      <ExecutiveSummary
        title="Executive Summary"
        subtitle="Key signals and recommended actions"
        items={summaryItems}
      />

      {coverage && (
        <Card>
          <CardHeader>
            <CardTitle>Data coverage</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total campaigns</div>
              <div className="text-lg font-semibold">{coverage.total}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">With contracts</div>
              <div className="text-lg font-semibold">{formatPercentValue(coverage.contractsPct)}</div>
              <div className="text-xs text-muted-foreground">{coverage.withContracts} campaigns</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">With payments</div>
              <div className="text-lg font-semibold">{formatPercentValue(coverage.paymentsPct)}</div>
              <div className="text-xs text-muted-foreground">{coverage.withPayments} campaigns</div>
            </div>
          </CardContent>
        </Card>
      )}

      {dateError && <div className="text-xs text-red-600">{dateError}</div>}

      <AnalyticsFilters
        value={draftFilters}
        onDateChange={(value) => setDraftFilters((prev) => ({ ...prev, dateRange: value }))}
        onCityChange={(value) => setDraftFilters((prev) => ({ ...prev, cityId: value }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={loading}
        showCity
        compact
        extraControls={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[200px]"
              />
            </div>

            <Select value={viewType} onValueChange={setViewType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="performance">📈 Performance</SelectItem>
                <SelectItem value="timeline">📅 Timeline</SelectItem>
                <SelectItem value="contracts">💳 Payments & Contracts</SelectItem>
                <SelectItem value="conversion">🔁 Lead → Contract</SelectItem>
                <SelectItem value="scatter">📊 Scatter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Активных кампаний</CardTitle>
            <Target className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalCampaigns}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Общие затраты (за период)</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRuble(totals.totalCost)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Лиды</CardTitle>
            <Activity className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.totalLeads)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Договоры</CardTitle>
            <Eye className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.totalContracts)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сума договорів</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRuble(totals.totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Оплати</CardTitle>
            <Activity className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRuble(totals.totalPayments)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border p-3 text-sm flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">Lead → Contract conversion</span>
        <span className="font-semibold">{formatPercentValue(totals.leadToContract)}</span>
      </div>

      {/* Charts */}
      {viewType === "performance" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Топ кампании по затратам (7 дней)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SafeResponsiveContainer width="100%" height={400}>
                <BarChart data={topCampaigns} layout="horizontal">
                  <CartesianGrid {...chartGridProps} />
                  <XAxis type="number" {...chartAxisProps} />
                  <YAxis
                    dataKey="campaign_key"
                    type="category"
                    width={120}
                    {...chartAxisProps}
                    tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
                    tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + "..." : value}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'cost_7d' ? formatRuble(Number(value)) : formatNumber(Number(value)),
                      name === 'cost_7d' ? 'Затраты' : name
                    ]}
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend />
                  <Bar dataKey="cost_7d" fill={CHART_COLORS.primary} name="Затраты (за период)" />
                </BarChart>
              </SafeResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                CTR vs CPC Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SafeResponsiveContainer width="100%" height={400}>
                <BarChart data={topCampaigns.slice(0, 10)}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis
                    dataKey="campaign_key"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    {...chartAxisProps}
                    tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
                    tickFormatter={(value) => value.length > 10 ? value.substring(0, 10) + "..." : value}
                  />
                  <YAxis yAxisId="left" {...chartAxisProps} />
                  <YAxis yAxisId="right" orientation="right" {...chartAxisProps} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'avg_ctr_7d' ? formatPercentValue(Number(value)) :
                      name === 'avg_cpc_7d' ? formatRuble(Number(value)) :
                      formatNumber(Number(value)),
                      name === 'avg_ctr_7d' ? 'CTR' :
                      name === 'avg_cpc_7d' ? 'CPC' : name
                    ]}
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="avg_ctr_7d" fill={CHART_COLORS.secondary} name="CTR %" />
                  <Bar yAxisId="right" dataKey="avg_cpc_7d" fill={CHART_COLORS.quaternary} name="CPC" />
                </BarChart>
              </SafeResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {viewType === "timeline" && timelineData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Динамика затрат и кликов (30 дней)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SafeResponsiveContainer width="100%" height={400}>
              <LineChart data={timelineData}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="date" {...chartAxisProps} />
                <YAxis yAxisId="left" {...chartAxisProps} />
                <YAxis yAxisId="right" orientation="right" {...chartAxisProps} />
                <Tooltip
                    formatter={(value, name) => {
                      const label = String(name)
                      return [
                        label.includes('Cost') ? formatRuble(Number(value)) : formatNumber(Number(value)),
                        label === 'totalCost' ? 'Затраты' :
                        label === 'totalClicks' ? 'Клики' :
                        label === 'totalImpressions' ? 'Показы' : label
                      ]
                    }}
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="totalCost" stroke={CHART_COLORS.primary} name="Затраты" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="totalClicks" stroke={CHART_COLORS.secondary} name="Клики" strokeWidth={2} />
              </LineChart>
            </SafeResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {viewType === "contracts" && timelineData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Оплаты и договоры (30 дней)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SafeResponsiveContainer width="100%" height={360}>
              <LineChart data={timelineData}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="date" {...chartAxisProps} />
                <YAxis yAxisId="left" {...chartAxisProps} />
                <YAxis yAxisId="right" orientation="right" {...chartAxisProps} />
                <Tooltip
                  formatter={(value, name) => {
                    const label = String(name)
                    return [
                      label === "totalPayments" || label === "totalRevenue"
                        ? formatRuble(Number(value))
                        : formatNumber(Number(value)),
                      label === "totalContracts" ? "Договоры" :
                      label === "totalPayments" ? "Оплаты" :
                      label === "totalRevenue" ? "Сумма договоров" : label,
                    ]
                  }}
                  contentStyle={chartTooltipStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalContracts"
                  stroke={CHART_COLORS.secondary}
                  name="Договоры"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalPayments"
                  stroke={CHART_COLORS.primary}
                  name="Оплаты"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalRevenue"
                  stroke={CHART_COLORS.quaternary}
                  name="Сумма договоров"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </SafeResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {viewType === "conversion" && timelineData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Lead → Contract (30 дней)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SafeResponsiveContainer width="100%" height={360}>
              <LineChart data={timelineData}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="date" {...chartAxisProps} />
                <YAxis yAxisId="left" {...chartAxisProps} />
                <YAxis yAxisId="right" orientation="right" {...chartAxisProps} />
                <Tooltip
                  formatter={(value, name) => {
                    const label = String(name)
                    return [
                      label === "conversionRate"
                        ? formatPercentValue(Number(value))
                        : formatNumber(Number(value)),
                      label === "totalLeads"
                        ? "Лиды"
                        : label === "totalContracts"
                        ? "Договоры"
                        : "Конверсия",
                    ]
                  }}
                  contentStyle={chartTooltipStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalLeads"
                  stroke={CHART_COLORS.primary}
                  name="Лиды"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalContracts"
                  stroke={CHART_COLORS.secondary}
                  name="Договоры"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversionRate"
                  stroke={CHART_COLORS.quaternary}
                  name="Конверсия"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </SafeResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {viewType === "scatter" && efficiencyScatter.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Эффективность кампаний: CTR vs CPC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SafeResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="x" name="CTR %" {...chartAxisProps} />
                <YAxis dataKey="y" name="CPC" {...chartAxisProps} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value, name) => [
                    name === 'x' ? formatPercentValue(Number(value)) :
                    name === 'y' ? formatRuble(Number(value)) :
                    value,
                    name === 'x' ? 'CTR' :
                    name === 'y' ? 'CPC' : name
                  ]}
                  labelFormatter={(label) => `Campaign: ${label}`}
                  contentStyle={chartTooltipStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Scatter name="Кампании" data={efficiencyScatter} fill={CHART_COLORS.primary} />
              </ScatterChart>
            </SafeResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Campaign Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Детали кампаний (последняя активность)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-2">Кампания</th>
                  <th className="pb-2">Платформа</th>
                  <th className="pb-2">Первый показ</th>
                  <th className="pb-2">Последняя активность</th>
                  <th className="pb-2">Статус</th>
                </tr>
              </thead>
              <tbody>
                {data?.latest_activity?.slice(0, 20).map((campaign, index) => {
                  const daysSinceActive = Math.floor(
                    (new Date().getTime() - new Date(campaign.last_active_date).getTime()) / (1000 * 3600 * 24)
                  )

                  return (
                    <tr key={index} className="border-b border-slate-100">
                      <td className="py-2 font-medium max-w-xs truncate" title={campaign.campaign_key}>
                        {campaign.campaign_key.length > 40
                          ? campaign.campaign_key.substring(0, 40) + "..."
                          : campaign.campaign_key}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline">{campaign.platform}</Badge>
                      </td>
                      <td className="py-2 text-slate-600">
                        {new Date(campaign.first_seen).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="py-2 text-slate-600">
                        {new Date(campaign.last_active_date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="py-2">
                        <Badge
                          variant={daysSinceActive <= 1 ? "default" : daysSinceActive <= 7 ? "secondary" : "outline"}
                          className={
                            daysSinceActive <= 1 ? "bg-green-100 text-green-800" :
                            daysSinceActive <= 7 ? "bg-yellow-100 text-yellow-800" :
                            "bg-slate-100 text-slate-600"
                          }
                        >
                          {daysSinceActive <= 1 ? "Активна" :
                           daysSinceActive <= 7 ? "Недавно" :
                           "Неактивна"}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
