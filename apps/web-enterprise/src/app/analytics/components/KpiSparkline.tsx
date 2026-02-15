"use client"

import { Line, LineChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { CHART_COLORS } from "@/components/analytics/chart-theme"

type SparklinePoint = {
  value: number | null
}

interface KpiSparklineProps {
  data: SparklinePoint[]
  stroke?: string
  className?: string
}

export function KpiSparkline({ data, stroke = CHART_COLORS.primary, className }: KpiSparklineProps) {
  const cleaned = data.filter((point) => typeof point.value === "number" && !Number.isNaN(point.value))
  if (cleaned.length < 2) {
    return <div className={cn("h-10 w-full rounded bg-muted/40", className)} aria-hidden="true" />
  }

  return (
    <div className={cn("h-10 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={cleaned}>
          <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
