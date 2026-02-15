"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ExternalLink } from "lucide-react"

import { AttributionFilterBar } from "@/app/attribution/components/AttributionFilterBar"
import { useAttributionFilters } from "@/app/attribution/hooks/useAttributionFilters"
import { buildDateKey } from "@/app/attribution/utils/filters"
import { buildLastWeekRange, resolveDefaultCityId } from "@/app/analytics/utils/defaults"
import { formatCurrency, formatNumber, formatPercent } from "@/app/analytics/utils/formatters"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { WidgetStatus } from "@/app/analytics/components/WidgetStatus"
import { AttributionPreviewImage } from "@/app/attribution/components/AttributionPreviewImage"
import { fetchAttributionWidgets } from "@/lib/api/attribution"
import { fetchWidgetRange } from "@/lib/api/analytics-widgets"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"

const WIDGET_KEYS = {
  kpi: "attr.revenue.kpi_daily",
  attribution: "attr.revenue.attribution_daily",
  products: "attr.revenue.product_daily",
  topCampaigns: "attr.revenue.top_campaigns_daily",
  metaAds: "attr.revenue.meta_ads_daily",
  gadsCampaigns: "attr.revenue.gads_campaigns_daily",
  detail: "attr.revenue.attributed_detail",
}

type ContractsDailyRow = {
  date_key?: string | null
  id_city?: number | null
  channel?: string | null
  contracts_cnt?: number | null
  revenue_total_cost?: number | null
  payments_sum?: number | null
}

type AttributionRow = {
  date_key?: string | null
  channel?: string | null
  contracts_cnt?: number | null
}

type ProductRow = {
  date_key?: string | null
  product_name?: string | null
  course_name?: string | null
  platform?: string | null
  contracts_cnt?: number | null
  revenue_sum?: number | null
  payments_sum?: number | null
  avg_check?: number | null
}

type CampaignRow = {
  date_key?: string | null
  platform?: string | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  contracts_cnt?: number | null
  revenue_total_cost?: number | null
  payments_sum?: number | null
}

type MetaAdRow = {
  date_key?: string | null
  ad_id?: string | number | null
  ad_name?: string | null
  creative_title?: string | null
  preview_image_url?: string | null
  permalink_url?: string | null
  contracts_cnt?: number | null
  revenue_total_cost?: number | null
  payments_sum?: number | null
}

type AttributedDetailRow = {
  contract_id?: string | number | null
  contract_date_key?: string | null
  id_city?: number | null
  attributed_platform?: string | null
  meta_campaign_name?: string | null
  meta_ad_name?: string | null
  gads_campaign_name?: string | null
  display_title?: string | null
  display_channel?: string | null
  offline_source_type_label?: string | null
  offline_owner_name?: string | null
  creative_title?: string | null
  preview_image_url?: string | null
  permalink_url?: string | null
  total_cost?: number | null
  paid_sum?: number | null
  payments_sum?: number | null
}

type AttributionWidgetsPayload = {
  widgets: Record<string, { data: { current: any[] }; meta: { missing_view?: boolean } }>
}

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const normalizeLabel = (value?: string | null) => (value ?? "Unknown").trim() || "Unknown"

const sumByKey = (rows: Array<Record<string, unknown>>, key: string) =>
  rows.reduce((acc, row) => acc + (toNumber(row[key]) ?? 0), 0)

const buildDailySeries = (rows: ContractsDailyRow[]) => {
  const map = new Map<string, { contracts: number; revenue: number; payments: number }>()
  rows.forEach((row) => {
    const dateKey = row.date_key
    if (!dateKey) return
    const bucket = map.get(dateKey) ?? { contracts: 0, revenue: 0, payments: 0 }
    bucket.contracts += toNumber(row.contracts_cnt) ?? 0
    bucket.revenue += toNumber(row.revenue_total_cost) ?? 0
    bucket.payments += toNumber(row.payments_sum) ?? 0
    map.set(dateKey, bucket)
  })
  return [...map.entries()]
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([date, metrics]) => ({ date, ...metrics }))
}

export default function AttributionRevenueClient() {
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const hasDateParam = useMemo(
    () => Boolean(searchParams.get("date_from") || searchParams.get("date_to")),
    [searchKey]
  )
  const hasCityParam = useMemo(() => Boolean(searchParams.get("id_city")), [searchKey])
  const { cities } = useCities()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const canFetch = isAuthenticated && !authLoading

  const {
    draftFilters,
    appliedFilters,
    setDraftFilters,
    setAppliedFilters,
    applyFilters,
    resetFilters,
    updateQuery,
  } = useAttributionFilters()

  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [data, setData] = useState<AttributionWidgetsPayload>({ widgets: {} })
  const [isLoading, setIsLoading] = useState(false)
  const [showAllContracts, setShowAllContracts] = useState(false)

  useEffect(() => {
    if (!canFetch) return
    if (defaultsApplied) return
    if (hasDateParam) {
      setDefaultsApplied(true)
      return
    }
    let active = true
    const hydrateDefaults = async () => {
      try {
        const range = await fetchWidgetRange("attr.overview.kpi_total")
        if (!active) return
        const dateRange = buildLastWeekRange(range?.max_date ?? null)
        if (!dateRange) {
          setDefaultsApplied(true)
          return
        }
        setDraftFilters((prev) => ({ ...prev, dateRange }))
        setAppliedFilters((prev) => ({ ...prev, dateRange }))
        updateQuery({
          date_from: buildDateKey(dateRange.from),
          date_to: buildDateKey(dateRange.to),
        })
      } catch (error) {
        console.warn("Failed to load attribution default date range", error)
      } finally {
        if (active) setDefaultsApplied(true)
      }
    }
    hydrateDefaults()
    return () => {
      active = false
    }
  }, [canFetch, defaultsApplied, hasDateParam, setAppliedFilters, setDraftFilters, updateQuery])

  useEffect(() => {
    if (hasCityParam) return
    const cityId = resolveDefaultCityId(cities)
    if (!cityId) return
    setDraftFilters((prev) => ({ ...prev, cityId: String(cityId) }))
    setAppliedFilters((prev) => ({ ...prev, cityId: String(cityId) }))
    updateQuery({ id_city: String(cityId) })
  }, [cities, hasCityParam, setAppliedFilters, setDraftFilters, updateQuery])

  const requestParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {}
    if (appliedFilters.dateRange.from) {
      params.date_from = buildDateKey(appliedFilters.dateRange.from)
    }
    if (appliedFilters.dateRange.to) {
      params.date_to = buildDateKey(appliedFilters.dateRange.to)
    }
    if (appliedFilters.compareMode !== "none") {
      params.compare = appliedFilters.compareMode
    }
    if (appliedFilters.compareMode === "custom") {
      if (appliedFilters.compareRange.from) {
        params.compare_from = buildDateKey(appliedFilters.compareRange.from)
      }
      if (appliedFilters.compareRange.to) {
        params.compare_to = buildDateKey(appliedFilters.compareRange.to)
      }
    }
    if (appliedFilters.cityId !== "all") {
      params.id_city = appliedFilters.cityId
    }
    if (appliedFilters.platform !== "all") {
      params.platform = appliedFilters.platform
    }
    if (appliedFilters.channel !== "all") {
      params.channel = appliedFilters.channel
    }
    if (appliedFilters.device !== "all") {
      params.device = appliedFilters.device
    }
    if (appliedFilters.conversionType !== "all") {
      params.conversion_type = appliedFilters.conversionType
    }
    return params
  }, [appliedFilters])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch) return
      setIsLoading(true)
      try {
        const response = await fetchAttributionWidgets({
          widgetKeys: Object.values(WIDGET_KEYS),
          filters: requestParams,
        })
        if (!active) return
        setData(response)
      } catch (error) {
        if (!active) return
        console.error("Failed to load attribution revenue widgets", error)
        setData({ widgets: {} })
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [canFetch, requestParams])

  const kpiWidget = data.widgets[WIDGET_KEYS.kpi] as
    | { data: { current: ContractsDailyRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const attributionWidget = data.widgets[WIDGET_KEYS.attribution] as
    | { data: { current: AttributionRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const productsWidget = data.widgets[WIDGET_KEYS.products] as
    | { data: { current: ProductRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const campaignsWidget = data.widgets[WIDGET_KEYS.topCampaigns] as
    | { data: { current: CampaignRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const metaAdsWidget = data.widgets[WIDGET_KEYS.metaAds] as
    | { data: { current: MetaAdRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const gadsWidget = data.widgets[WIDGET_KEYS.gadsCampaigns] as
    | { data: { current: CampaignRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const detailWidget = data.widgets[WIDGET_KEYS.detail] as
    | { data: { current: AttributedDetailRow[] }; meta: { missing_view?: boolean } }
    | undefined

  const kpiRows = kpiWidget?.data?.current ?? []
  const attributionRows = attributionWidget?.data?.current ?? []
  const productRows = productsWidget?.data?.current ?? []
  const campaignRows = campaignsWidget?.data?.current ?? []
  const metaAdRows = metaAdsWidget?.data?.current ?? []
  const gadsCampaignRows = gadsWidget?.data?.current ?? []
  const detailRows = detailWidget?.data?.current ?? []

  const totalContracts = sumByKey(kpiRows, "contracts_cnt")
  const totalRevenue = sumByKey(kpiRows, "revenue_total_cost")
  const totalPayments = sumByKey(kpiRows, "payments_sum")
  const avgCheck = totalContracts > 0 ? totalRevenue / totalContracts : null
  const paymentShare = totalRevenue > 0 ? totalPayments / totalRevenue : null

  const dailySeries = buildDailySeries(kpiRows)

  const attributionByChannel = useMemo(() => {
    const map = new Map<string, number>()
    attributionRows.forEach((row) => {
      const channel = normalizeLabel(row.channel)
      map.set(channel, (map.get(channel) ?? 0) + (toNumber(row.contracts_cnt) ?? 0))
    })
    return [...map.entries()].map(([channel, contracts]) => ({ channel, contracts }))
  }, [attributionRows])

  const topProducts = [...productRows]
    .sort((a, b) => (toNumber(b.revenue_sum) ?? 0) - (toNumber(a.revenue_sum) ?? 0))
    .slice(0, 8)

  const topCampaigns = [...campaignRows]
    .sort((a, b) => (toNumber(b.revenue_total_cost) ?? 0) - (toNumber(a.revenue_total_cost) ?? 0))
    .slice(0, 10)

  const metaAds = useMemo(() => {
    const map = new Map<string, MetaAdRow & { contracts: number; revenue: number; payments: number }>()
    metaAdRows.forEach((row) => {
      const key = String(row.ad_id ?? row.creative_title ?? "unknown")
      const existing = map.get(key)
      const contracts = (toNumber(row.contracts_cnt) ?? 0) + (existing?.contracts ?? 0)
      const revenue = (toNumber(row.revenue_total_cost) ?? 0) + (existing?.revenue ?? 0)
      const payments = (toNumber(row.payments_sum) ?? 0) + (existing?.payments ?? 0)
      map.set(key, {
        ...row,
        contracts,
        revenue,
        payments,
      })
    })
    return [...map.values()]
      .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
      .slice(0, 8)
  }, [metaAdRows])

  const gadsCampaigns = [...gadsCampaignRows]
    .sort((a, b) => (toNumber(b.revenue_total_cost) ?? 0) - (toNumber(a.revenue_total_cost) ?? 0))
    .slice(0, 10)

  const topContracts = showAllContracts ? detailRows : detailRows.slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attribution · Revenue"
        description="Выручка, оплатa и вклад каналов по выбранным фильтрам."
      />
      <AttributionFilterBar
        value={draftFilters}
        onChange={(next) => setDraftFilters((prev) => ({ ...prev, ...next }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={isLoading}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Contracts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-24" /> : formatNumber(totalContracts)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalRevenue)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Payments</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalPayments)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg Check</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(avgCheck)}
            {paymentShare != null && (
              <div className="text-xs text-muted-foreground">Paid share {formatPercent(paymentShare, 1)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue & Contracts trend</CardTitle>
        </CardHeader>
        <CardContent>
          {kpiWidget?.meta?.missing_view ? (
            <WidgetStatus title="Нет витрины выручки" description="attr.revenue.kpi_daily не подключена." />
          ) : dailySeries.length === 0 && !isLoading ? (
            <div className="text-sm text-muted-foreground">Нет данных для выбранного периода.</div>
          ) : (
            <div className="h-[280px] w-full">
              <SafeResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="date" {...chartAxisProps} />
                  <YAxis yAxisId="contracts" tickFormatter={(value) => formatNumber(value as number)} {...chartAxisProps} />
                  <YAxis yAxisId="revenue" orientation="right" tickFormatter={(value) => formatCurrency(value as number)} {...chartAxisProps} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                    formatter={(value, name) => {
                      if (name === "revenue" || name === "payments") return [formatCurrency(value as number), name]
                      return [formatNumber(value as number), name]
                    }}
                  />
                  <Bar yAxisId="contracts" dataKey="contracts" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke={CHART_COLORS.secondary} strokeWidth={2} />
                  <Area yAxisId="revenue" type="monotone" dataKey="payments" fill={CHART_COLORS.secondary} stroke={CHART_COLORS.secondary} fillOpacity={0.2} />
                </ComposedChart>
              </SafeResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attribution mix</CardTitle>
          </CardHeader>
          <CardContent>
            {attributionWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины attribution" description="attr.revenue.attribution_daily не подключена." />
            ) : attributionByChannel.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет данных по каналам.</div>
            ) : (
              <div className="space-y-2">
                {attributionByChannel.map((row) => (
                  <div key={row.channel} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.channel}</span>
                    <Badge variant="outline">Contracts {formatNumber(row.contracts)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
          </CardHeader>
          <CardContent>
            {productsWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины продуктов" description="attr.revenue.product_daily не подключена." />
            ) : topProducts.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет данных по продуктам.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Contracts</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((row, index) => {
                    const name = row.product_name ?? row.course_name ?? `Product ${index + 1}`
                    return (
                      <TableRow key={`${name}-${index}`}>
                        <TableCell>{name}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.contracts_cnt)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.revenue_sum)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.avg_check)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top campaigns by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignsWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины кампаний" description="attr.revenue.top_campaigns_daily не подключена." />
            ) : topCampaigns.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет данных по кампаниям.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Contracts</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCampaigns.map((row, index) => (
                    <TableRow key={`${row.campaign_id ?? index}`}
                    >
                      <TableCell>
                        <div className="font-medium">{row.campaign_name ?? `Campaign ${row.campaign_id}`}</div>
                        {row.platform && (
                          <div className="text-xs text-muted-foreground">{row.platform}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.contracts_cnt)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.revenue_total_cost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.payments_sum)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Meta ads with contracts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {metaAdsWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины Meta" description="attr.revenue.meta_ads_daily не подключена." />
            ) : metaAds.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет данных по Meta ads.</div>
            ) : (
              metaAds.map((row, index) => {
                const title = row.creative_title ?? row.ad_name ?? `Ad ${row.ad_id ?? index + 1}`
                return (
                  <Card key={`${row.ad_id ?? index}`} className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm line-clamp-2">{title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <AttributionPreviewImage
                        src={row.preview_image_url}
                        alt="preview"
                        className="h-28 w-full rounded-md object-cover"
                        fallbackClassName="h-28 w-full"
                      />
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">Contracts {formatNumber(row.contracts)}</Badge>
                        <Badge variant="outline">Revenue {formatCurrency(row.revenue)}</Badge>
                        <Badge variant="outline">Payments {formatCurrency(row.payments)}</Badge>
                      </div>
                      {row.permalink_url && (
                        <Button variant="outline" size="sm" className="gap-2" asChild>
                          <a href={row.permalink_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" /> Open
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GAds campaigns by revenue</CardTitle>
        </CardHeader>
        <CardContent>
          {gadsWidget?.meta?.missing_view ? (
            <WidgetStatus title="Нет витрины GAds" description="attr.revenue.gads_campaigns_daily не подключена." />
          ) : gadsCampaigns.length === 0 && !isLoading ? (
            <div className="text-sm text-muted-foreground">Нет данных по GAds.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Contracts</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gadsCampaigns.map((row, index) => (
                  <TableRow key={`${row.campaign_id ?? index}`}>
                    <TableCell>
                      <div className="font-medium">{row.campaign_name ?? `Campaign ${row.campaign_id}`}</div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(row.contracts_cnt)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.revenue_total_cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.payments_sum)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Attributed contracts</CardTitle>
          {detailRows.length > 10 && (
            <Button variant="outline" size="sm" onClick={() => setShowAllContracts((prev) => !prev)}>
              {showAllContracts ? "Collapse" : "Show all"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {detailWidget?.meta?.missing_view ? (
            <WidgetStatus title="Нет витрины контрактов" description="attr.revenue.attributed_detail не подключена." />
          ) : topContracts.length === 0 && !isLoading ? (
            <div className="text-sm text-muted-foreground">Нет атрибутированных контрактов.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Creative</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topContracts.map((row, index) => (
                  <TableRow key={`${row.contract_id ?? index}`}>
                    <TableCell>
                      <div className="font-medium">#{row.contract_id}</div>
                      <div className="text-xs text-muted-foreground">{row.contract_date_key}</div>
                    </TableCell>
                    <TableCell>{row.attributed_platform ?? "unknown"}</TableCell>
                    <TableCell>
                      {["offline", "unknown", "other"].includes((row.attributed_platform ?? "").toLowerCase()) ? (
                        <div className="text-xs">
                          <div className="font-medium">
                            {row.display_title ?? row.offline_source_type_label ?? "Offline source"}
                          </div>
                          {row.offline_owner_name && (
                            <div className="text-muted-foreground">{row.offline_owner_name}</div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AttributionPreviewImage
                            src={row.preview_image_url}
                            alt="preview"
                            className="h-8 w-8 rounded-md object-cover"
                            fallbackClassName="h-8 w-8"
                          />
                          <div className="text-xs">
                            <div className="line-clamp-1">
                              {row.creative_title ??
                                row.meta_ad_name ??
                                row.gads_campaign_name ??
                                row.display_title ??
                                "Creative"}
                            </div>
                            {row.permalink_url && (
                              <a className="text-primary underline" href={row.permalink_url} target="_blank" rel="noreferrer">
                                Open
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.total_cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.paid_sum)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
