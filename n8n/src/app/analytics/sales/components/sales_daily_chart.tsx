import * as React from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { format } from "date-fns"
import { uk } from "date-fns/locale"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"

interface DailyRow {
  date: string
  contract_count: number
  total_revenue: number
  total_first_sum: number
}

interface SalesDailyChartProps {
  data: DailyRow[]
}

export function SalesDailyChart({ data }: SalesDailyChartProps) {
  const formattedData = React.useMemo(
    () =>
      (data ?? []).map((row) => ({
        ...row,
        formattedDate: format(new Date(row.date), "dd.MM.yyyy", { locale: uk }),
      })),
    [data]
  )

  const aggregated = React.useMemo(() => {
    const totalRevenue = (data ?? []).reduce((acc, r) => acc + (r.total_revenue ?? 0), 0)
    const totalContracts = (data ?? []).reduce((acc, r) => acc + (r.contract_count ?? 0), 0)
    const totalFirstSum = (data ?? []).reduce((acc, r) => acc + (r.total_first_sum ?? 0), 0)
    const avgRevenuePerContract = totalContracts > 0 ? Math.round(totalRevenue / totalContracts) : 0
    return { totalRevenue, totalContracts, totalFirstSum, avgRevenuePerContract }
  }, [data])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-xl px-3 py-2 shadow-lg" style={chartTooltipStyle}>
        <p className="text-xs font-medium" style={chartTooltipItemStyle}>{label}</p>
        <div className="mt-1 space-y-0.5">
          {payload.map((entry: any, idx: number) => (
            <p key={idx} className="text-xs tabular-nums" style={{ ...chartTooltipItemStyle, color: entry.color }}>
              {entry.name}:{" "}
              {entry.value?.toLocaleString("uk-UA")}
              {entry.dataKey === "contract_count" ? "" : " ₴"}
            </p>
          ))}
        </div>
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        Дані відсутні за обраний період.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Верхние мини-метрики */}
      <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="inline-flex items-center justify-between rounded-md border bg-white/70 px-3 py-2">
          <span>Загальна виручка</span>
          <span className="tabular-nums font-semibold text-slate-900">
            {aggregated.totalRevenue.toLocaleString("uk-UA")} ₴
          </span>
        </div>
        <div className="inline-flex items-center justify-between rounded-md border bg-white/70 px-3 py-2">
          <span>Усього контрактів</span>
          <span className="tabular-nums font-semibold text-slate-900">
            {aggregated.totalContracts.toLocaleString("uk-UA")}
          </span>
        </div>
        <div className="inline-flex items-center justify-between rounded-md border bg-white/70 px-3 py-2">
          <span>Середній чек</span>
          <span className="tabular-nums font-semibold text-slate-900">
            {aggregated.avgRevenuePerContract.toLocaleString("uk-UA")} ₴
          </span>
        </div>
      </div>

      {/* Линейный график */}
      <div className="rounded-lg border p-2 sm:p-3">
        <SafeResponsiveContainer width="100%" height={320}>
          <LineChart
            data={formattedData}
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="formattedDate"
              minTickGap={24}
              {...chartAxisProps}
            />
            <YAxis
              tickFormatter={(v) => v.toLocaleString("uk-UA")}
              width={70}
              {...chartAxisProps}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={10}
              wrapperStyle={{ fontSize: 12, paddingBottom: 8, color: "#6B7280" }}
            />

            <Line
              type="monotone"
              dataKey="contract_count"
              name="Контракти"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="total_revenue"
              name="Виручка"
              stroke={CHART_COLORS.secondary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="total_first_sum"
              name="Перший платіж"
              stroke={CHART_COLORS.tertiary}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </SafeResponsiveContainer>
      </div>
    </div>
  )
}