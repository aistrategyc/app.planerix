"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

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
import { PageHeader } from "@/components/layout/PageHeader"

const WIDGET_KEYS = {
  creatives: "attr.content.creatives_table",
  typeCards: "attr.content.type_cards",
  fatigue: "attr.content.fatigue_7d",
  contracts: "attr.content.contract_creatives",
  anomalies: "attr.content.anomalies_7d",
}

type CreativeRow = {
  date_key?: string | null
  platform?: string | null
  creative_key?: string | null
  creative_title?: string | null
  ad_name?: string | null
  campaign_name?: string | null
  adset_name?: string | null
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  conversions?: number | null
  preview_image_url?: string | null
  thumbnail_url?: string | null
  media_image_src?: string | null
  permalink_url?: string | null
  link_url?: string | null
  object_type?: string | null
}

type TypeCardRow = {
  type?: string | null
  spend?: number | null
  leads?: number | null
  ctr?: number | null
  cpl?: number | null
}

type FatigueRow = {
  creative_id?: string | number | null
  creative_title?: string | null
  creative_name?: string | null
  ctr_7d?: number | null
  ctr_prev7d?: number | null
  ctr_delta?: number | null
  fatigue_flags?: number | null
}

type ContractCreativeRow = {
  ad_id?: string | number | null
  creative_title?: string | null
  preview_image_url?: string | null
  permalink_url?: string | null
  contracts_cnt?: number | null
  revenue_total_cost?: number | null
}

type AnomalyRow = {
  platform?: string | null
  ad_id?: string | number | null
  ad_name?: string | null
  creative_title?: string | null
  preview_image_url?: string | null
  spend_7d?: number | null
  spend_prev7d?: number | null
  spend_delta_pct?: number | null
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

const resolveTitle = (row: CreativeRow, fallbackId: string | number) =>
  row.creative_title ?? row.ad_name ?? row.campaign_name ?? `Creative ${fallbackId}`

const normalizeFormatLabel = (value?: string | null) => {
  const raw = (value ?? "other").toString().trim()
  if (!raw) return "OTHER"
  if (raw.toLowerCase().includes("video")) return "VIDEO"
  if (raw.toLowerCase().includes("image")) return "IMAGE"
  if (raw.toLowerCase().includes("carousel")) return "CAROUSEL"
  if (raw.toLowerCase().includes("responsive")) return "RESPONSIVE"
  return raw.toUpperCase()
}

export default function AttributionContentClient() {
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
  const [showAllCreatives, setShowAllCreatives] = useState(false)

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
        console.error("Failed to load attribution content widgets", error)
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

  const creativesWidget = data.widgets[WIDGET_KEYS.creatives] as
    | { data: { current: CreativeRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const typeWidget = data.widgets[WIDGET_KEYS.typeCards] as
    | { data: { current: TypeCardRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const fatigueWidget = data.widgets[WIDGET_KEYS.fatigue] as
    | { data: { current: FatigueRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const contractsWidget = data.widgets[WIDGET_KEYS.contracts] as
    | { data: { current: ContractCreativeRow[] }; meta: { missing_view?: boolean } }
    | undefined
  const anomaliesWidget = data.widgets[WIDGET_KEYS.anomalies] as
    | { data: { current: AnomalyRow[] }; meta: { missing_view?: boolean } }
    | undefined

  const creativeRows = creativesWidget?.data?.current ?? []
  const typeRows = typeWidget?.data?.current ?? []
  const fatigueRows = fatigueWidget?.data?.current ?? []
  const contractRows = contractsWidget?.data?.current ?? []
  const anomalyRows = anomaliesWidget?.data?.current ?? []

  const totalSpend = creativeRows.reduce((acc, row) => acc + (toNumber(row.spend) ?? 0), 0)
  const totalClicks = creativeRows.reduce((acc, row) => acc + (toNumber(row.clicks) ?? 0), 0)
  const totalImpr = creativeRows.reduce((acc, row) => acc + (toNumber(row.impressions) ?? 0), 0)
  const totalLeads = creativeRows.reduce((acc, row) => acc + (toNumber(row.conversions) ?? 0), 0)
  const ctr = totalImpr > 0 ? totalClicks / totalImpr : null
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : null
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : null

  const topCreatives = creativeRows
    .slice()
    .sort((a, b) => (toNumber(b.spend) ?? 0) - (toNumber(a.spend) ?? 0))

  const topContracts = contractRows
    .slice()
    .sort((a, b) => (toNumber(b.contracts_cnt) ?? 0) - (toNumber(a.contracts_cnt) ?? 0))
    .slice(0, 6)

  const fatigueHighlights = fatigueRows
    .slice()
    .sort((a, b) => (toNumber(b.ctr_delta) ?? 0) - (toNumber(a.ctr_delta) ?? 0))
    .slice(0, 6)

  const anomalyHighlights = anomalyRows.slice(0, 8)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attribution · Content"
        description="Креативы, форматы и сигналы выгорания по выбранным фильтрам."
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
            <CardTitle className="text-sm text-muted-foreground">Spend</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-20" /> : formatCurrency(totalSpend)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Leads</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-20" /> : formatNumber(totalLeads)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">CTR</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {isLoading ? <Skeleton className="h-8 w-20" /> : formatPercent(ctr, 1)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">CPL / CPC</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <div>{formatCurrency(cpl)}</div>
                <div className="text-xs text-muted-foreground">CPC {formatCurrency(cpc)}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Creative type mix</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {typeWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины типов" description="attr.content.type_cards не подключена." />
            ) : typeRows.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет данных по типам.</div>
            ) : (
              typeRows.slice(0, 6).map((row, index) => (
                <Card key={`${row.type ?? index}`} className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm uppercase">{normalizeFormatLabel(row.type)}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Spend</span>
                      <span>{formatCurrency(row.spend)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Leads</span>
                      <span>{formatNumber(row.leads)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>CTR</span>
                      <span>{formatPercent(row.ctr, 1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>CPL</span>
                      <span>{formatCurrency(row.cpl)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Creative fatigue 7d</CardTitle>
          </CardHeader>
          <CardContent>
            {fatigueWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины выгорания" description="attr.content.fatigue_7d не подключена." />
            ) : fatigueHighlights.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет данных по выгоранию.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creative</TableHead>
                    <TableHead className="text-right">CTR 7d</TableHead>
                    <TableHead className="text-right">CTR prev</TableHead>
                    <TableHead className="text-right">Δ CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fatigueHighlights.map((row, index) => (
                    <TableRow key={`${row.creative_id ?? index}`}>
                      <TableCell>
                        <div className="line-clamp-2">{row.creative_title ?? row.creative_name ?? `Creative ${index + 1}`}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatPercent(row.ctr_7d, 1)}</TableCell>
                      <TableCell className="text-right">{formatPercent(row.ctr_prev7d, 1)}</TableCell>
                      <TableCell className="text-right">{formatPercent(row.ctr_delta, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Creative performance</CardTitle>
          {topCreatives.length > 8 && (
            <Button variant="outline" size="sm" onClick={() => setShowAllCreatives((prev) => !prev)}>
              {showAllCreatives ? "Collapse" : "Show all"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {creativesWidget?.meta?.missing_view ? (
            <WidgetStatus title="Нет витрины креативов" description="attr.content.creatives_table не подключена." />
          ) : topCreatives.length === 0 && !isLoading ? (
            <div className="text-sm text-muted-foreground">Нет данных по креативам.</div>
          ) : (
            (showAllCreatives ? topCreatives : topCreatives.slice(0, 8)).map((row, index) => {
              const idLabel = row.creative_key ?? row.ad_name ?? row.campaign_name ?? index + 1
              const title = resolveTitle(row, idLabel)
              const previewUrl =
                row.preview_image_url ?? row.thumbnail_url ?? row.media_image_src ?? null
              const spend = toNumber(row.spend) ?? 0
              const clicks = toNumber(row.clicks) ?? 0
              const impressions = toNumber(row.impressions) ?? 0
              const leads = toNumber(row.conversions) ?? 0
              const ctr = impressions > 0 ? clicks / impressions : null
              const cpl = leads > 0 ? spend / leads : null
              return (
                <Card key={`${row.creative_key ?? index}`} className="border-border">
                  <CardHeader className="space-y-1 pb-2">
                    <CardTitle className="text-base line-clamp-2">{title}</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {row.campaign_name ?? row.ad_name ?? ""}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.platform && (
                        <Badge variant="outline" className="text-xs">
                          {row.platform}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {normalizeFormatLabel(row.object_type)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <AttributionPreviewImage
                      src={previewUrl}
                      alt="preview"
                      className="h-28 w-full rounded-md object-cover"
                      fallbackClassName="h-28 w-full"
                    />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Spend</div>
                        <div className="font-medium">{formatCurrency(spend)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Leads</div>
                        <div className="font-medium">{formatNumber(leads)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">CTR</div>
                        <div className="font-medium">{formatPercent(ctr, 1)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">CPL</div>
                        <div className="font-medium">{formatCurrency(cpl)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Creatives with contracts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {contractsWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины контрактов" description="attr.content.contract_creatives не подключена." />
            ) : topContracts.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет контрактов по креативам.</div>
            ) : (
              topContracts.map((row, index) => (
                <Card key={`${row.ad_id ?? index}`} className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm line-clamp-2">
                      {row.creative_title ?? `Creative ${row.ad_id ?? index + 1}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <AttributionPreviewImage
                      src={row.preview_image_url}
                      alt="preview"
                      className="h-24 w-full rounded-md object-cover"
                      fallbackClassName="h-24 w-full"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span>Contracts</span>
                      <span className="font-medium">{formatNumber(row.contracts_cnt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Revenue</span>
                      <span className="font-medium">{formatCurrency(row.revenue_total_cost)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Creative anomalies 7d</CardTitle>
          </CardHeader>
          <CardContent>
            {anomaliesWidget?.meta?.missing_view ? (
              <WidgetStatus title="Нет витрины аномалий" description="attr.content.anomalies_7d не подключена." />
            ) : anomalyHighlights.length === 0 && !isLoading ? (
              <div className="text-sm text-muted-foreground">Нет аномалий за период.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
                    <TableHead className="text-right">Spend 7d</TableHead>
                    <TableHead className="text-right">Δ Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalyHighlights.map((row, index) => (
                    <TableRow key={`${row.ad_id ?? index}`}>
                      <TableCell>
                        <div className="font-medium">{row.ad_name ?? row.creative_title ?? `Ad ${row.ad_id}`}</div>
                        <div className="text-xs text-muted-foreground">{row.platform ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.spend_7d)}</TableCell>
                      <TableCell className="text-right">{formatPercent(row.spend_delta_pct, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
