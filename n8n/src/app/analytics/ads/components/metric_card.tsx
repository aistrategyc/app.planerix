import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline"

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  isLoading?: boolean
  trend?: "up" | "down" | "neutral" // Для отображения тренда
}

export function MetricCard({ title, value, subtitle, isLoading, trend }: MetricCardProps) {
  return (
    <Card className="w-full transition-shadow hover:shadow-md bg-card/40 border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
          {title}
          {trend === "up" && <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />}
          {trend === "down" && <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />}
          {trend === "neutral" && <span className="h-4 w-4 text-slate-500">—</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="text-2xl font-semibold leading-tight" aria-label={`Значення метрики ${title}: ${value}`}>
            {value}
          </div>
        )}
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-1" aria-describedby={`subtitle-${title}`}>
            {subtitle}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
