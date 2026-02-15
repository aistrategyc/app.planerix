import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipStyle, chartTooltipItemStyle } from "@/components/analytics/chart-theme"

interface Props {
  data: Array<{
    date: string
    spend?: number | null
    clicks?: number | null
    conversions?: number | null
    conv_rate?: number
    prev_spend?: number | null
    prev_clicks?: number | null
    prev_conversions?: number | null
    prev_conv_rate?: number
    trend_spend?: string
    trend_clicks?: string
  }>
}

const legendLabelMap = {
  spend: "Витрати",
  clicks: "Кліки",
  conversions: "Конверсії",
  conv_rate: "CR",
  prev_spend: "Витрати (prev)",
  prev_clicks: "Кліки (prev)",
  prev_conversions: "Конверсії (prev)",
  prev_conv_rate: "CR (prev)",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-4 rounded" style={chartTooltipStyle} role="tooltip" aria-label="Деталі графіка">
        <p className="font-semibold">{`Дата: ${label}`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.stroke, ...chartTooltipItemStyle }}>
            {entry.name === "Витрати"
              ? `${entry.name}: ${entry.value.toLocaleString("uk-UA", { style: "currency", currency: "UAH" })}`
              : `${entry.name}: ${entry.value != null ? entry.value.toLocaleString("uk-UA") : "–"}`}
          </p>
        ))}
        {payload[0]?.payload?.trend_spend && (
          <p className="text-sm text-muted-foreground" style={chartTooltipItemStyle}>{`Тренд витрат: ${payload[0].payload.trend_spend}%`}</p>
        )}
        {payload[0]?.payload?.trend_clicks && (
          <p className="text-sm text-muted-foreground" style={chartTooltipItemStyle}>{`Тренд кліків: ${payload[0].payload.trend_clicks}%`}</p>
        )}
      </div>
    )
  }
  return null
}

export function AdsDailyChart({ data }: Props) {
  const showPrev = data.some((row) =>
    row.prev_spend !== undefined ||
    row.prev_clicks !== undefined ||
    row.prev_conversions !== undefined ||
    row.prev_conv_rate !== undefined
  )

  return (
    <div className="h-[300px] w-full" role="region" aria-label="Графік динаміки рекламних метрик за днями">
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Немає даних для відображення
        </div>
      ) : (
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="date" {...chartAxisProps} label={{ value: "Дата", position: "bottom", offset: 0 }} />
            <YAxis
              yAxisId="left"
              {...chartAxisProps}
              tickFormatter={(value) => value.toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
            />
            <YAxis
              yAxisId="percentage"
              orientation="right"
              {...chartAxisProps}
              tickFormatter={(value) => (value * 100).toFixed(1) + "%"}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(value) => legendLabelMap[value as keyof typeof legendLabelMap] ?? value} />
            <Line type="monotone" dataKey="spend" stroke={CHART_COLORS.primary} name="Витрати" strokeWidth={2} dot={false} yAxisId="left" />
            <Line type="monotone" dataKey="clicks" stroke={CHART_COLORS.secondary} name="Кліки" strokeWidth={2} dot={false} yAxisId="left" />
            <Line type="monotone" dataKey="conversions" stroke={CHART_COLORS.quaternary} name="Конверсії" strokeWidth={2} dot={false} yAxisId="left" />
            <Line type="monotone" dataKey="conv_rate" stroke={CHART_COLORS.tertiary} name="CR" strokeWidth={2} dot={false} yAxisId="percentage" />
            {showPrev && (
              <>
                <Line
                  type="monotone"
                  dataKey="prev_spend"
                  stroke={CHART_COLORS.primary}
                  name="Витрати (prev)"
                  strokeWidth={2}
                  dot={false}
                  yAxisId="left"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="prev_clicks"
                  stroke={CHART_COLORS.secondary}
                  name="Кліки (prev)"
                  strokeWidth={2}
                  dot={false}
                  yAxisId="left"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="prev_conversions"
                  stroke={CHART_COLORS.quaternary}
                  name="Конверсії (prev)"
                  strokeWidth={2}
                  dot={false}
                  yAxisId="left"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="prev_conv_rate"
                  stroke={CHART_COLORS.tertiary}
                  name="CR (prev)"
                  strokeWidth={2}
                  dot={false}
                  yAxisId="percentage"
                  strokeDasharray="4 4"
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
