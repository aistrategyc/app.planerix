"use client"

import { useState, useMemo, useCallback } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"

import { Lightbulb, ChevronRight, Download, Search, ChevronDown, ChevronUp } from "lucide-react"

import { useSalesData } from "./hooks/use_sales_data"
import { useSalesInsights } from "./hooks/use_sales_insights"

import { MetricCard } from "./components/metric_card"
import { SalesDailyChart } from "./components/sales_daily_chart"
import { SalesWeeklyChart } from "./components/sales_weekly_chart"
import { SalesByServiceTable } from "./components/sales_by_service_table"
import { SalesByBranchTable } from "./components/sales_by_branch_table"
import { SalesByUtmTable } from "./components/sales_by_utm_table"
import { PageHeader } from "@/components/layout/PageHeader"

interface FilterState {
  searchQuery: string
  sortBy: string
  sortOrder: "asc" | "desc"
  filterField: "all" | "branch_name" | "service_name" | "utm_source"
}

interface MetricTrend {
  value: string
  direction: "up" | "down" | null
}

export default function SalesPage() {
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersValue>({ dateRange: {}, cityId: "all" })
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFiltersValue>({ dateRange: {}, cityId: "all" })
  const [dateError, setDateError] = useState<string | null>(null)
  const [comparePrevious, setComparePrevious] = useState(false)
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: "",
    sortBy: "total_revenue",
    sortOrder: "desc",
    filterField: "all",
  })
  const [expandedInsights, setExpandedInsights] = useState<{ [key: string]: boolean }>({
    daily: false,
    weekly: false,
    services: false,
    branches: false,
    utm: false,
  })

  const dateRange = appliedFilters.dateRange

  const { isLoading, daily, weekly, byService, byBranch, byUtm, refetch } = useSalesData(dateRange)
  const { insights: salesInsights } = useSalesInsights(dateRange) // <-- Переименовали здесь

  // Previous range (если включено сравнение)
  const prevRange = useMemo(() => {
    if (!comparePrevious || !dateRange.from || !dateRange.to) return null
    const period = dateRange.to.getTime() - dateRange.from.getTime()
    const prevFrom = new Date(dateRange.from.getTime() - period)
    const prevTo = new Date(dateRange.from.getTime())
    return { from: prevFrom, to: prevTo }
  }, [comparePrevious, dateRange])

  const applyFilters = () => {
    if (!draftFilters.dateRange.from || !draftFilters.dateRange.to) {
      setDateError("Select a date range to apply filters.")
      return
    }
    setDateError(null)
    setAppliedFilters(draftFilters)
  }

  const resetFilters = () => {
    const resetValue: AnalyticsFiltersValue = { dateRange: {}, cityId: "all" }
    setDraftFilters(resetValue)
    setAppliedFilters(resetValue)
    setDateError(null)
    setComparePrevious(false)
    setFilterState({ searchQuery: "", sortBy: "total_revenue", sortOrder: "desc", filterField: "all" })
  }

  // ВАЖНО: логика ниже сохранена как у вас (да, это условный вызов хука в исходнике)
  const prevSalesData = useSalesData(prevRange ?? undefined, { enabled: Boolean(prevRange) })

  // Агрегированные метрики
  const metrics = useMemo(() => {
    const totalContracts = (daily ?? []).reduce((acc, d) => acc + (d.contract_count ?? 0), 0)
    const totalRevenue = (daily ?? []).reduce((acc, d) => acc + (d.total_revenue ?? 0), 0)
    const totalFirstSum = (daily ?? []).reduce((acc, d) => acc + (d.total_first_sum ?? 0), 0)
    const avgCheck = totalContracts > 0 ? Math.round(totalRevenue / totalContracts) : 0
    const branchCount = (byBranch ?? []).length
    const avgRevenuePerBranch = branchCount > 0 ? Math.round(totalRevenue / branchCount) : 0
    const conversionRate = totalContracts > 0 ? ((totalFirstSum / totalRevenue) * 100).toFixed(1) : "0.0"

    const topService = byService?.length
      ? byService.reduce((max, curr) => (curr.total_revenue > max.total_revenue ? curr : max), byService[0])
      : null
    const topUtm = byUtm?.length
      ? byUtm.reduce((max, curr) => (curr.total_revenue > max.total_revenue ? curr : max), byUtm[0])
      : null
    const topBranch = byBranch?.length
      ? byBranch.reduce((max, curr) => (curr.total_revenue > max.total_revenue ? curr : max), byBranch[0])
      : null

    let revenueTrend: MetricTrend = { value: "0", direction: null }
    if (prevSalesData?.daily) {
      const prevTotalRevenue = prevSalesData.daily.reduce((acc, d) => acc + (d.total_revenue ?? 0), 0)
      if (prevTotalRevenue > 0) {
        const change = ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
        revenueTrend = {
          value: `${Math.abs(change).toFixed(1)}%`,
          direction: change >= 0 ? "up" : "down",
        }
      }
    }

    return {
      totalContracts,
      totalRevenue,
      totalFirstSum,
      avgCheck,
      avgRevenuePerBranch,
      conversionRate,
      revenueTrend,
      topBranch: topBranch ? { name: topBranch.branch_name, revenue: topBranch.total_revenue } : null,
      topService: topService ? { name: topService.service_name, revenue: topService.total_revenue } : null,
      topUtm: topUtm ? { name: topUtm.utm_source, revenue: topUtm.total_revenue } : null,
    }
  }, [daily, byService, byBranch, byUtm, prevSalesData])

  // Фильтрация и сортировка
  const filteredAndSortedData = useMemo(() => {
    const filterAndSort = <T extends { branch_name?: string; service_name?: string; utm_source?: string }>(
      data: T[],
      field: keyof T
    ) => {
      return data
        .filter((item) => {
          const searchField =
            filterState.filterField === "branch_name"
              ? item.branch_name
              : filterState.filterField === "service_name"
              ? item.service_name
              : filterState.filterField === "utm_source"
              ? item.utm_source
              : item.branch_name || item.service_name || item.utm_source || ""
          return searchField?.toLowerCase().includes(filterState.searchQuery.toLowerCase()) ?? false
        })
        .sort((a, b) => {
          const valueA = a[field] ?? 0
          const valueB = b[field] ?? 0
          return filterState.sortOrder === "asc"
            ? Number(valueA) - Number(valueB)
            : Number(valueB) - Number(valueA)
        })
    }

    return {
      byService: filterAndSort(byService ?? [], filterState.sortBy as keyof typeof byService[0]),
      byBranch: filterAndSort(byBranch ?? [], filterState.sortBy as keyof typeof byBranch[0]),
      byUtm: filterAndSort(byUtm ?? [], filterState.sortBy as keyof typeof byUtm[0]),
    }
  }, [byService, byBranch, byUtm, filterState])

  // Экспорт CSV
  const exportToCSV = useCallback((data: any[], filename: string) => {
    if (!data.length) return
    const headers = Object.keys(data[0])
      .map((key) => {
        switch (key) {
          case "branch_name":
            return "Філія"
          case "service_name":
            return "Послуга"
          case "utm_source":
            return "Джерело UTM"
          case "utm_campaign":
            return "Кампанія"
          case "contract_count":
            return "Контракти"
          case "total_revenue":
            return "Виручка (₴)"
          case "total_first_sum":
            return "Перший платіж (₴)"
          default:
            return key
        }
      })
      .join(",")
    const rows = data
      .map((item) =>
        Object.values(item)
          .map((val) => (typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val))
          .join(",")
      )
      .join("\n")
    const csv = `${headers}\n${rows}`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const priorityColor = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-slate-100 text-slate-700",
  } as const

  // Блок инсайтов (используем salesInsights)
  const InsightBlock = ({ topic }: { topic: string }) => {
    const insight = salesInsights.find((i) => i.topic === topic)
    if (!insight || !insight.summary) return null
    const isExpanded = expandedInsights[topic]
    return (
      <div className="mt-4 space-y-2 transition-all duration-300">
        <button
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground w-full text-left hover:bg-muted/50 rounded-md p-2"
          onClick={() => setExpandedInsights({ ...expandedInsights, [topic]: !isExpanded })}
          aria-expanded={isExpanded}
          aria-controls={`insight-${topic}`}
        >
          <Lightbulb className="h-4 w-4 text-yellow-600" />
          Інсайт: <span className="italic font-normal flex-1">{insight.summary}</span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {isExpanded && insight.recommendations?.length > 0 && (
          <div id={`insight-${topic}`} className="space-y-2 pl-6">
            <Separator />
            <p className="text-sm font-medium text-muted-foreground">📌 Рекомендації:</p>
            <ul className="space-y-1">
              {insight.recommendations.map((rec: any, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-[2px] text-muted-foreground" />
                  <span className="text-sm">{rec.text}</span>
                  <Badge className={cn("ml-auto", priorityColor[rec.priority as keyof typeof priorityColor])}>
                    {rec.priority}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="📊 Продажі (з CRM)"
        description="Дані про контракти, виручку та канали за вибраний період"
      />

      {dateError && <div className="text-xs text-red-600">{dateError}</div>}

      <AnalyticsFilters
        value={draftFilters}
        onDateChange={(value) => setDraftFilters((prev) => ({ ...prev, dateRange: value }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={isLoading}
        showCity={false}
        compact
        extraControls={
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComparePrevious(!comparePrevious)}
              disabled={!draftFilters.dateRange.from || !draftFilters.dateRange.to}
            >
              {comparePrevious ? "Disable comparison" : "Compare with previous"}
            </Button>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search..."
                value={filterState.searchQuery}
                onChange={(e) => setFilterState({ ...filterState, searchQuery: e.target.value })}
                className="pl-8 w-full"
                aria-label="Search by branch, service, or UTM"
              />
            </div>
            <Select
              value={filterState.filterField}
              onValueChange={(value) => setFilterState({ ...filterState, filterField: value as FilterState["filterField"] })}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Filter field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All fields</SelectItem>
                <SelectItem value="branch_name">Branch</SelectItem>
                <SelectItem value="service_name">Service</SelectItem>
                <SelectItem value="utm_source">UTM source</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterState.sortBy}
              onValueChange={(value) => setFilterState({ ...filterState, sortBy: value })}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total_revenue">Revenue</SelectItem>
                <SelectItem value="contract_count">Contracts</SelectItem>
                <SelectItem value="total_first_sum">First payment</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterState.sortOrder}
              onValueChange={(value) => setFilterState({ ...filterState, sortOrder: value as "asc" | "desc" })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <Separator className="my-6" />

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Усього контрактів"
          value={metrics.totalContracts.toLocaleString()}
          isLoading={isLoading || (comparePrevious && prevSalesData?.isLoading)}
          subtitle={metrics.topBranch ? `Лідер: ${metrics.topBranch.name}` : undefined}
        />
        <MetricCard
          title="Загальна виручка"
          value={`${metrics.totalRevenue.toLocaleString()} ₴`}
          isLoading={isLoading || (comparePrevious && prevSalesData?.isLoading)}
          trend={metrics.revenueTrend.direction}
          trendValue={metrics.revenueTrend.value}
        />
        <MetricCard
          title="Перший платіж"
          value={`${metrics.totalFirstSum.toLocaleString()} ₴`}
          isLoading={isLoading || (comparePrevious && prevSalesData?.isLoading)}
        />
        <MetricCard
          title="Середній чек"
          value={`${metrics.avgCheck.toLocaleString()} ₴`}
          isLoading={isLoading || (comparePrevious && prevSalesData?.isLoading)}
        />
        <MetricCard
          title="Виручка на філію"
          value={`${metrics.avgRevenuePerBranch.toLocaleString()} ₴`}
          isLoading={isLoading || (comparePrevious && prevSalesData?.isLoading)}
        />
        <MetricCard
          title="Конверсія"
          value={`${metrics.conversionRate}%`}
          isLoading={isLoading || (comparePrevious && prevSalesData?.isLoading)}
          subtitle="Перший платіж / Виручка"
        />
        <MetricCard
          title="Top Послуга"
          value={metrics.topService?.name || "-"}
          subtitle={metrics.topService ? `${metrics.topService.revenue.toLocaleString()} ₴` : undefined}
          isLoading={isLoading || (comparePrevious && prevSalesData?.isLoading)}
        />
        <MetricCard
          title="Top UTM"
          value={metrics.topUtm?.name || "-"}
          subtitle={metrics.topUtm ? `${metrics.topUtm.revenue.toLocaleString()} ₴` : undefined}
          isLoading={isLoading || (comparePrevious && prevSalesData?.isLoading)}
        />
      </div>

      {/* Export Buttons */}
      <div className="flex justify-end gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(daily ?? [], `daily_sales_${new Date().toISOString().split("T")[0]}`)}
                disabled={isLoading || !daily?.length}
                className="transition-colors hover:bg-muted"
              >
                <Download className="h-4 w-4 mr-2" />
                Денні дані
              </Button>
            </TooltipTrigger>
            <TooltipContent>Експорт денних даних у CSV</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(byService ?? [], `service_sales_${new Date().toISOString().split("T")[0]}`)}
                disabled={isLoading || !byService?.length}
                className="transition-colors hover:bg-muted"
              >
                <Download className="h-4 w-4 mr-2" />
                За послугами
              </Button>
            </TooltipTrigger>
            <TooltipContent>Експорт даних за послугами у CSV</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(byBranch ?? [], `branch_sales_${new Date().toISOString().split("T")[0]}`)}
                disabled={isLoading || !byBranch?.length}
                className="transition-colors hover:bg-muted"
              >
                <Download className="h-4 w-4 mr-2" />
                За філіями
              </Button>
            </TooltipTrigger>
            <TooltipContent>Експорт даних за філіями у CSV</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Daily Chart */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">📅 Продажі за днями</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesDailyChart data={daily ?? []} />
          <InsightBlock topic="daily" />
        </CardContent>
      </Card>

      {/* Weekly Chart */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">📈 Продажі за тижнями</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesWeeklyChart data={weekly ?? []} />
          <InsightBlock topic="weekly" />
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">🛠 Розбивка за послугами</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesByServiceTable data={filteredAndSortedData.byService} />
          <InsightBlock topic="services" />
        </CardContent>
      </Card>

      {/* Branches Table */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">🏢 Розбивка за філіями</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesByBranchTable data={filteredAndSortedData.byBranch} />
          <InsightBlock topic="branches" />
        </CardContent>
      </Card>

      {/* UTM Table */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">🔗 Аналітика за UTM-мітками</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesByUtmTable data={filteredAndSortedData.byUtm} />
          <InsightBlock topic="utm" />
        </CardContent>
      </Card>
    </div>
  )
}
