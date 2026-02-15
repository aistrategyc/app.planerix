"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { Separator } from "@/components/ui/separator"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"
import { api } from "@/lib/api/config"
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"

interface CampaignRow {
  campaign_id: string
  campaign_name?: string | null
  platform?: string | null
  spend?: number | null
  clicks?: number | null
  impressions?: number | null
  conversions?: number | null
  ctr?: number | null
  cpc?: number | null
  cpm?: number | null
  cpa?: number | null
}

interface ChannelMixRow {
  date_key: string
  id_city?: number | null
  city_name?: string | null
  channel?: string | null
  leads_cnt?: number | null
  contracts_cnt?: number | null
  contracts_paid?: number | null
  spend?: number | null
  spend_share?: number | null
  contracts_share?: number | null
}

interface SpendContractsRow {
  date_key: string
  id_city?: number | null
  city_name?: string | null
  spend_all?: number | null
  spend_meta?: number | null
  spend_gads?: number | null
  contracts_all?: number | null
  contracts_meta?: number | null
  contracts_gads?: number | null
  contracts_offline?: number | null
}

interface MarketingResponse {
  campaigns: CampaignRow[]
  channel_mix: ChannelMixRow[]
  spend_vs_contracts: SpendContractsRow[]
}

const formatCurrency = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("uk-UA", { style: "currency", currency: "UAH" })

const formatNumber = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("uk-UA"))

const isNumericLabel = (value?: string | null) => Boolean(value && /^\d+$/.test(value.trim()))

const normalizeKey = (value?: string | null) =>
  value ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : ""

const buildEntityLabel = (name?: string | null, id?: string | number | null, fallback = "Item") => {
  if (name && !isNumericLabel(name)) {
    return { title: name, meta: id ? `ID ${id}` : null }
  }
  if (id !== null && id !== undefined) {
    return { title: fallback, meta: `ID ${id}` }
  }
  return { title: fallback, meta: null }
}

const getPlatformMeta = (value?: string | null) => {
  const key = normalizeKey(value)
  if (["meta", "facebook", "fb"].includes(key)) {
    return { label: "Meta", dotClass: "bg-blue-500", hint: "Meta Ads", short: "M" }
  }
  if (["gads", "googleads", "google"].includes(key)) {
    return { label: "Google Ads", dotClass: "bg-amber-500", hint: "Google Ads", short: "G" }
  }
  if (["offline"].includes(key)) {
    return { label: "Offline", dotClass: "bg-slate-400", hint: "Offline", short: "O" }
  }
  if (!value) {
    return { label: "—", dotClass: "bg-slate-300", hint: "Unknown platform", short: "?" }
  }
  return { label: value, dotClass: "bg-slate-400", hint: value, short: value.slice(0, 1).toUpperCase() }
}

const getChannelMeta = (value?: string | null) => {
  const key = normalizeKey(value)
  if (["paid", "ads"].includes(key)) {
    return { label: "Paid", dotClass: "bg-blue-500", hint: "Paid channels", short: "P" }
  }
  if (["organic"].includes(key)) {
    return { label: "Organic", dotClass: "bg-emerald-500", hint: "Organic channels", short: "O" }
  }
  if (["offline"].includes(key)) {
    return { label: "Offline", dotClass: "bg-slate-400", hint: "Offline", short: "O" }
  }
  if (["meta", "facebook", "fb", "gads", "googleads", "google"].includes(key)) {
    return getPlatformMeta(value)
  }
  if (!value) {
    return { label: "—", dotClass: "bg-slate-300", hint: "Unknown channel", short: "?" }
  }
  return { label: value, dotClass: "bg-slate-400", hint: value, short: value.slice(0, 1).toUpperCase() }
}

const renderPlatformBadge = (value?: string | null) => {
  const meta = getPlatformMeta(value)
  return (
    <Badge variant="outline" className="gap-1.5 text-xs font-medium" title={meta.hint}>
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold text-white ${meta.dotClass}`}
        aria-hidden
      >
        {meta.short}
      </span>
      {meta.label}
    </Badge>
  )
}

const renderChannelBadge = (value?: string | null) => {
  const meta = getChannelMeta(value)
  return (
    <Badge variant="outline" className="gap-1.5 text-xs font-medium" title={meta.hint}>
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold text-white ${meta.dotClass}`}
        aria-hidden
      >
        {meta.short}
      </span>
      {meta.label}
    </Badge>
  )
}

const formatPercent = (value: number | null | undefined) => {
  if (value == null) return "—"
  return `${(value * 100).toFixed(1)}%`
}

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const buildDateKey = (value: Date) => value.toISOString().slice(0, 10)

const parseDateParam = (value: string | null) => {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed
}

export default function AdsPlatformPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const today = useMemo(() => new Date(), [])
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersValue>({
    dateRange: {},
    cityId: "all",
    platform: "all",
  })
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFiltersValue>({
    dateRange: {},
    cityId: "all",
    platform: "all",
  })
  const [data, setData] = useState<MarketingResponse>({ campaigns: [], channel_mix: [], spend_vs_contracts: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [showAllCampaigns, setShowAllCampaigns] = useState(false)

  useEffect(() => {
    const nextFilters: AnalyticsFiltersValue = {
      dateRange: {
        from: parseDateParam(searchParams.get("date_from")),
        to: parseDateParam(searchParams.get("date_to")),
      },
      cityId: searchParams.get("id_city") ?? "all",
      platform: searchParams.get("platform") ?? "all",
    }
    setDraftFilters(nextFilters)
    setAppliedFilters(nextFilters)
  }, [searchKey, searchParams])

  const updateQuery = (updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }

  const applyFilters = () => {
    setAppliedFilters(draftFilters)
    updateQuery({
      date_from: draftFilters.dateRange.from ? buildDateKey(draftFilters.dateRange.from) : null,
      date_to: draftFilters.dateRange.to ? buildDateKey(draftFilters.dateRange.to) : null,
      id_city: draftFilters.cityId === "all" ? null : draftFilters.cityId,
      platform: draftFilters.platform === "all" ? null : draftFilters.platform,
    })
  }

  const resetFilters = () => {
    const resetValue: AnalyticsFiltersValue = { dateRange: {}, cityId: "all", platform: "all" }
    setDraftFilters(resetValue)
    setAppliedFilters(resetValue)
    updateQuery({
      date_from: null,
      date_to: null,
      id_city: null,
      platform: null,
    })
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      setIsLoading(true)
      try {
        const params = {
          date_from: appliedFilters.dateRange.from ? buildDateKey(appliedFilters.dateRange.from) : undefined,
          date_to: appliedFilters.dateRange.to ? buildDateKey(appliedFilters.dateRange.to) : undefined,
          city_id: appliedFilters.cityId === "all" ? undefined : Number(appliedFilters.cityId),
          platform: appliedFilters.platform === "all" ? undefined : appliedFilters.platform,
        }
        const response = await api.get<MarketingResponse>("/analytics/marketing/", { params })
        if (!active) return
        setData({
          campaigns: response.data.campaigns ?? [],
          channel_mix: response.data.channel_mix ?? [],
          spend_vs_contracts: response.data.spend_vs_contracts ?? [],
        })
      } catch (error) {
        if (!active) return
        console.error("Failed to load marketing data:", error)
        setData({ campaigns: [], channel_mix: [], spend_vs_contracts: [] })
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [appliedFilters])

  const hasData = data.campaigns.length > 0 || data.channel_mix.length > 0 || data.spend_vs_contracts.length > 0

  const spendTotal = useMemo(
    () => data.spend_vs_contracts.reduce((sum, row) => sum + (toNumber(row.spend_all) ?? 0), 0),
    [data.spend_vs_contracts]
  )
  const contractsTotal = useMemo(
    () => data.spend_vs_contracts.reduce((sum, row) => sum + (toNumber(row.contracts_all) ?? 0), 0),
    [data.spend_vs_contracts]
  )
  const cpaProxy = useMemo(
    () => (contractsTotal > 0 ? spendTotal / contractsTotal : null),
    [contractsTotal, spendTotal]
  )

  const channelSummary = useMemo(() => {
    const bucket = new Map<string, { channel: string; spend: number; contracts: number }>()
    data.channel_mix.forEach((row) => {
      const channelKey = row.channel ?? "other"
      const entry = bucket.get(channelKey) ?? { channel: channelKey, spend: 0, contracts: 0 }
      entry.spend += toNumber(row.spend) ?? 0
      entry.contracts += toNumber(row.contracts_cnt) ?? 0
      bucket.set(channelKey, entry)
    })
    return Array.from(bucket.values()).sort((a, b) => b.spend - a.spend)
  }, [data.channel_mix])

  const trendData = useMemo(() => {
    return data.spend_vs_contracts
      .map((row) => ({
        date: row.date_key,
        spend: toNumber(row.spend_all) ?? 0,
        contracts: toNumber(row.contracts_all) ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data.spend_vs_contracts])

  const campaignRows = useMemo(() => {
    const sorted = [...data.campaigns].sort((a, b) => (toNumber(b.spend) ?? 0) - (toNumber(a.spend) ?? 0))
    return showAllCampaigns ? sorted : sorted.slice(0, 10)
  }, [data.campaigns, showAllCampaigns])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketing Overview"
        description="Канали, кампанії та ключові показники маркетингової активності."
      />

      <AnalyticsFilters
        value={draftFilters}
        onDateChange={(value) => setDraftFilters((prev) => ({ ...prev, dateRange: value }))}
        onCityChange={(value) => setDraftFilters((prev) => ({ ...prev, cityId: value }))}
        onPlatformChange={(value) => setDraftFilters((prev) => ({ ...prev, platform: value }))}
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={isLoading}
        compact
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : hasData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Витрати</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{formatCurrency(spendTotal)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Контракти</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{formatNumber(contractsTotal)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">CPA (proxy)</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {cpaProxy == null ? "—" : formatCurrency(cpaProxy)}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle>Spend vs Contracts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer>
                    <LineChart data={trendData}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="date" {...chartAxisProps} />
                      <YAxis yAxisId="left" {...chartAxisProps} />
                      <YAxis yAxisId="right" orientation="right" {...chartAxisProps} />
                      <Tooltip contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} />
                      <Line type="monotone" dataKey="spend" stroke={CHART_COLORS.primary} yAxisId="left" />
                      <Line type="monotone" dataKey="contracts" stroke={CHART_COLORS.secondary} yAxisId="right" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Channel Mix</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {channelSummary.length === 0 && (
                  <p className="text-sm text-muted-foreground">Немає даних по каналам.</p>
                )}
                {channelSummary.map((row) => (
                  <div key={row.channel} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      {renderChannelBadge(row.channel)}
                      <Badge variant="outline">{formatNumber(row.contracts)}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">Spend: {formatCurrency(row.spend)}</div>
                    {data.channel_mix.find((entry) => entry.channel === row.channel)?.spend_share != null && (
                      <div className="text-xs text-muted-foreground">
                        Share:{" "}
                        {formatPercent(
                          data.channel_mix.find((entry) => entry.channel === row.channel)?.spend_share ?? null
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Campaigns (daily)</CardTitle>
                <p className="text-sm text-muted-foreground">Кампанії з найбільшими витратами.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAllCampaigns((value) => !value)}>
                {showAllCampaigns ? "Згорнути" : "Показати всі"}
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {campaignRows.map((row, index) => (
                <div key={`${row.campaign_id}-${index}`} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    {(() => {
                      const label = buildEntityLabel(row.campaign_name ?? null, row.campaign_id ?? null, "Campaign")
                      return (
                        <div>
                          <div className="font-semibold truncate">{label.title}</div>
                        </div>
                      )
                    })()}
                    {renderPlatformBadge(row.platform)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.ctr != null && (
                      <Badge variant="secondary" className="text-[11px] font-medium">
                        CTR {(row.ctr * 100).toFixed(1)}%
                      </Badge>
                    )}
                    {row.cpa != null && (
                      <Badge variant="secondary" className="text-[11px] font-medium">
                        CPA {formatCurrency(row.cpa)}
                      </Badge>
                    )}
                    {row.cpm != null && (
                      <Badge variant="secondary" className="text-[11px] font-medium">
                        CPM {formatCurrency(row.cpm)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Витрати</div>
                      <div className="font-medium">{formatCurrency(row.spend)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Конверсії</div>
                      <div className="font-medium">{formatNumber(row.conversions)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground" title="Cost per click">CPC</div>
                      <div className="font-medium">{formatCurrency(row.cpc)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Кліки</div>
                      <div className="font-medium">{formatNumber(row.clicks)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {!isLoading && data.campaigns.length === 0 && (
                <div className="text-sm text-muted-foreground">Немає даних по кампаніям.</div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <AnalyticsEmptyState
          title="Немає маркетингових даних"
          description="Підключіть канали або дочекайтесь оновлення витрин SEM."
          context="marketing"
          size="sm"
        />
      )}

      <Separator />
      {!isLoading && !hasData && <p className="text-xs text-muted-foreground">Останнє оновлення: {buildDateKey(today)}</p>}
    </div>
  )
}
