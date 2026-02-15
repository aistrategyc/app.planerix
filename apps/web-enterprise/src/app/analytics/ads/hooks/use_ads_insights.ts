import { useEffect, useState } from "react"
import { fetchInsights, InsightRow } from "@/lib/api/analytics-widgets"

interface Insight {
  severity: string | null
  title: string | null
  summary: string | null
  city_name?: string | null
}

const mapInsight = (row: InsightRow): Insight => ({
  severity: row.severity,
  title: row.title,
  summary: row.summary,
  city_name: (row as { city_name?: string | null }).city_name ?? null,
})

export function useAdsInsights(
  dateRange: { from?: Date; to?: Date },
  widgetKey = "ads.kpi_total",
  limit = 6,
  enabled = true
) {
  const [insights, setInsights] = useState<Insight[]>([])

  useEffect(() => {
    if (!enabled) {
      setInsights([])
      return
    }
    let isActive = true
    const load = async () => {
      try {
        const response = await fetchInsights(widgetKey, limit)
        if (!isActive) return
        setInsights(response.items.map(mapInsight))
      } catch {
        if (isActive) setInsights([])
      }
    }
    load()
    return () => {
      isActive = false
    }
  }, [dateRange, widgetKey, limit, enabled])

  return { insights }
}
