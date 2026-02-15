import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"
import * as React from "react"

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  isLoading?: boolean
  trend?: "up" | "down" | null
  trendValue?: string
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  isLoading,
  trend,
  trendValue,
  className,
}: MetricCardProps) {
  const hasTrend = !!trend && !!trendValue

  return (
    <Card
      className={cn(
        "w-full transition-shadow hover:shadow-md border border-border/60 bg-card/40 shadow-sm",
        className
      )}
    >
      <CardHeader className="pb-2">
        {isLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <CardTitle
            className="text-xs sm:text-sm font-medium text-muted-foreground leading-none"
            title={title}
          >
            {title}
          </CardTitle>
        )}
      </CardHeader>

      <CardContent className="pt-1">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div
                className="text-2xl font-bold leading-tight tabular-nums tracking-tight"
                aria-live="polite"
              >
                {value}
              </div>

              {hasTrend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1",
                    trend === "up"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                      : "bg-rose-50 text-rose-700 ring-rose-100"
                  )}
                  aria-label={`Изменение: ${trend === "up" ? "рост" : "падение"} на ${trendValue}`}
                  title={`Изменение: ${trend === "up" ? "рост" : "падение"} на ${trendValue}`}
                >
                  {trend === "up" ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {trendValue}
                </span>
              )}
            </div>

            {subtitle && (
              <div
                className="text-xs text-muted-foreground mt-1 line-clamp-1"
                title={subtitle}
              >
                {subtitle}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
