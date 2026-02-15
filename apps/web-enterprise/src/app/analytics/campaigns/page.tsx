"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'
import { Target, TrendingUp, Activity, Eye, Search, Calendar, BarChart3 } from "lucide-react"
import { AnalyticsAPI } from "@/lib/api/analytics"
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter"
import { useAnalyticsDateRange } from "@/hooks/useAnalyticsDateRange"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"

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
    avg_ctr_7d: number
    avg_cpc_7d: number
    avg_cpm_7d: number
  }>
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2
  }).format(value)
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('ru-RU').format(value)
}

const formatPercent = (value: number) => {
  return `${(value || 0).toFixed(2)}%`
}

export default function CampaignsPage() {
  const [data, setData] = useState<CampaignData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [viewType, setViewType] = useState<string>("performance")

  // Date range management
  const { dateRange, apiDateRange, updateDateRange } = useAnalyticsDateRange(30)

  useEffect(() => {
    fetchData()
  }, [selectedPlatform, searchTerm, apiDateRange])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const platform = selectedPlatform !== "all" ? selectedPlatform : undefined
      const campaignKey = searchTerm || undefined
      const result = await AnalyticsAPI.getMarketingCampaigns(apiDateRange, platform, campaignKey)
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
          totalImpressions: 0
        }
      }
      acc[item.date].totalCost += item.cost
      acc[item.date].totalClicks += item.clicks
      acc[item.date].totalImpressions += item.impressions
      return acc
    }, {} as Record<string, any>)

    return Object.values(groupedByDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // Показать последние 30 дней
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
      avgCTR: 0,
      avgCPC: 0
    }

    const totals = data.rolling_7d.reduce((acc, item) => {
      acc.totalCost += item.cost_7d
      acc.totalClicks += item.clicks_7d
      acc.totalImpressions += item.impressions_7d
      return acc
    }, { totalCost: 0, totalClicks: 0, totalImpressions: 0 })

    const avgCTR = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0
    const avgCPC = totals.totalClicks > 0 ? totals.totalCost / totals.totalClicks : 0

    return {
      totalCampaigns: data.rolling_7d.length,
      ...totals,
      avgCTR,
      avgCPC
    }
  }

  const platforms = data?.campaigns
    ? Array.from(new Set(data.campaigns.map(item => item.platform)))
    : []

  const totals = calculateTotals()
  const timelineData = prepareTimelineData()
  const efficiencyScatter = prepareEfficiencyScatter()
  const topCampaigns = prepareTopCampaigns()

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="🎯 Анализ кампаний"
          description="Эффективность рекламных кампаний и оптимизация"
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
        title="🎯 Анализ кампаний"
        description="Эффективность рекламных кампаний и оптимизация"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <DateRangeFilter
              value={dateRange}
              onChange={updateDateRange}
            />

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Поиск кампаний..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[200px]"
              />
            </div>

            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Платформа" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📊 Все</SelectItem>
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
                <SelectItem value="performance">📈 Эффективность</SelectItem>
                <SelectItem value="timeline">📅 Timeline</SelectItem>
                <SelectItem value="scatter">📊 Scatter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Общие затраты (7д)</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalCost)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Средний CTR</CardTitle>
            <Activity className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(totals.avgCTR)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Средний CPC</CardTitle>
            <Eye className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.avgCPC)}</div>
          </CardContent>
        </Card>
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
              <ResponsiveContainer width="100%" height={400}>
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
                      name === 'cost_7d' ? formatCurrency(Number(value)) : formatNumber(Number(value)),
                      name === 'cost_7d' ? 'Затраты' : name
                    ]}
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend />
                  <Bar dataKey="cost_7d" fill={CHART_COLORS.primary} name="Затраты (7д)" />
                </BarChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={400}>
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
                      name === 'avg_ctr_7d' ? formatPercent(Number(value)) :
                      name === 'avg_cpc_7d' ? formatCurrency(Number(value)) :
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
              </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={timelineData}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="date" {...chartAxisProps} />
                <YAxis yAxisId="left" {...chartAxisProps} />
                <YAxis yAxisId="right" orientation="right" {...chartAxisProps} />
                <Tooltip
                    formatter={(value, name) => {
                      const label = String(name)
                      return [
                        label.includes('Cost') ? formatCurrency(Number(value)) : formatNumber(Number(value)),
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
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="x" name="CTR %" {...chartAxisProps} />
                <YAxis dataKey="y" name="CPC" {...chartAxisProps} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value, name) => [
                    name === 'x' ? `${Number(value).toFixed(2)}%` :
                    name === 'y' ? formatCurrency(Number(value)) :
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
            </ResponsiveContainer>
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
