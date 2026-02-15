"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Target, DollarSign, Users, BarChart3, PieChart as PieChartIcon, Activity } from "lucide-react"
import { AnalyticsAPI } from "@/lib/api/analytics"
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter"
import { useAnalyticsDateRange } from "@/hooks/useAnalyticsDateRange"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"

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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(value)
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('ru-RU').format(value)
}

export default function ChannelsPage() {
  const [data, setData] = useState<ChannelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all")
  const [viewType, setViewType] = useState<string>("timeline")

  // Date range management
  const { dateRange, apiDateRange, updateDateRange } = useAnalyticsDateRange(30)

  useEffect(() => {
    fetchData()
  }, [selectedPlatform, apiDateRange])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const platform = selectedPlatform !== "all" ? selectedPlatform : undefined
      const result = await AnalyticsAPI.getChannelsSources(apiDateRange, platform)
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

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="📈 Анализ каналов"
          description="Распределение трафика и эффективность по источникам"
          actions={<div className="animate-pulse bg-muted rounded h-8 w-32" />}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-200 rounded-lg h-32"></div>
          ))}
        </div>
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
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <DateRangeFilter
              value={dateRange}
              onChange={updateDateRange}
            />

            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Платформа" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📊 Все каналы</SelectItem>
                {platforms.map(platform => (
                  <SelectItem key={platform} value={platform}>
                    {platform === 'facebook' && '📘'}
                    {platform === 'google_ads' && '🔍'}
                    {platform === 'other' && '🔗'}
                    {platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={viewType} onValueChange={setViewType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Вид" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timeline">📈 Timeline</SelectItem>
                <SelectItem value="distribution">🥧 Распределение</SelectItem>
                <SelectItem value="table">📊 Таблица</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            <div className="text-2xl font-bold">{formatCurrency(totals.totalCost)}</div>
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
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timelineData}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="date" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} />
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
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={300}>
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
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} />
                </PieChart>
              </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={400}>
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
            </ResponsiveContainer>
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
                        <td className="py-2">{formatCurrency(source.revenue)}</td>
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
                        <td className="py-2">{formatCurrency(platform.cost)}</td>
                        <td className="py-2">{formatCurrency(platform.cpl)}</td>
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
