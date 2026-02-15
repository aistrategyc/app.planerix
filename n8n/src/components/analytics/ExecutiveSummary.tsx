"use client"

import { TrendingDown, TrendingUp, Minus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export type ExecutiveSummaryItem = {
  title: string
  kpi: string
  deltaLabel?: string
  deltaDirection?: "up" | "down" | "flat"
  reason: string
  action: string
  impact: string
}

type ExecutiveSummaryProps = {
  title?: string
  subtitle?: string
  items: ExecutiveSummaryItem[]
  className?: string
}

const directionStyles = {
  up: "text-emerald-600",
  down: "text-rose-600",
  flat: "text-slate-500",
} as const

export function ExecutiveSummary({ title = "Executive Summary", subtitle, items, className }: ExecutiveSummaryProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        {title}
      </div>
      {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const direction = item.deltaDirection ?? "flat"
          const icon =
            direction === "up" ? <TrendingUp className="h-4 w-4" /> :
            direction === "down" ? <TrendingDown className="h-4 w-4" /> :
            <Minus className="h-4 w-4" />
          return (
            <div key={item.title} className="glass-panel rounded-3xl border border-border/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.title}</div>
                {item.deltaLabel && (
                  <div className={cn("flex items-center gap-1 text-xs font-semibold", directionStyles[direction])}>
                    {icon}
                    <span>{item.deltaLabel}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 text-2xl font-semibold">{item.kpi}</div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div><span className="font-semibold text-foreground">Reason:</span> {item.reason}</div>
                <div><span className="font-semibold text-foreground">Action:</span> {item.action}</div>
                <div><span className="font-semibold text-foreground">Impact:</span> {item.impact}</div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
