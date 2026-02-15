"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchInsights, InsightRow } from "@/lib/api/analytics-widgets"
import { useToast } from "@/components/ui/use-toast"

type SeverityKey = "all" | "critical" | "warning" | "info"

const SEVERITY_OPTIONS: { key: SeverityKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "info", label: "Info" },
]

const getSeverityBadge = (severity?: string | null) => {
  const value = String(severity || "info").toLowerCase()
  if (value === "critical") return { label: "Critical", variant: "destructive" as const }
  if (value === "warning") return { label: "Warning", variant: "warning" as const }
  if (value === "info") return { label: "Info", variant: "secondary" as const }
  return { label: value, variant: "outline" as const }
}

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  const text = String(value)
  if (text.length >= 10) return text.slice(0, 10)
  return text
}

interface InsightsPanelProps {
  widgetKey: string
  dateFrom?: string
  dateTo?: string
  idCity?: number | string | null
  limit?: number
  title?: string
  enabled?: boolean
  className?: string
}

export function InsightsPanel({
  widgetKey,
  dateFrom,
  dateTo,
  idCity,
  limit = 10,
  title = "Insights",
  enabled = true,
  className,
}: InsightsPanelProps) {
  const { toast } = useToast()
  const [severity, setSeverity] = useState<SeverityKey>("all")
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<InsightRow[]>([])

  const effectiveSeverity = severity === "all" ? undefined : severity
  const requestKey = useMemo(
    () => [widgetKey, dateFrom, dateTo, idCity, effectiveSeverity, limit].join("|"),
    [widgetKey, dateFrom, dateTo, idCity, effectiveSeverity, limit]
  )

  useEffect(() => {
    if (!enabled || !widgetKey) {
      setItems([])
      return
    }
    let active = true
    setLoading(true)
    fetchInsights(widgetKey, {
      limit,
      date_from: dateFrom,
      date_to: dateTo,
      id_city: idCity ?? undefined,
      severity: effectiveSeverity,
    })
      .then((response) => {
        if (!active) return
        setItems(response.items ?? [])
      })
      .catch(() => {
        if (active) setItems([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [requestKey, enabled, widgetKey, dateFrom, dateTo, idCity, effectiveSeverity, limit])

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {SEVERITY_OPTIONS.map((option) => (
            <Button
              key={option.key}
              size="sm"
              variant={severity === option.key ? "default" : "outline"}
              onClick={() => setSeverity(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-xs text-muted-foreground">No insights for this period.</div>
        ) : (
          items.map((insight) => {
            const badge = getSeverityBadge(insight.severity)
            return (
              <div key={String(insight.id ?? Math.random())} className="rounded-xl border border-border/60 bg-card/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{insight.title ?? "Insight"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{insight.summary ?? ""}</div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {formatDate(insight.valid_from)} · {String((insight as { city_name?: string | null }).city_name ?? "—")}
                    </div>
                  </div>
                  <Badge variant={badge.variant} className="text-[10px] uppercase">
                    {badge.label}
                  </Badge>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast({ title: "Coming soon", description: "Task creation will be enabled shortly." })
                    }
                  >
                    Create task
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
