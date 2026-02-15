/**
 * Contracts Source Analytics Component
 * Detailed breakdown of contracts by source (organic, events, Meta platforms)
 * Helps understand which channels drive most valuable customers
 * Created: October 23, 2025
 */

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import {
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  Globe,
  Facebook,
  Instagram as InstagramIcon,
  MessageCircle,
} from "lucide-react"
import { chartTooltipStyle, chartTooltipItemStyle } from "@/components/analytics/chart-theme"

interface ContractsBySource {
  source: string
  platform: string
  contracts: number
  revenue: number
  avg_contract_value: number
  leads: number
  conversion_rate: number
  attribution_level: string
  // Additional details
  utm_campaigns?: string[]
  top_campaigns?: Array<{ name: string; contracts: number }>
}

interface ContractsSourceAnalyticsProps {
  data: ContractsBySource[]
  title?: string
  loading?: boolean
}

const SOURCE_COLORS: Record<string, string> = {
  organic: "#34a853",      // Green
  event: "#fbbc04",        // Yellow
  facebook: "#1877f2",     // Facebook Blue
  instagram: "#e4405f",    // Instagram Pink
  google: "#4285f4",       // Google Blue
  telegram: "#0088cc",     // Telegram Blue
  email: "#ea4335",        // Red
  viber: "#7360f2",        // Purple
  other: "#9ca3af",        // Gray
}

const SOURCE_ICONS: Record<string, any> = {
  organic: Globe,
  event: Calendar,
  facebook: Facebook,
  instagram: InstagramIcon,
  telegram: MessageCircle,
}

const formatCurrency = (value: number) => `₴${(value / 1000).toFixed(1)}K`
const formatNumber = (value: number) => value.toFixed(0)
const formatPercent = (value: number) => `${value.toFixed(1)}%`

const getSourceLabel = (source: string): string => {
  const labels: Record<string, string> = {
    organic: "🌱 Органический трафик",
    event: "🎪 Мероприятия",
    facebook: "📘 Facebook Ads",
    instagram: "📸 Instagram Ads",
    google: "🔍 Google Ads",
    telegram: "✈️ Telegram",
    email: "📧 Email Marketing",
    viber: "📱 Viber",
    other: "📊 Другие источники",
  }
  return labels[source.toLowerCase()] || source
}

const getSourceDescription = (source: string, data: ContractsBySource): string => {
  switch (source.toLowerCase()) {
    case "organic":
      return `Клиенты пришли самостоятельно через поиск, рекомендации, прямой переход. Конверсия: ${data.conversion_rate.toFixed(1)}%`
    case "event":
      return `Клиенты с мероприятий, выставок, конференций. Высокое качество лидов, средний чек: ${formatCurrency(data.avg_contract_value)}`
    case "facebook":
    case "instagram":
      return `Платный трафик из ${source}. ROAS можно отследить через spend данные. Контракты: ${data.contracts}`
    case "google":
      return `Платный поиск Google Ads. Контракты: ${data.contracts}, конверсия: ${data.conversion_rate.toFixed(1)}%`
    default:
      return `Источник: ${source}, Контракты: ${data.contracts}, Revenue: ${formatCurrency(data.revenue)}`
  }
}

export function ContractsSourceAnalytics({
  data,
  title = "Contracts by Source - Detailed Analytics",
  loading = false,
}: ContractsSourceAnalyticsProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 animate-pulse bg-slate-100 rounded"></div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-slate-500">
            No contracts data available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Aggregate by source (with null safety)
  const sourceData = data.reduce((acc, item) => {
    // Skip if source is missing
    if (!item.source) {
      return acc
    }

    const source = item.source.toLowerCase()
    if (!acc[source]) {
      acc[source] = {
        source,
        contracts: 0,
        revenue: 0,
        leads: 0,
        campaigns: new Set(),
      }
    }
    acc[source].contracts += item.contracts
    acc[source].revenue += item.revenue
    acc[source].leads += item.leads
    if (item.utm_campaigns) {
      item.utm_campaigns.forEach((c) => acc[source].campaigns.add(c))
    }
    return acc
  }, {} as Record<string, any>)

  const aggregatedData = Object.entries(sourceData).map(([source, data]) => ({
    source,
    ...data,
    campaigns: Array.from(data.campaigns),
    conversion_rate: data.leads > 0 ? (data.contracts / data.leads) * 100 : 0,
    avg_contract_value: data.contracts > 0 ? data.revenue / data.contracts : 0,
  }))

  // Sort by revenue
  const sortedData = aggregatedData.sort((a, b) => b.revenue - a.revenue)

  // Prepare pie chart data
  const pieData = sortedData.map((item) => ({
    name: getSourceLabel(item.source),
    value: item.contracts,
    revenue: item.revenue,
    source: item.source,
  }))

  // Total stats
  const totalContracts = sortedData.reduce((sum, item) => sum + item.contracts, 0)
  const totalRevenue = sortedData.reduce((sum, item) => sum + item.revenue, 0)
  const totalLeads = sortedData.reduce((sum, item) => sum + item.leads, 0)
  const avgConversion = totalLeads > 0 ? (totalContracts / totalLeads) * 100 : 0

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    const percentage = ((data.value / totalContracts) * 100).toFixed(1)

    return (
      <div className="rounded-lg p-3" style={chartTooltipStyle}>
        <p className="font-semibold text-sm mb-2">{data.name}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-slate-600" style={chartTooltipItemStyle}>Contracts:</span>
            <span className="font-bold" style={chartTooltipItemStyle}>{data.value}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-600" style={chartTooltipItemStyle}>Share:</span>
            <span className="font-bold" style={chartTooltipItemStyle}>{percentage}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-600" style={chartTooltipItemStyle}>Revenue:</span>
            <span className="font-bold" style={chartTooltipItemStyle}>{formatCurrency(data.revenue)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
        </CardTitle>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">Total Contracts</div>
            <div className="text-2xl font-bold text-blue-600">{totalContracts}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">Total Leads</div>
            <div className="text-2xl font-bold text-green-600">{totalLeads}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">Avg Conversion</div>
            <div className="text-2xl font-bold text-orange-600">{formatPercent(avgConversion)}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Pie Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Contract Distribution by Source</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.name}: ${entry.value}`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={SOURCE_COLORS[entry.source] || SOURCE_COLORS.other}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Source Cards */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Detailed Source Breakdown</h3>
          <div className="space-y-3">
            {sortedData.map((item) => {
              const Icon = SOURCE_ICONS[item.source] || Users
              const color = SOURCE_COLORS[item.source] || SOURCE_COLORS.other
              const percentage = ((item.contracts / totalContracts) * 100).toFixed(1)

              return (
                <Card
                  key={item.source}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedSource(selectedSource === item.source ? null : item.source)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color }} />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{getSourceLabel(item.source)}</h4>
                            <Badge variant="secondary">{percentage}% of total</Badge>
                          </div>

                          <p className="text-xs text-slate-600 mb-3">
                            {getSourceDescription(item.source, item)}
                          </p>

                          <div className="grid grid-cols-5 gap-3 text-xs">
                            <div>
                              <div className="text-slate-500">Contracts</div>
                              <div className="font-bold text-lg">{item.contracts}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Revenue</div>
                              <div className="font-bold text-lg">{formatCurrency(item.revenue)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Leads</div>
                              <div className="font-bold text-lg">{item.leads}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Conv. Rate</div>
                              <div className="font-bold text-lg">{formatPercent(item.conversion_rate)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Avg Value</div>
                              <div className="font-bold text-lg">{formatCurrency(item.avg_contract_value)}</div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {selectedSource === item.source && item.campaigns.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h5 className="text-xs font-semibold mb-2">Associated Campaigns:</h5>
                              <div className="flex flex-wrap gap-2">
                                {item.campaigns.slice(0, 5).map((campaign: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {campaign}
                                  </Badge>
                                ))}
                                {item.campaigns.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{item.campaigns.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                          style={{
                            backgroundColor: `${color}20`,
                            color,
                          }}
                        >
                          {item.contracts}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Insights Section */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-3">📊 Key Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {sortedData.length > 0 && (
              <>
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <div className="font-semibold text-green-700 mb-1">🏆 Top Source</div>
                  <div className="text-slate-700">
                    {getSourceLabel(sortedData[0].source)} generates{" "}
                    <span className="font-bold">{sortedData[0].contracts} contracts</span> (
                    {((sortedData[0].contracts / totalContracts) * 100).toFixed(1)}% of total)
                  </div>
                </div>

                {sortedData.find((s) => s.source === "organic") && (
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <div className="font-semibold text-blue-700 mb-1">🌱 Organic Quality</div>
                    <div className="text-slate-700">
                      Organic traffic:{" "}
                      <span className="font-bold">
                        {sortedData.find((s) => s.source === "organic")?.contracts || 0} contracts
                      </span>
                      , conversion rate:{" "}
                      <span className="font-bold">
                        {formatPercent(sortedData.find((s) => s.source === "organic")?.conversion_rate || 0)}
                      </span>
                    </div>
                  </div>
                )}

                {sortedData.find((s) => s.source === "event") && (
                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <div className="font-semibold text-yellow-700 mb-1">🎪 Event Performance</div>
                    <div className="text-slate-700">
                      Events bring{" "}
                      <span className="font-bold">
                        {sortedData.find((s) => s.source === "event")?.contracts || 0} high-value clients
                      </span>
                      , avg contract:{" "}
                      <span className="font-bold">
                        {formatCurrency(sortedData.find((s) => s.source === "event")?.avg_contract_value || 0)}
                      </span>
                    </div>
                  </div>
                )}

                {(sortedData.find((s) => s.source === "facebook") || sortedData.find((s) => s.source === "instagram")) && (
                  <div className="bg-purple-50 p-3 rounded border border-purple-200">
                    <div className="font-semibold text-purple-700 mb-1">📱 Meta Platforms (FB + IG)</div>
                    <div className="text-slate-700">
                      Combined Meta:{" "}
                      <span className="font-bold">
                        {(sortedData.find((s) => s.source === "facebook")?.contracts || 0) +
                          (sortedData.find((s) => s.source === "instagram")?.contracts || 0)}{" "}
                        contracts
                      </span>
                      , revenue:{" "}
                      <span className="font-bold">
                        {formatCurrency(
                          (sortedData.find((s) => s.source === "facebook")?.revenue || 0) +
                            (sortedData.find((s) => s.source === "instagram")?.revenue || 0)
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
