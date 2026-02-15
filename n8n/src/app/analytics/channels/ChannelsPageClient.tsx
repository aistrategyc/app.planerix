"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { TrendingUp, Target, DollarSign, Users, BarChart3, PieChart as PieChartIcon, Activity } from "lucide-react"
import { AnalyticsAPI } from "@/lib/api/analytics"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"
import { fetchWidgetRange } from "@/lib/api/analytics-widgets"
import { buildLastWeekRange } from "@/app/analytics/utils/defaults"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"
import { ExecutiveSummary, type ExecutiveSummaryItem } from "@/components/analytics/ExecutiveSummary"
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton"
import { formatCurrency, formatNumber, formatPercent } from "@/app/analytics/utils/formatters"

interface ChannelData {
  platform_costs: Array<{
    date: string
    platform: string
    cost: number
  }>
  other_sources: Array<{
    date: string
    source: string
    leads: number
    contracts: number
    revenue: number
  }>
  weekly_data: Array<{
    platform: string
    source: string
    cost: number
    leads: number
    contracts: number
    revenue: number
    roas: number
    cpl: number
  }>
}

const PLATFORM_COLORS = {
  facebook: '#1877F2',
  google_ads: '#4285F4',
  other: CHART_COLORS.secondary,
  linkedin: '#0077B5',
  twitter: '#1DA1F2',
  instagram: '#E4405F'
}

const formatRuble = (value: number) =>
  formatCurrency(value, { currencyCode: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
const formatPercentValue = (value: number) => formatPercent(value, { digits: 1, assumeRatio: false })

const buildDateKey = (value: Date) => value.toISOString().slice(0, 10)

const parseDateParam = (value: string | null) => {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed
}

export default function ChannelsPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const [data, setData] = useState<ChannelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewType, setViewType] = useState<string>("timeline")
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersValue>({ dateRange: {}, cityId: "all" })
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFiltersValue>({ dateRange: {}, cityId: "all" })
  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)

  useEffect(() => {
    const nextFilters: AnalyticsFiltersValue = {
      dateRange: {
        from: parseDateParam(searchParams.get("date_from")),
        to: parseDateParam(searchParams.get("date_to")),
      },
      cityId: "all",
    }
    setDraftFilters(nextFilters)
    setAppliedFilters(nextFilters)
  }, [searchKey, searchParams])

  useEffect(() => {
    if (defaultsApplied) return
    if (searchParams.get("date_from") || searchParams.get("date_to")) {
      setDefaultsApplied(true)
      return
    }
    let active = true
    const hydrateDefaults = async () => {
      try {
        const range = await fetchWidgetRange("ads.channel_mix_daily")
        if (!active) return
        const dateRange = buildLastWeekRange(range?.max_date ?? null)
        if (!dateRange) {
          setDefaultsApplied(true)
          return
        }
        const nextFilters: AnalyticsFiltersValue = { dateRange, cityId: "all" }
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
  }, [defaultsApplied, searchParams])

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
    })
  }

  const resetFilters = () => {
    const resetValue: AnalyticsFiltersValue = { dateRange: {}, cityId: "all" }
    setDraftFilters(resetValue)
    setAppliedFilters(resetValue)
    setDateError(null)
    updateQuery({
      date_from: null,
      date_to: null,
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
  }, [apiDateRange])

  const fetchData = async () => {
    if (!apiDateRange) return
    try {
      setLoading(true)
      setError(null)
      const result = await AnalyticsAPI.getChannelsSources(apiDateRange)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
      console.error("Fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  // Подготовка данных для графиков
  const prepareTimelineData = () => {
    if (!data?.platform_costs) return []

    const groupedByDate = data.platform_costs.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { date: item.date }
      }
      acc[item.date][item.platform] = item.cost
      return acc
    }, {} as Record<string, any>)

    return Object.values(groupedByDate).sort((a, b) => a.date.localeCompare(b.date))
  }

  // Данные для пирога распределения по платформам
  const preparePieData = () => {
    if (!data?.weekly_data) return []

    const platformTotals = data.weekly_data.reduce((acc, item) => {
      if (!acc[item.platform]) {
        acc[item.platform] = 0
      }
      acc[item.platform] += item.cost
      return acc
    }, {} as Record<string, number>)

    return Object.entries(platformTotals).map(([platform, cost]) => ({
      name: platform,
      value: cost,
      color: PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] || '#8884d8'
    }))
  }

  // Данные других источников для таблицы
  const prepareOtherSourcesTable = () => {
    if (!data?.other_sources) return []

    return data.other_sources
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }

  // Топ источники по эффективности
  const prepareTopSources = () => {
    if (!data?.weekly_data) return []

    return data.weekly_data
      .filter(item => item.roas > 0)
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 10)
  }

  // Вычисление суммарных метрик
  const calculateTotals = () => {
    if (!data?.weekly_data) return { totalCost: 0, totalLeads: 0, totalContracts: 0, totalRevenue: 0, avgROAS: 0 }

    const totals = data.weekly_data.reduce((acc, item) => {
      acc.totalCost += item.cost
      acc.totalLeads += item.leads
      acc.totalContracts += item.contracts
      acc.totalRevenue += item.revenue
      return acc
    }, { totalCost: 0, totalLeads: 0, totalContracts: 0, totalRevenue: 0 })

    const avgROAS = totals.totalCost > 0 ? totals.totalRevenue / totals.totalCost : 0

    return { ...totals, avgROAS }
  }

  const platforms = data?.weekly_data
    ? Array.from(new Set(data.weekly_data.map(item => item.platform)))
    : []

  const totals = calculateTotals()
  const timelineData = prepareTimelineData()
  const pieData = preparePieData()
  const otherSources = prepareOtherSourcesTable()
  const topSources = prepareTopSources()
  const spendDelta = useMemo(() => {
    if (!data?.platform_costs?.length) return null
    const byDate = new Map<string, number>()
    data.platform_costs.forEach((row) => {
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.cost)
    })
    const dates = Array.from(byDate.keys()).sort()
    if (dates.length < 14) return null
    const last7 = dates.slice(-7).reduce((sum, date) => sum + (byDate.get(date) ?? 0), 0)
    const prev7 = dates.slice(-14, -7).reduce((sum, date) => sum + (byDate.get(date) ?? 0), 0)
    if (!prev7) return { last7, prev7, deltaPct: null }
    return { last7, prev7, deltaPct: (last7 - prev7) / prev7 }
  }, [data?.platform_costs])
  const topSource = topSources[0]
  const summaryItems: ExecutiveSummaryItem[] = [
    {
      title: "Spend (7d)",
      kpi: formatRuble(spendDelta?.last7 ?? totals.totalCost),
      deltaLabel: spendDelta?.deltaPct == null ? "n/a" : formatPercentValue(spendDelta.deltaPct * 100),
      deltaDirection: spendDelta?.deltaPct == null ? "flat" : spendDelta.deltaPct >= 0 ? "up" : "down",
      reason: spendDelta?.deltaPct == null ? "Insufficient prior period for comparison." : "Spend moved vs previous 7d.",
      action: "Review channel mix and reallocate to highest-ROAS sources.",
      impact: spendDelta?.deltaPct == null
        ? "Track ROAS concentration by source."
        : `${formatRuble(Math.abs((spendDelta.last7 ?? 0) - (spendDelta.prev7 ?? 0)))} delta vs prev 7d.`,
    },
    {
      title: "Leads",
      kpi: formatNumber(totals.totalLeads),
      deltaLabel: "n/a",
      deltaDirection: "flat",
      reason: topSource ? `Top source: ${topSource.source} (ROAS ${topSource.roas.toFixed(2)}x).` : "No ranked sources yet.",
      action: "Scale top sources or improve conversion on low-ROAS sources.",
      impact: `Contracts: ${formatNumber(totals.totalContracts)}.`,
    },
    {
      title: "ROAS",
      kpi: `${totals.avgROAS.toFixed(2)}x`,
      deltaLabel: "n/a",
      deltaDirection: "flat",
      reason: "ROAS based on aggregated revenue vs spend.",
      action: "Investigate channels below ROAS target and optimize creatives.",
      impact: formatRuble(totals.totalRevenue),
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="📈 Анализ каналов"
          description="Распределение трафика и эффективность по источникам"
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
        title="📈 Анализ каналов"
        description="Распределение трафика и эффективность по источникам"
      />

      {dateError && <div className="text-xs text-red-600">{dateError}</div>}

      <ExecutiveSummary
        title="Executive Summary"
        subtitle="Key signals and recommended actions"
        items={summaryItems}
      />

      <AnalyticsFilters
        value={draftFilters}
        onDateChange={(value) => setDraftFilters((prev) => ({ ...prev, dateRange: value }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={loading}
        showCity={false}
        compact
        extraControls={
          <Select value={viewType} onValueChange={setViewType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timeline">📈 Timeline</SelectItem>
              <SelectItem value="distribution">🥧 Distribution</SelectItem>
              <SelectItem value="table">📊 Table</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Общие затраты</CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRuble(totals.totalCost)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего лидов</CardTitle>
            <Users className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.totalLeads)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Контракты</CardTitle>
            <Target className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.totalContracts)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Средний ROAS</CardTitle>
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.avgROAS.toFixed(2)}x</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      {viewType === "timeline" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Затраты по дням и платформам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SafeResponsiveContainer width="100%" height={300}>
                <BarChart data={timelineData}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="date" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} />
                  <Tooltip formatter={(value) => formatRuble(Number(value))} contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} />
                  <Legend />
                  {platforms.map(platform => (
                    <Bar
                      key={platform}
                      dataKey={platform}
                      fill={PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] || '#8884d8'}
                      name={platform}
                    />
                  ))}
                </BarChart>
              </SafeResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                Распределение затрат по каналам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SafeResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${String(name)} ${(((percent ?? 0) * 100)).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatRuble(Number(value))} contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} />
                </PieChart>
              </SafeResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {viewType === "distribution" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Топ источников по эффективности
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SafeResponsiveContainer width="100%" height={400}>
              <BarChart data={topSources} layout="horizontal">
                <CartesianGrid {...chartGridProps} />
                <XAxis type="number" {...chartAxisProps} />
                <YAxis dataKey="source" type="category" width={120} {...chartAxisProps} />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'roas' ? `${Number(value).toFixed(2)}x` : formatNumber(Number(value)),
                    name === 'roas' ? 'ROAS' : name
                  ]}
                  contentStyle={chartTooltipStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Legend />
                <Bar dataKey="roas" fill={CHART_COLORS.primary} name="ROAS" />
              </BarChart>
            </SafeResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {otherSources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>🔗 Другие источники трафика</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2">Источник</th>
                      <th className="pb-2">Лиды</th>
                      <th className="pb-2">Контракты</th>
                      <th className="pb-2">Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherSources.map((source, index) => (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="py-2 font-medium">{source.source}</td>
                        <td className="py-2">{formatNumber(source.leads)}</td>
                        <td className="py-2">{formatNumber(source.contracts)}</td>
                        <td className="py-2">{formatRuble(source.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>📊 Сводка по платформам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-2">Платформа</th>
                    <th className="pb-2">Затраты</th>
                    <th className="pb-2">CPL</th>
                    <th className="pb-2">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.weekly_data
                    ?.reduce((acc, item) => {
                      const existing = acc.find(x => x.platform === item.platform)
                      if (existing) {
                        existing.cost += item.cost
                        existing.cpl = (existing.cpl + item.cpl) / 2
                        existing.roas = (existing.roas + item.roas) / 2
                      } else {
                        acc.push({ ...item })
                      }
                      return acc
                    }, [] as any[])
                    ?.map((platform, index) => (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="py-2 font-medium">
                          <Badge variant="outline">{platform.platform}</Badge>
                        </td>
                        <td className="py-2">{formatRuble(platform.cost)}</td>
                        <td className="py-2">{formatRuble(platform.cpl)}</td>
                        <td className="py-2">
                          <span className={platform.roas > 1 ? "text-green-600" : "text-red-600"}>
                            {platform.roas.toFixed(2)}x
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
