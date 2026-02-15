import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api/config"

interface SalesDaily {
  date: string
  contract_count: number
  total_revenue: number
  total_first_sum: number
}

interface SalesWeekly {
  week_start: string
  total_revenue: number
  total_first_sum: number
  contract_count: number
}

interface ServiceRow {
  service_id: number
  service_name: string
  contract_count: number
  total_revenue: number
  total_first_sum: number
}

interface BranchRow {
  branch_sk: number
  branch_name: string
  contract_count: number
  total_revenue: number
  total_first_sum: number
}

interface UtmRow {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  contract_count: number
  total_revenue: number
  total_first_sum: number
}

interface SalesData {
  daily: SalesDaily[]
  weekly: SalesWeekly[]
  byService: ServiceRow[]
  byBranch: BranchRow[]
  byUtm: UtmRow[]
}

type UseSalesDataOptions = {
  enabled?: boolean
}

export function useSalesData(
  dateRange?: { from?: Date; to?: Date },
  options: UseSalesDataOptions = {}
) {
  const enabled = options.enabled ?? true
  const [data, setData] = useState<SalesData>({
    daily: [],
    weekly: [],
    byService: [],
    byBranch: [],
    byUtm: [],
  })
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const startDate = dateRange?.from ? dateRange.from.toISOString().slice(0, 10) : undefined
    const endDate = dateRange?.to ? dateRange.to.toISOString().slice(0, 10) : undefined

    try {
      const [dailyRes, utmRes, productsRes, branchesRes] = await Promise.all([
        startDate && endDate
          ? api.get("/analytics/sales/revenue-trend", { params: { start_date: startDate, end_date: endDate } })
          : Promise.resolve({ data: { data: [] } }),
        startDate && endDate
          ? api.get("/analytics/sales/v5/utm-sources", { params: { date_from: startDate, date_to: endDate } })
          : Promise.resolve({ data: [] }),
        startDate && endDate
          ? api.get("/analytics/sales/v6/products/performance", { params: { date_from: startDate, date_to: endDate } })
          : Promise.resolve({ data: [] }),
        startDate && endDate
          ? api.get("/analytics/sales/v6/branches/performance", { params: { date_from: startDate, date_to: endDate } })
          : Promise.resolve({ data: [] }),
      ])

      const dailyRows = Array.isArray(dailyRes.data?.data) ? dailyRes.data.data : []
      const daily: SalesDaily[] = dailyRows.map((item: any) => ({
        date: item.date,
        contract_count: item.contracts ?? 0,
        total_revenue: item.revenue ?? 0,
        total_first_sum: item.first_sum ?? item.total_first_sum ?? 0,
      }))

      const getWeekStart = (dateString: string) => {
        const date = new Date(dateString)
        if (Number.isNaN(date.getTime())) return dateString
        const day = date.getDay() || 7
        date.setDate(date.getDate() - day + 1)
        return date.toISOString().slice(0, 10)
      }

      const weeklyMap = new Map<string, SalesWeekly>()
      daily.forEach((row) => {
        const weekStart = getWeekStart(row.date)
        const bucket = weeklyMap.get(weekStart) ?? {
          week_start: weekStart,
          total_revenue: 0,
          total_first_sum: 0,
          contract_count: 0,
        }
        bucket.total_revenue += row.total_revenue ?? 0
        bucket.total_first_sum += row.total_first_sum ?? 0
        bucket.contract_count += row.contract_count ?? 0
        weeklyMap.set(weekStart, bucket)
      })

      const mappedWeekly = Array.from(weeklyMap.values()).sort((a, b) => a.week_start.localeCompare(b.week_start))

      const byUtm = Array.isArray(utmRes.data)
        ? utmRes.data.map((item: any) => ({
            utm_source: item.utm_source ?? "unknown",
            utm_medium: item.utm_medium ?? "",
            utm_campaign: item.utm_campaign ?? "",
            contract_count: item.n_contracts ?? 0,
            total_revenue: item.revenue ?? 0,
            total_first_sum: item.avg_first_sum ?? item.first_sum ?? item.total_first_sum ?? 0,
          }))
        : []

      const byService = Array.isArray(productsRes.data)
        ? productsRes.data.map((item: any) => ({
            service_id: item.service_id ?? 0,
            service_name: item.product_name ?? "Unknown",
            contract_count: item.contracts ?? 0,
            total_revenue: item.revenue ?? 0,
            total_first_sum: item.avg_first_sum ?? item.first_sum ?? item.total_first_sum ?? item.avg_value ?? 0,
          }))
        : []

      const byBranch = Array.isArray(branchesRes.data)
        ? branchesRes.data.map((item: any) => ({
            branch_sk: item.branch_sk ?? item.id_city ?? 0,
            branch_name: item.branch_name ?? item.city_name ?? "Unknown",
            contract_count: item.contracts ?? item.contract_count ?? 0,
            total_revenue: item.revenue ?? item.total_revenue ?? 0,
            total_first_sum: item.avg_first_sum ?? item.first_sum ?? item.total_first_sum ?? 0,
          }))
        : []

      setData({
        daily,
        weekly: mappedWeekly,
        byService,
        byBranch,
        byUtm,
      })
    } catch (error) {
      console.error("Ошибка при загрузке sales data", error)
      setData({
        daily: [],
        weekly: [],
        byService: [],
        byBranch: [],
        byUtm: [],
      })
    } finally {
      setIsLoading(false)
    }
  }, [enabled, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    ...data,
    isLoading,
    refetch: fetchData,
  }
}
