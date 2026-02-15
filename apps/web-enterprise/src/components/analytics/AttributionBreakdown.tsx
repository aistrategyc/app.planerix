/**
 * Attribution Breakdown Component
 * Stacked bar chart showing attribution levels by platform/month
 * Shows quality of attribution data with color coding
 * Created: October 23, 2025
 */

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import { Award, AlertCircle } from "lucide-react"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipStyle, chartTooltipItemStyle } from "@/components/analytics/chart-theme"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"

interface AttributionData {
  period: string
  campaign_match?: number
  platform_detected?: number
  utm_attribution?: number
  crm_manual?: number
  unattributed?: number
}

interface AttributionBreakdownProps {
  data: AttributionData[]
  title?: string
  groupBy?: "month" | "platform"
  loading?: boolean
}

const ATTRIBUTION_COLORS = {
  campaign_match: CHART_COLORS.secondary,
  platform_detected: CHART_COLORS.primary,
  utm_attribution: CHART_COLORS.quaternary,
  crm_manual: CHART_COLORS.tertiary,
  unattributed: "hsl(var(--destructive))",
}

const ATTRIBUTION_LABELS = {
  campaign_match: "Campaign Match",
  platform_detected: "Platform Detected",
  utm_attribution: "UTM Attribution",
  crm_manual: "CRM Manual",
  unattributed: "Unattributed",
}

const QUALITY_DESCRIPTIONS = {
  campaign_match: "Full attribution with campaign match",
  platform_detected: "Platform identified from source",
  utm_attribution: "UTM parameters available",
  crm_manual: "Manually entered in CRM",
  unattributed: "No attribution data",
}

const formatPeriod = (period: string, groupBy: string) => {
  if (groupBy === "month") {
    try {
      const date = new Date(period)
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    } catch {
      return period
    }
  }
  return period.charAt(0).toUpperCase() + period.slice(1)
}

export function AttributionBreakdown({
  data,
  title = "Attribution Quality Breakdown",
  groupBy = "month",
  loading = false,
}: AttributionBreakdownProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
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
            <Award className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-slate-500">
            No attribution data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((item) => ({
    ...item,
    period_formatted: formatPeriod(item.period, groupBy),
  }))

  // Calculate totals for summary
  const totals = data.reduce(
    (acc, item) => ({
      campaign_match: acc.campaign_match + (item.campaign_match || 0),
      platform_detected: acc.platform_detected + (item.platform_detected || 0),
      utm_attribution: acc.utm_attribution + (item.utm_attribution || 0),
      crm_manual: acc.crm_manual + (item.crm_manual || 0),
      unattributed: acc.unattributed + (item.unattributed || 0),
    }),
    { campaign_match: 0, platform_detected: 0, utm_attribution: 0, crm_manual: 0, unattributed: 0 }
  )

  const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0)

    return (
      <div className="rounded-lg p-4 max-w-xs" style={chartTooltipStyle}>
        <p className="font-semibold text-sm mb-3">{payload[0].payload.period_formatted}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => {
            const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0"
            return (
              <div key={index}>
                <div className="flex items-center justify-between gap-4 mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-slate-700" style={chartTooltipItemStyle}>{entry.name}:</span>
                  </div>
                  <span className="text-xs font-semibold" style={chartTooltipItemStyle}>
                    {entry.value} ({percentage}%)
                  </span>
                </div>
                <p className="text-xs text-slate-500 ml-5" style={chartTooltipItemStyle}>
                  {QUALITY_DESCRIPTIONS[entry.dataKey as keyof typeof QUALITY_DESCRIPTIONS]}
                </p>
              </div>
            )
          })}
          <div className="pt-2 border-t mt-2">
            <div className="flex items-center justify-between text-xs font-semibold" style={chartTooltipItemStyle}>
              <span>Total:</span>
              <span>{total}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SafeResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="period_formatted"
              {...chartAxisProps}
            />
            <YAxis {...chartAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              formatter={(value) => ATTRIBUTION_LABELS[value as keyof typeof ATTRIBUTION_LABELS] || value}
            />
            <Bar
              dataKey="campaign_match"
              stackId="a"
              fill={ATTRIBUTION_COLORS.campaign_match}
              name="Campaign Match"
            />
            <Bar
              dataKey="platform_detected"
              stackId="a"
              fill={ATTRIBUTION_COLORS.platform_detected}
              name="Platform Detected"
            />
            <Bar
              dataKey="utm_attribution"
              stackId="a"
              fill={ATTRIBUTION_COLORS.utm_attribution}
              name="UTM Attribution"
            />
            <Bar
              dataKey="crm_manual"
              stackId="a"
              fill={ATTRIBUTION_COLORS.crm_manual}
              name="CRM Manual"
            />
            <Bar
              dataKey="unattributed"
              stackId="a"
              fill={ATTRIBUTION_COLORS.unattributed}
              name="Unattributed"
            />
          </BarChart>
        </SafeResponsiveContainer>

        {/* Summary Statistics */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold">Attribution Quality Score</h4>
            <div className="flex items-center gap-2">
              {totals.unattributed > 0 && (
                <div className="flex items-center gap-1 text-xs text-orange-600">
                  <AlertCircle className="h-3 w-3" />
                  {((totals.unattributed / grandTotal) * 100).toFixed(1)}% unattributed
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(totals).map(([key, value]) => {
              const percentage = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(1) : "0"
              return (
                <div
                  key={key}
                  className="p-3 rounded-lg border"
                  style={{
                    borderColor: ATTRIBUTION_COLORS[key as keyof typeof ATTRIBUTION_COLORS],
                    backgroundColor: `${ATTRIBUTION_COLORS[key as keyof typeof ATTRIBUTION_COLORS]}15`,
                  }}
                >
                  <div className="text-xs text-slate-600 mb-1">
                    {ATTRIBUTION_LABELS[key as keyof typeof ATTRIBUTION_LABELS]}
                  </div>
                  <div
                    className="text-lg font-bold"
                    style={{ color: ATTRIBUTION_COLORS[key as keyof typeof ATTRIBUTION_COLORS] }}
                  >
                    {value}
                  </div>
                  <div className="text-xs text-slate-500">{percentage}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
