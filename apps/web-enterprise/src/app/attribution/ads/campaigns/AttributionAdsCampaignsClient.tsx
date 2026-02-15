"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { ExternalLink } from "lucide-react"

import { AttributionFilterBar } from "@/app/attribution/components/AttributionFilterBar"
import { useAttributionFilters } from "@/app/attribution/hooks/useAttributionFilters"
import { buildDateKey } from "@/app/attribution/utils/filters"
import { buildLastWeekRange, resolveDefaultCityId } from "@/app/analytics/utils/defaults"
import { formatCurrency, formatNumber, formatPercent } from "@/app/analytics/utils/formatters"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { fetchAttributionWidgets } from "@/lib/api/attribution"
import { fetchWidgetRange } from "@/lib/api/analytics-widgets"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WidgetStatus } from "@/app/analytics/components/WidgetStatus"
import { AttributionPreviewImage } from "@/app/attribution/components/AttributionPreviewImage"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"

const WIDGET_KEYS = {
  kpi: "attr.ads.campaigns.kpi",
  table: "attr.ads.campaigns.table",
  creatives: "attr.ads.campaigns.drawer_creatives",
  timeseries: "attr.ads.campaigns.ts",
}

type CampaignKpiRow = {
  active_campaigns_cnt?: number | null
  spend?: number | null
  clicks?: number | null
  impressions?: number | null
  ctr?: number | null
  cpc?: number | null
  cpm?: number | null
  platform_leads?: number | null
  crm_requests_cnt?: number | null
  contracts_cnt?: number | null
  paid_sum?: number | null
  roas_crm?: number | null
  cpa_contract?: number | null
  cpp_paid?: number | null
}

type CampaignRow = {
  date_key?: string | null
  platform?: string | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  campaign_status?: string | null
  status?: string | null
  objective?: string | null
  spend?: number | null
  clicks?: number | null
  impressions?: number | null
  ctr?: number | null
  cpc?: number | null
  cpm?: number | null
  platform_leads?: number | null
  crm_requests_cnt?: number | null
  contracts_cnt?: number | null
  paid_sum?: number | null
  roas_crm?: number | null
  cpa_contract?: number | null
  cpl?: number | null
  last_activity_date?: string | null
}

type CampaignCreativeRow = {
  date_key?: string | null
  platform?: string | null
  ad_id?: string | number | null
  ad_display_name?: string | null
  ad_name?: string | null
  permalink_url?: string | null
  preview_image_url?: string | null
  post_message?: string | null
  impressions?: number | null
  spend?: number | null
  clicks?: number | null
  platform_leads?: number | null
  crm_requests_cnt?: number | null
  contracts_cnt?: number | null
  paid_sum?: number | null
  roas_crm?: number | null
  cpl?: number | null
  cpa_contract?: number | null
}

type CampaignTimeseriesRow = {
  date_key?: string | null
  spend?: number | null
  paid_sum?: number | null
}

type WidgetPayload<T> = {
  data: { current: T[]; compare?: T[] }
  meta: { missing_view?: boolean; error?: string }
}

type CampaignLocalFilters = {
  status: string
  objective: string
  campaignId: string
  adsetId: string
  adGroupId: string
}

const DEFAULT_LOCAL_FILTERS: CampaignLocalFilters = {
  status: "all",
  objective: "",
  campaignId: "",
  adsetId: "",
  adGroupId: "",
}

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const sumValue = (value: number | null | undefined, delta: number) => (value ?? 0) + delta

const ratioValue = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : null

const pickLatestDate = (current?: string | null, next?: string | null) => {
  if (!next) return current ?? null
  if (!current) return next
  return next > current ? next : current
}

const resolveStatus = (row: Partial<CampaignRow>) => row.campaign_status ?? row.status ?? "unknown"

const renderPlatformBadge = (platform?: string | null) => {
  const label = platform ?? "unknown"
  const tone = label.toLowerCase().includes("meta")
    ? "border-blue-200 text-blue-700"
    : label.toLowerCase().includes("gad")
      ? "border-emerald-200 text-emerald-700"
      : "border-slate-200 text-slate-600"
  return (
    <Badge variant="outline" className={tone}>
      {label}
    </Badge>
  )
}

const renderStatusBadge = (status?: string | null) => {
  const normalized = (status ?? "unknown").toLowerCase()
  const isActive = normalized === "active" || normalized === "enabled"
  return (
    <Badge variant="outline" className={isActive ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-600"}>
      {status ?? "unknown"}
    </Badge>
  )
}

const buildAdsLibraryUrl = (adId?: string | number | null) =>
  adId ? `https://www.facebook.com/ads/library/?id=${adId}` : null

export default function AttributionAdsCampaignsClient() {
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
  const [localDraft, setLocalDraft] = useState<CampaignLocalFilters>(DEFAULT_LOCAL_FILTERS)
  const [localApplied, setLocalApplied] = useState<CampaignLocalFilters>(DEFAULT_LOCAL_FILTERS)
  const [data, setData] = useState<Record<string, WidgetPayload<any>>>({})
  const [drawerData, setDrawerData] = useState<Record<string, WidgetPayload<any>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerLoading, setIsDrawerLoading] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null)

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

  useEffect(() => {
    const nextLocal: CampaignLocalFilters = {
      status: searchParams.get("status") ?? "all",
      objective: searchParams.get("objective") ?? "",
      campaignId: searchParams.get("campaign_id") ?? "",
      adsetId: searchParams.get("adset_id") ?? "",
      adGroupId: searchParams.get("ad_group_id") ?? "",
    }
    setLocalDraft(nextLocal)
    setLocalApplied(nextLocal)
  }, [searchKey])

  const handleApply = () => {
    setLocalApplied(localDraft)
    applyFilters({
      status: localDraft.status === "all" ? null : localDraft.status,
      objective: localDraft.objective || null,
      campaign_id: localDraft.campaignId || null,
      adset_id: localDraft.adsetId || null,
      ad_group_id: localDraft.adGroupId || null,
    })
  }

  const handleReset = () => {
    setLocalDraft(DEFAULT_LOCAL_FILTERS)
    setLocalApplied(DEFAULT_LOCAL_FILTERS)
    resetFilters({
      status: null,
      objective: null,
      campaign_id: null,
      adset_id: null,
      ad_group_id: null,
    })
  }

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
    if (localApplied.status !== "all") {
      params.status = localApplied.status
    }
    if (localApplied.objective) {
      params.objective = localApplied.objective
    }
    if (localApplied.campaignId) {
      params.campaign_id = localApplied.campaignId
    }
    if (localApplied.adsetId) {
      params.adset_id = localApplied.adsetId
    }
    if (localApplied.adGroupId) {
      params.ad_group_id = localApplied.adGroupId
    }
    return params
  }, [appliedFilters, localApplied])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch) return
      setIsLoading(true)
      try {
        const response = await fetchAttributionWidgets({
          widgetKeys: [WIDGET_KEYS.kpi, WIDGET_KEYS.table],
          filters: requestParams,
        })
        if (!active) return
        setData(response.widgets ?? {})
      } catch (error) {
        if (!active) return
        console.error("Failed to load attribution campaigns", error)
        setData({})
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [canFetch, requestParams])

  useEffect(() => {
    if (!selectedCampaign) return
    let active = true
    const loadDrawer = async () => {
      setIsDrawerLoading(true)
      setDrawerData({})
      try {
        const response = await fetchAttributionWidgets({
          widgetKeys: [WIDGET_KEYS.creatives, WIDGET_KEYS.timeseries],
          filters: {
            ...requestParams,
            campaign_id: selectedCampaign.campaign_id ? String(selectedCampaign.campaign_id) : undefined,
          },
        })
        if (!active) return
        setDrawerData(response.widgets ?? {})
      } catch (error) {
        if (!active) return
        console.error("Failed to load campaign drawer", error)
        setDrawerData({})
      } finally {
        if (active) setIsDrawerLoading(false)
      }
    }
    loadDrawer()
    return () => {
      active = false
    }
  }, [requestParams, selectedCampaign])

  const kpiWidget = data[WIDGET_KEYS.kpi] as WidgetPayload<CampaignKpiRow> | undefined
  const tableWidget = data[WIDGET_KEYS.table] as WidgetPayload<CampaignRow> | undefined

  const rawTableRows = tableWidget?.data?.current ?? []
  const aggregatedTableRows = useMemo(() => {
    const map = new Map<string, CampaignRow>()
    rawTableRows.forEach((row) => {
      const key = `${row.platform ?? "unknown"}::${row.campaign_id ?? row.campaign_name ?? "unknown"}`
      const existing = map.get(key)
      const spend = toNumber(row.spend) ?? 0
      const clicks = toNumber(row.clicks) ?? 0
      const impressions = toNumber(row.impressions) ?? 0
      const platformLeads = toNumber(row.platform_leads) ?? 0
      const crmRequests = toNumber(row.crm_requests_cnt) ?? 0
      const contracts = toNumber(row.contracts_cnt) ?? 0
      const paidSum = toNumber(row.paid_sum) ?? 0

      const next: CampaignRow = existing ?? {
        platform: row.platform,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name ?? null,
        campaign_status: row.campaign_status ?? null,
        status: row.status ?? null,
        objective: row.objective ?? null,
        spend: 0,
        clicks: 0,
        impressions: 0,
        platform_leads: 0,
        crm_requests_cnt: 0,
        contracts_cnt: 0,
        paid_sum: 0,
        last_activity_date: row.date_key ?? null,
      }

      next.spend = sumValue(next.spend, spend)
      next.clicks = sumValue(next.clicks, clicks)
      next.impressions = sumValue(next.impressions, impressions)
      next.platform_leads = sumValue(next.platform_leads, platformLeads)
      next.crm_requests_cnt = sumValue(next.crm_requests_cnt, crmRequests)
      next.contracts_cnt = sumValue(next.contracts_cnt, contracts)
      next.paid_sum = sumValue(next.paid_sum, paidSum)
      next.campaign_name = next.campaign_name ?? row.campaign_name ?? null
      next.campaign_status = next.campaign_status ?? row.campaign_status ?? null
      next.status = next.status ?? row.status ?? null
      next.objective = next.objective ?? row.objective ?? null
      next.last_activity_date = pickLatestDate(next.last_activity_date, row.date_key)
      map.set(key, next)
    })

    return Array.from(map.values()).map((row) => {
      const spend = toNumber(row.spend) ?? 0
      const clicks = toNumber(row.clicks) ?? 0
      const impressions = toNumber(row.impressions) ?? 0
      const leads = toNumber(row.platform_leads) ?? 0
      const contracts = toNumber(row.contracts_cnt) ?? 0
      const paidSum = toNumber(row.paid_sum) ?? 0
      return {
        ...row,
        ctr: ratioValue(clicks, impressions),
        cpc: ratioValue(spend, clicks),
        cpm: ratioValue(spend * 1000, impressions),
        cpl: ratioValue(spend, leads),
        cpa_contract: ratioValue(spend, contracts),
        roas_crm: ratioValue(paidSum, spend),
      }
    })
  }, [rawTableRows])

  const kpiRow = useMemo(() => {
    if (!aggregatedTableRows.length) {
      return kpiWidget?.data?.current?.[0]
    }
    const totals = aggregatedTableRows.reduce(
      (acc, row) => {
        acc.spend += toNumber(row.spend) ?? 0
        acc.clicks += toNumber(row.clicks) ?? 0
        acc.impressions += toNumber(row.impressions) ?? 0
        acc.platform_leads += toNumber(row.platform_leads) ?? 0
        acc.crm_requests_cnt += toNumber(row.crm_requests_cnt) ?? 0
        acc.contracts_cnt += toNumber(row.contracts_cnt) ?? 0
        acc.paid_sum += toNumber(row.paid_sum) ?? 0
        return acc
      },
      {
        spend: 0,
        clicks: 0,
        impressions: 0,
        platform_leads: 0,
        crm_requests_cnt: 0,
        contracts_cnt: 0,
        paid_sum: 0,
      }
    )
    return {
      active_campaigns_cnt: aggregatedTableRows.length,
      spend: totals.spend,
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: ratioValue(totals.clicks, totals.impressions),
      cpc: ratioValue(totals.spend, totals.clicks),
      cpm: ratioValue(totals.spend * 1000, totals.impressions),
      platform_leads: totals.platform_leads,
      crm_requests_cnt: totals.crm_requests_cnt,
      contracts_cnt: totals.contracts_cnt,
      paid_sum: totals.paid_sum,
      roas_crm: ratioValue(totals.paid_sum, totals.spend),
      cpa_contract: ratioValue(totals.spend, totals.contracts_cnt),
      cpp_paid: ratioValue(totals.spend, totals.paid_sum),
    }
  }, [aggregatedTableRows, kpiWidget?.data?.current])

  const tableRows = aggregatedTableRows

  const creativesWidget = drawerData[WIDGET_KEYS.creatives] as WidgetPayload<CampaignCreativeRow> | undefined
  const timeseriesWidget = drawerData[WIDGET_KEYS.timeseries] as WidgetPayload<CampaignTimeseriesRow> | undefined

  const creativeRows = creativesWidget?.data?.current ?? []
  const timeseriesRows = timeseriesWidget?.data?.current ?? []

  const aggregatedCreativeRows = useMemo(() => {
    const map = new Map<string, CampaignCreativeRow>()
    creativeRows.forEach((row) => {
      const key = `${row.platform ?? "unknown"}::${row.ad_id ?? row.ad_display_name ?? row.ad_name ?? "unknown"}`
      const existing = map.get(key)
      const spend = toNumber(row.spend) ?? 0
      const clicks = toNumber(row.clicks) ?? 0
      const impressions = toNumber(row.impressions) ?? 0
      const platformLeads = toNumber(row.platform_leads) ?? 0
      const crmRequests = toNumber(row.crm_requests_cnt) ?? 0
      const contracts = toNumber(row.contracts_cnt) ?? 0
      const paidSum = toNumber(row.paid_sum) ?? 0

      const next: CampaignCreativeRow = existing ?? {
        platform: row.platform,
        ad_id: row.ad_id,
        ad_display_name: row.ad_display_name ?? null,
        ad_name: row.ad_name ?? null,
        permalink_url: row.permalink_url ?? null,
        preview_image_url: row.preview_image_url ?? null,
        post_message: row.post_message ?? null,
        impressions: 0,
        spend: 0,
        clicks: 0,
        platform_leads: 0,
        crm_requests_cnt: 0,
        contracts_cnt: 0,
        paid_sum: 0,
      }

      next.spend = sumValue(next.spend, spend)
      next.clicks = sumValue(next.clicks, clicks)
      next.impressions = sumValue(next.impressions, impressions)
      next.platform_leads = sumValue(next.platform_leads, platformLeads)
      next.crm_requests_cnt = sumValue(next.crm_requests_cnt, crmRequests)
      next.contracts_cnt = sumValue(next.contracts_cnt, contracts)
      next.paid_sum = sumValue(next.paid_sum, paidSum)
      next.ad_display_name = next.ad_display_name ?? row.ad_display_name ?? null
      next.ad_name = next.ad_name ?? row.ad_name ?? null
      next.permalink_url = next.permalink_url ?? row.permalink_url ?? null
      next.preview_image_url = next.preview_image_url ?? row.preview_image_url ?? null
      next.post_message = next.post_message ?? row.post_message ?? null
      map.set(key, next)
    })

    return Array.from(map.values()).map((row) => {
      const spend = toNumber(row.spend) ?? 0
      const contracts = toNumber(row.contracts_cnt) ?? 0
      const leads = toNumber(row.platform_leads) ?? 0
      const paidSum = toNumber(row.paid_sum) ?? 0
      return {
        ...row,
        roas_crm: ratioValue(paidSum, spend),
        cpl: ratioValue(spend, leads),
        cpa_contract: ratioValue(spend, contracts),
      }
    })
  }, [creativeRows])

  const topCreatives = aggregatedCreativeRows
    .slice()
    .sort((a, b) => (toNumber(b.spend) ?? 0) - (toNumber(a.spend) ?? 0))
    .slice(0, 6)

  const timeseriesData = useMemo(() => {
    const map = new Map<string, { date: string; spend: number; paid_sum: number }>()
    timeseriesRows.forEach((row) => {
      const date = row.date_key ? String(row.date_key) : ""
      if (!date) return
      const existing = map.get(date) ?? { date, spend: 0, paid_sum: 0 }
      existing.spend += toNumber(row.spend) ?? 0
      existing.paid_sum += toNumber(row.paid_sum) ?? 0
      map.set(date, existing)
    })
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [timeseriesRows])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attribution · Ads Campaigns"
        description="KPI по кампаниям, креативам и динамике затрат."
      />
      <AttributionFilterBar
        value={draftFilters}
        onChange={(next) => setDraftFilters((prev) => ({ ...prev, ...next }))}
        onApply={handleApply}
        onReset={handleReset}
        isLoading={isLoading}
      />

      <Card>
        <CardContent className="flex flex-wrap gap-3 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select value={localDraft.status} onValueChange={(value) => setLocalDraft((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Objective</span>
            <Input
              value={localDraft.objective}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, objective: event.target.value }))}
              placeholder="Objective"
              className="h-8 w-[180px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Campaign ID</span>
            <Input
              value={localDraft.campaignId}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, campaignId: event.target.value }))}
              placeholder="123456"
              className="h-8 w-[160px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Adset ID</span>
            <Input
              value={localDraft.adsetId}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, adsetId: event.target.value }))}
              placeholder="123456"
              className="h-8 w-[160px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ad group ID</span>
            <Input
              value={localDraft.adGroupId}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, adGroupId: event.target.value }))}
              placeholder="123456"
              className="h-8 w-[160px]"
            />
          </div>
        </CardContent>
      </Card>

      {kpiWidget?.meta?.missing_view && (
        <WidgetStatus
          title="KPI view missing"
          description="Register attr.ads.campaigns.kpi in core and create the SEM view."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(6)].map((_, index) => <Skeleton key={index} className="h-[110px]" />)
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active campaigns</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatNumber(kpiRow?.active_campaigns_cnt)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Spend</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatCurrency(kpiRow?.spend)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Clicks / CTR</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatNumber(kpiRow?.clicks)}</div>
                <div className="text-xs text-muted-foreground">
                  CTR {formatPercent(kpiRow?.ctr)} / CPC {formatCurrency(kpiRow?.cpc)} / CPM {formatCurrency(kpiRow?.cpm)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Platform Leads</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatNumber(kpiRow?.platform_leads)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Contracts / Paid sum</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatNumber(kpiRow?.contracts_cnt)}</div>
                <div className="text-xs text-muted-foreground">Paid {formatCurrency(kpiRow?.paid_sum)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">ROAS / CPA / CPP</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatNumber(kpiRow?.roas_crm)}</div>
                <div className="text-xs text-muted-foreground">
                  CPA {formatCurrency(kpiRow?.cpa_contract)} / CPP {formatCurrency(kpiRow?.cpp_paid)}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {tableWidget?.meta?.missing_view ? (
            <WidgetStatus
              title="Campaigns view missing"
              description="Register attr.ads.campaigns.table in core and create the SEM view."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">Platform Leads</TableHead>
                  <TableHead className="text-right">Contracts</TableHead>
                  <TableHead className="text-right">Paid sum</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center text-sm text-muted-foreground">
                      No campaigns for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.map((row, index) => {
                    const campaignLabel = row.campaign_name ?? `Campaign ${row.campaign_id ?? index + 1}`
                    return (
                      <TableRow key={`${row.campaign_id ?? campaignLabel}-${index}`} className="hover:bg-muted/40">
                        <TableCell>{renderPlatformBadge(row.platform)}</TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="px-0 text-left"
                            onClick={() => setSelectedCampaign(row)}
                          >
                            {campaignLabel}
                          </Button>
                        </TableCell>
                        <TableCell>{renderStatusBadge(resolveStatus(row))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.spend)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.clicks)}</TableCell>
                        <TableCell className="text-right">{formatPercent(row.ctr)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.cpc)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.cpm)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.platform_leads)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.contracts_cnt)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.paid_sum)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.roas_crm)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.cpa_contract)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.cpl)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {row.last_activity_date ?? "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedCampaign)} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <DialogContent className="left-auto right-0 top-0 h-full w-full max-w-2xl translate-x-0 translate-y-0 rounded-none overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle>{selectedCampaign?.campaign_name ?? "Campaign"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {renderPlatformBadge(selectedCampaign?.platform)}
              {renderStatusBadge(resolveStatus(selectedCampaign ?? {}))}
              {selectedCampaign?.campaign_id && (
                <Badge variant="outline">ID {selectedCampaign.campaign_id}</Badge>
              )}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Spend vs Paid sum</CardTitle>
              </CardHeader>
              <CardContent>
                {timeseriesWidget?.meta?.missing_view ? (
                  <WidgetStatus
                    title="Timeseries view missing"
                    description="Register attr.ads.campaigns.ts in core and create the SEM view."
                  />
                ) : (
                  <div className="h-[220px]">
                    <SafeResponsiveContainer>
                      <ComposedChart data={timeseriesData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="campaignSpendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.45} />
                            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid {...chartGridProps} vertical={false} />
                        <XAxis dataKey="date" {...chartAxisProps} />
                        <YAxis tickFormatter={(value) => formatNumber(value)} {...chartAxisProps} />
	                        <Tooltip
	                          contentStyle={chartTooltipStyle}
	                          itemStyle={chartTooltipItemStyle}
	                          formatter={(value, name) => {
	                            const label = String(name)
	                            if (value === null || value === undefined) return ["—", label]
	                            const numeric = typeof value === "number" ? value : Number(value)
	                            if (label === "spend") return [formatCurrency(numeric), "Spend"]
	                            if (label === "paid_sum") return [formatCurrency(numeric), "Paid sum"]
	                            return [formatNumber(numeric), label]
	                          }}
	                        />
                        <Area type="monotone" dataKey="spend" stroke={CHART_COLORS.primary} fill="url(#campaignSpendFill)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="paid_sum" stroke={CHART_COLORS.tertiary} strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </SafeResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top creatives / ads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {creativesWidget?.meta?.missing_view ? (
                  <WidgetStatus
                    title="Creatives view missing"
                    description="Register attr.ads.campaigns.drawer_creatives in core and create the SEM view."
                  />
                ) : isDrawerLoading ? (
                  <Skeleton className="h-[120px]" />
                ) : (
                  topCreatives.map((row, index) => {
                    const adLabel = row.ad_display_name ?? row.ad_name ?? `Ad ${row.ad_id ?? index + 1}`
                    const libraryUrl = buildAdsLibraryUrl(row.ad_id)
                    return (
                      <div key={`${row.ad_id ?? adLabel}-${index}`} className="flex gap-4 rounded-lg border p-3">
                        <div className="h-[84px] w-[120px] rounded-md bg-muted flex items-center justify-center overflow-hidden">
                          <AttributionPreviewImage
                            src={row.preview_image_url}
                            alt={adLabel}
                            className="h-full w-full object-cover"
                            fallbackClassName="h-full w-full rounded-md"
                          />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-sm">{adLabel}</div>
                              <div className="text-xs text-muted-foreground">Spend {formatCurrency(row.spend)}</div>
                            </div>
                            {(row.permalink_url || libraryUrl) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(row.permalink_url ?? libraryUrl ?? "", "_blank")}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Open
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline">Leads {formatNumber(row.platform_leads)}</Badge>
                            <Badge variant="outline">Contracts {formatNumber(row.contracts_cnt)}</Badge>
                            <Badge variant="outline">Paid {formatCurrency(row.paid_sum)}</Badge>
                            <Badge variant="outline">ROAS {formatNumber(row.roas_crm)}</Badge>
                            <Badge variant="outline">CPL {formatCurrency(row.cpl)}</Badge>
                            <Badge variant="outline">CPA {formatCurrency(row.cpa_contract)}</Badge>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
