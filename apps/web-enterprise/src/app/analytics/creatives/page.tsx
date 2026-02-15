"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { fetchWidgetRange, fetchWidgetsBatch, WidgetRow } from "@/lib/api/analytics-widgets"
import { InsightsPanel } from "@/app/analytics/components/InsightsPanel"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { useAuth } from "@/contexts/auth-context"
import { PageHeader } from "@/components/layout/PageHeader"

const toDateInput = (value: Date) => value.toISOString().slice(0, 10)

const formatNumber = (value: number | null | undefined) =>
  value == null || Number.isNaN(value) ? "n/a" : value.toLocaleString("uk-UA")

const formatCurrency = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? "n/a"
    : value.toLocaleString("uk-UA", { style: "currency", currency: "UAH" })

const formatPercent = (value: number | null | undefined, digits = 2) =>
  value == null || Number.isNaN(value) ? "n/a" : `${(value * 100).toFixed(digits)}%`

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const isPlaceholderTitle = (value?: string | null) => {
  if (!value) return true
  const trimmed = value.trim()
  if (!trimmed) return true
  if (trimmed.includes("{{") || trimmed.includes("}}")) return true
  if (/^[0-9a-f]{8,}$/i.test(trimmed)) return true
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9a-f]{6,}$/i.test(trimmed)) return true
  if (/^(creative|ad)[:#]/i.test(trimmed)) return true
  return false
}

const pickMeaningful = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (!isPlaceholderTitle(value)) return value
  }
  return null
}

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())

const normalizeLabel = (value?: string | null, fallback = "Other") => {
  if (!value) return fallback
  let trimmed = value.trim()
  if (!trimmed) return fallback
  if (trimmed.includes("_")) trimmed = trimmed.replace(/_/g, " ")
  if (trimmed === trimmed.toUpperCase()) trimmed = toTitleCase(trimmed)
  return trimmed
}

const normalizeFormatLabel = (value?: string | null) => {
  const key = (value ?? "").toLowerCase()
  if (!key) return "Other"
  if (key.includes("reel")) return "Reel"
  if (key.includes("video")) return "Video"
  if (key.includes("carousel")) return "Carousel"
  if (key.includes("image") || key.includes("photo")) return "Image"
  if (key.includes("share")) return "Share"
  if (key.includes("lead")) return "Lead Form"
  if (key.includes("responsive_search_ad")) return "Responsive Search Ad"
  if (key.includes("demand_gen")) return "Demand Gen"
  if (key.includes("pmax") || key.includes("performance max")) return "Performance Max"
  if (key.includes("search")) return "Search"
  if (key.includes("unknown")) return "Other"
  return normalizeLabel(value, "Other")
}

const MAX_PREVIEW_URL_LENGTH = 5000
const MAX_DATA_URL_LENGTH = 50000

const sanitizePreviewUrl = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_DATA_URL_LENGTH) return null
  if (trimmed.includes("{{") || trimmed.includes("}}")) return null
  if (trimmed.startsWith("data:image")) {
    return trimmed.length <= MAX_DATA_URL_LENGTH ? trimmed : null
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.length > MAX_PREVIEW_URL_LENGTH) return null
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
      return parsed.toString()
    } catch {
      return null
    }
  }
  return null
}

const resolvePlatformLabel = (value?: string | null) => {
  const key = (value ?? "").toLowerCase()
  if (key.includes("meta") || key.includes("facebook") || key.includes("fb")) return "Meta"
  if (key.includes("gads") || key.includes("google")) return "Google Ads"
  if (key.includes("offline")) return "Offline"
  return value ? value : "Other"
}

const resolvePlatformBadge = (value?: string | null) => {
  const label = resolvePlatformLabel(value)
  const key = label.toLowerCase()
  const color =
    key.includes("meta") ? "bg-blue-500" : key.includes("google") ? "bg-amber-500" : "bg-slate-400"
  return (
    <Badge variant="outline" className="gap-1.5 text-xs font-medium">
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold text-white ${color}`}>
        {label[0]}
      </span>
      {label}
    </Badge>
  )
}

const resolveStatus = (row: WidgetRow, activityScore: number) => {
  const platform = String(row.platform ?? row.channel ?? "").toLowerCase()
  const metaStatus = (row.ad_effective_status ?? row.effective_status ?? row.ad_status) as string | null
  if (platform.includes("meta") && metaStatus) {
    const status = metaStatus.toUpperCase()
    if (["ACTIVE", "ENABLED"].includes(status)) return { label: "Active", variant: "success" as const }
    if (["PAUSED", "ARCHIVED", "DELETED", "DISAPPROVED"].includes(status))
      return { label: "Paused", variant: "outline" as const }
    return { label: "Limited", variant: "warning" as const }
  }
  return activityScore > 0 ? { label: "Active", variant: "success" as const } : { label: "Paused", variant: "outline" as const }
}

const resolveFatigueStatus = (delta: number | null) => {
  if (delta == null) return { label: "Stable", variant: "outline" as const }
  if (delta <= -0.02) return { label: "Burnout", variant: "destructive" as const }
  if (delta < -0.005) return { label: "Declining", variant: "warning" as const }
  if (delta >= 0.01) return { label: "Improving", variant: "success" as const }
  return { label: "Stable", variant: "outline" as const }
}

const collectKeys = (...values: Array<string | number | null | undefined>) => {
  const keys = new Set<string>()
  values.forEach((value) => {
    if (value == null || value === "") return
    keys.add(String(value))
  })
  return Array.from(keys)
}

const CreativePreview = ({
  src,
  label,
  source,
}: {
  src: string | null
  label: string
  source?: string | null
}) => {
  const [failed, setFailed] = useState(false)
  const cleanSrc = sanitizePreviewUrl(src)
  if (!cleanSrc || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
        <span>No preview available</span>
        {source && <span className="text-[10px] uppercase">{source}</span>}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cleanSrc}
      alt={label}
      className="h-full w-full object-cover"
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export default function CreativesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const canFetch = isAuthenticated && !authLoading
  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date
  }, [])

  const [startDate, setStartDate] = useState(toDateInput(defaultFrom))
  const [endDate, setEndDate] = useState(toDateInput(today))
  const [product, setProduct] = useState("")
  const [branch, setBranch] = useState("")
  const [platform, setPlatform] = useState("")

  const [typeRows, setTypeRows] = useState<WidgetRow[]>([])
  const [creativeRows, setCreativeRows] = useState<WidgetRow[]>([])
  const [creativeMissing, setCreativeMissing] = useState(false)
  const [creativeWidgetKey, setCreativeWidgetKey] = useState("creatives.table")
  const [contractRows, setContractRows] = useState<WidgetRow[]>([])
  const [contractAllTimeRows, setContractAllTimeRows] = useState<WidgetRow[]>([])
  const [contractsMissing, setContractsMissing] = useState(false)
  const [contractsRange, setContractsRange] = useState<{ min: string | null; max: string | null } | null>(null)
  const [fatigueRows, setFatigueRows] = useState<WidgetRow[]>([])
  const [fatigueMissing, setFatigueMissing] = useState(false)

  const [activeAiWidget, setActiveAiWidget] = useState("creatives.type_cards")
  const [showAllTypes, setShowAllTypes] = useState(false)
  const [showAllSources, setShowAllSources] = useState(false)
  const [showAllCreatives, setShowAllCreatives] = useState(false)
  const [onlyActive, setOnlyActive] = useState(false)
  const [onlyWithContracts, setOnlyWithContracts] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const aggregatedTypeRows = useMemo(() => {
    const bucket = new Map<
      string,
      {
        object_type: string
        spend: number
        impressions: number
        clicks: number
        leads: number
        ctr: number | null
        cpl: number | null
        [key: string]: unknown
      }
    >()
    typeRows.forEach((row) => {
      const type =
        (row.object_type ?? row.creative_type ?? row.type ?? row.format ?? row.objectType ?? row.creativeType) ??
        "Unknown"
      const key = String(type)
      const entry = bucket.get(key) ?? {
        object_type: key,
        spend: 0,
        impressions: 0,
        clicks: 0,
        leads: 0,
        ctr: null,
        cpl: null,
      }
      entry.spend += toNumber(row.spend) ?? 0
      entry.impressions += toNumber(row.impressions) ?? 0
      entry.clicks += toNumber(row.clicks) ?? 0
      entry.leads += toNumber(row.leads) ?? 0
      bucket.set(key, entry)
    })
    return Array.from(bucket.values())
      .map((row) => ({
        ...row,
        ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
        cpl: row.leads > 0 ? row.spend / row.leads : null,
      }))
      .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0))
  }, [typeRows])

  const aggregatedCreativeRows = useMemo(() => {
    const bucket = new Map<
      string,
      WidgetRow & {
        spend_value: number
        clicks_value: number
        impressions_value: number
        conversions_value: number
        creative_source?: string | null
        creative_format?: string | null
        object_type?: string | null
        advertising_channel_type?: string | null
        min_date?: string | null
        max_date?: string | null
      }
    >()
    creativeRows.forEach((row) => {
      const creativeId = row.creative_key ?? row.creative_id ?? row.ad_id ?? row.adId ?? row.creativeId ?? row.id
      const platformValue = row.platform ?? row.channel ?? ""
      const key = `${platformValue ?? ""}:${creativeId ?? row.ad_name ?? row.creative_title ?? "creative"}`
      const existing =
        bucket.get(key) ??
        ({
          ...row,
          spend_value: 0,
          clicks_value: 0,
          impressions_value: 0,
          conversions_value: 0,
          creative_source: null,
          creative_format: null,
          object_type: null,
          advertising_channel_type: null,
          min_date: null,
          max_date: null,
        } as WidgetRow & {
          spend_value: number
          clicks_value: number
          impressions_value: number
          conversions_value: number
          creative_source?: string | null
          creative_format?: string | null
          object_type?: string | null
          advertising_channel_type?: string | null
          min_date?: string | null
          max_date?: string | null
        })
      existing.spend_value += toNumber(row.spend) ?? 0
      existing.clicks_value += toNumber(row.clicks) ?? 0
      existing.impressions_value += toNumber(row.impressions) ?? 0
      existing.conversions_value += toNumber(row.conversions ?? row.leads) ?? 0
      if (!existing.campaign_name) existing.campaign_name = row.campaign_name
      if (!existing.ad_name) existing.ad_name = row.ad_name
      if (!existing.adset_name) existing.adset_name = row.adset_name
      if (!existing.creative_title) existing.creative_title = row.creative_title ?? row.creative_name ?? row.ad_name
      if (!existing.creative_name) existing.creative_name = row.creative_name ?? row.ad_name
      if (!existing.thumbnail_url)
        existing.thumbnail_url = (row.preview_image_url ?? row.thumbnail_url ?? row.media_image_src) as string | undefined
      if (!existing.link_url) existing.link_url = row.link_url
      if (!existing.platform) existing.platform = row.platform ?? row.channel
      if (!existing.ad_effective_status)
        existing.ad_effective_status = (row.ad_effective_status ?? row.effective_status ?? row.ad_status) as string | null
      if (!existing.creative_source) existing.creative_source = (row.creative_source ?? row.source) as string | null
      if (!existing.creative_format)
        existing.creative_format = (row.creative_format ??
          row.creative_type ??
          row.object_type ??
          row.format) as string | null
      if (!existing.object_type) existing.object_type = (row.object_type ?? row.creative_type) as string | null
      if (!existing.advertising_channel_type)
        existing.advertising_channel_type = (row.advertising_channel_type ?? row.channel_type) as string | null
      const rowDate = (row.date_key ?? row.day_key ?? row.date) as string | null
      if (rowDate) {
        if (!existing.min_date || rowDate < existing.min_date) existing.min_date = rowDate
        if (!existing.max_date || rowDate > existing.max_date) existing.max_date = rowDate
      }
      bucket.set(key, existing)
    })
    return Array.from(bucket.values()).sort((a, b) => (b.spend_value ?? 0) - (a.spend_value ?? 0))
  }, [creativeRows])

  const hasData = aggregatedTypeRows.length > 0 || aggregatedCreativeRows.length > 0

  const totals = useMemo(() => {
    return aggregatedCreativeRows.reduce(
      (acc, row) => {
        acc.spend += toNumber(row.spend_value ?? row.spend) ?? 0
        acc.clicks += toNumber(row.clicks_value ?? row.clicks) ?? 0
        acc.impressions += toNumber(row.impressions_value ?? row.impressions) ?? 0
        acc.leads += toNumber(row.conversions_value ?? row.conversions ?? row.leads) ?? 0
        return acc
      },
      { spend: 0, clicks: 0, impressions: 0, leads: 0 }
    )
  }, [aggregatedCreativeRows])

  const sourceSummary = useMemo(() => {
    const bucket = new Map<string, { source: string; spend: number; leads: number; impressions: number; clicks: number }>()
    aggregatedCreativeRows.forEach((row) => {
      const rawSource = (row.creative_source as string | null) ?? (row.source as string | null)
      const source = normalizeLabel(rawSource, resolvePlatformLabel(row.platform as string | null))
      const entry = bucket.get(source) ?? { source, spend: 0, leads: 0, impressions: 0, clicks: 0 }
      entry.spend += toNumber(row.spend_value ?? row.spend) ?? 0
      entry.leads += toNumber(row.conversions_value ?? row.conversions ?? row.leads) ?? 0
      entry.impressions += toNumber(row.impressions_value ?? row.impressions) ?? 0
      entry.clicks += toNumber(row.clicks_value ?? row.clicks) ?? 0
      bucket.set(source, entry)
    })
    return Array.from(bucket.values()).sort((a, b) => b.spend - a.spend)
  }, [aggregatedCreativeRows])

  const formatSummary = useMemo(() => {
    const bucket = new Map<string, { format: string; spend: number; leads: number; impressions: number; clicks: number }>()
    aggregatedCreativeRows.forEach((row) => {
      const rawFormat = (row.creative_format as string | null) ?? (row.object_type as string | null)
      const format = normalizeFormatLabel(rawFormat)
      const entry = bucket.get(format) ?? { format, spend: 0, leads: 0, impressions: 0, clicks: 0 }
      entry.spend += toNumber(row.spend_value ?? row.spend) ?? 0
      entry.leads += toNumber(row.conversions_value ?? row.conversions ?? row.leads) ?? 0
      entry.impressions += toNumber(row.impressions_value ?? row.impressions) ?? 0
      entry.clicks += toNumber(row.clicks_value ?? row.clicks) ?? 0
      bucket.set(format, entry)
    })
    return Array.from(bucket.values()).sort((a, b) => b.spend - a.spend)
  }, [aggregatedCreativeRows])

  const contractsByCreative = useMemo(() => {
    const bucket = new Map<string, { contracts: number; revenue: number; payments: number }>()
    contractRows.forEach((row) => {
      const keys = collectKeys(row.creative_id, row.creative_key, row.ad_id, row.adId, row.id)
      if (keys.length === 0) return
      const primaryKey = keys[0]
      const entry = bucket.get(primaryKey) ?? { contracts: 0, revenue: 0, payments: 0 }
      entry.contracts += toNumber(row.contracts_cnt) ?? 0
      entry.revenue += toNumber(row.revenue_total_cost ?? row.revenue_sum ?? row.total_cost) ?? 0
      entry.payments += toNumber(row.payments_sum) ?? 0
      bucket.set(primaryKey, entry)
      keys.slice(1).forEach((key) => bucket.set(key, entry))
    })
    return bucket
  }, [contractRows])

  const contractsByCreativeAllTime = useMemo(() => {
    const bucket = new Map<string, { contracts: number; revenue: number; payments: number }>()
    contractAllTimeRows.forEach((row) => {
      const keys = collectKeys(row.creative_id, row.creative_key, row.ad_id, row.adId, row.id)
      if (keys.length === 0) return
      const primaryKey = keys[0]
      const entry = bucket.get(primaryKey) ?? { contracts: 0, revenue: 0, payments: 0 }
      entry.contracts += toNumber(row.contracts_cnt) ?? 0
      entry.revenue += toNumber(row.revenue_total_cost ?? row.revenue_sum ?? row.total_cost) ?? 0
      entry.payments += toNumber(row.payments_sum) ?? 0
      bucket.set(primaryKey, entry)
      keys.slice(1).forEach((key) => bucket.set(key, entry))
    })
    return bucket
  }, [contractAllTimeRows])

  const creativeRowById = useMemo(() => {
    const bucket = new Map<string, WidgetRow>()
    aggregatedCreativeRows.forEach((row) => {
      const keys = collectKeys(row.creative_id, row.creative_key, row.ad_id, row.adId, row.id)
      keys.forEach((key) => {
        if (!bucket.has(key)) bucket.set(key, row)
      })
    })
    return bucket
  }, [aggregatedCreativeRows])

  const contractsPeriodSummary = useMemo(() => {
    const bucket = new Map<
      string,
      {
        creative_id: string
        platform: string | null
        creative_title: string | null
        ad_name: string | null
        campaign_name: string | null
        preview_image_url: string | null
        permalink_url: string | null
        contracts: number
        revenue: number
        payments: number
      }
    >()
    contractRows.forEach((row) => {
      const primaryId = row.creative_id ?? row.ad_id ?? row.creative_key ?? row.adId ?? row.id
      if (primaryId == null) return
      const key = String(primaryId)
      const existing =
        bucket.get(key) ??
        ({
          creative_id: key,
          platform: (row.platform as string | null) ?? null,
          creative_title: null,
          ad_name: null,
          campaign_name: null,
          preview_image_url: null,
          permalink_url: null,
          contracts: 0,
          revenue: 0,
          payments: 0,
        } as {
          creative_id: string
          platform: string | null
          creative_title: string | null
          ad_name: string | null
          campaign_name: string | null
          preview_image_url: string | null
          permalink_url: string | null
          contracts: number
          revenue: number
          payments: number
        })
      existing.contracts += toNumber(row.contracts_cnt) ?? 0
      existing.revenue += toNumber(row.revenue_total_cost ?? row.revenue_sum ?? row.total_cost) ?? 0
      existing.payments += toNumber(row.payments_sum) ?? 0
      if (!existing.creative_title || isPlaceholderTitle(existing.creative_title)) {
        existing.creative_title = (row.creative_title as string | null) ?? null
      }
      if (!existing.ad_name || isPlaceholderTitle(existing.ad_name)) {
        existing.ad_name = (row.ad_name as string | null) ?? null
      }
      if (!existing.campaign_name || isPlaceholderTitle(existing.campaign_name)) {
        existing.campaign_name = (row.campaign_name as string | null) ?? null
      }
      if (!existing.preview_image_url) {
        existing.preview_image_url =
          (row.preview_image_url as string | null) ??
          (row.thumbnail_url as string | null) ??
          (row.media_image_src as string | null) ??
          null
      }
      if (!existing.permalink_url) {
        existing.permalink_url =
          (row.permalink_url as string | null) ??
          (row.link_url as string | null) ??
          (row.object_url as string | null) ??
          null
      }
      if (!existing.platform) {
        existing.platform = (row.platform as string | null) ?? null
      }
      bucket.set(key, existing)
    })
    return Array.from(bucket.values()).sort((a, b) => {
      const contractDelta = b.contracts - a.contracts
      if (contractDelta !== 0) return contractDelta
      return b.revenue - a.revenue
    })
  }, [contractRows])

  const fatigueByCreative = useMemo(() => {
    const bucket = new Map<
      string,
      {
        ctrDelta: number
        ctr7d: number
        ctrPrev7d: number
        fatigueFlags?: string | null
      }
    >()
    fatigueRows.forEach((row) => {
      const creativeId = row.creative_id ?? row.creative_key ?? row.ad_id ?? row.adId ?? row.id
      if (creativeId == null) return
      bucket.set(String(creativeId), {
        ctrDelta: toNumber(row.ctr_delta) ?? 0,
        ctr7d: toNumber(row.ctr_7d) ?? 0,
        ctrPrev7d: toNumber(row.ctr_prev7d) ?? 0,
        fatigueFlags: (row.fatigue_flags as string | null) ?? null,
      })
    })
    return bucket
  }, [fatigueRows])

  const fatigueHighlights = useMemo(() => {
    return [...fatigueRows]
      .map((row) => ({
        id: row.creative_id ?? row.ad_id ?? row.creative_key,
        row,
        delta: toNumber(row.ctr_delta) ?? 0,
      }))
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 6)
  }, [fatigueRows])

  const filteredCreatives = useMemo(() => {
    return aggregatedCreativeRows.filter((row) => {
      const creativeId = row.creative_id ?? row.creative_key ?? row.ad_id ?? row.adId ?? row.id
      const contracts = creativeId != null ? contractsByCreative.get(String(creativeId)) : undefined
      const impressions = toNumber(row.impressions_value ?? row.impressions) ?? 0
      const clicks = toNumber(row.clicks_value ?? row.clicks) ?? 0
      const spend = toNumber(row.spend_value ?? row.spend) ?? 0
      const status = resolveStatus(row, impressions + clicks + spend)
      if (onlyActive && status.label !== "Active") return false
      if (onlyWithContracts && (contracts?.contracts ?? 0) === 0) return false
      return true
    })
  }, [aggregatedCreativeRows, contractsByCreative, onlyActive, onlyWithContracts])

  const creativesWithContracts = useMemo(() => {
    return contractsPeriodSummary.map((contractRow) => {
      const creativeId = contractRow.creative_id
      const enriched = creativeRowById.get(String(creativeId))
      const contracts = contractsByCreative.get(String(creativeId))
      const allTime = contractsByCreativeAllTime.get(String(creativeId))
      return { contractRow, enriched, contracts, allTime }
    })
  }, [contractsPeriodSummary, creativeRowById, contractsByCreative, contractsByCreativeAllTime])

  const filters = {
    start_date: startDate,
    end_date: endDate,
    product: product || undefined,
    branch: branch || undefined,
    platform: platform || undefined,
  }

  const fetchCreativeWidgets = async () => {
    if (!canFetch) return
    setLoading(true)
    try {
      const platformKey = platform.toLowerCase()
      const shouldFetchContracts =
        !platformKey || platformKey.includes("meta") || platformKey.includes("facebook") || platformKey.includes("fb")
      const shouldFetchFatigue = shouldFetchContracts
      const contractsRangeValue =
        contractsRange ??
        (shouldFetchContracts ? await fetchWidgetRange("contracts.meta_by_ad_daily") : { min_date: null, max_date: null })
      if (!contractsRange && shouldFetchContracts) {
        setContractsRange({ min: contractsRangeValue.min_date, max: contractsRangeValue.max_date })
      }
      const widgetPayload = [
        { widget_key: "creatives.type_cards" },
        { widget_key: "ads.creatives_detailed", limit: 200 },
        { widget_key: "creatives.table", limit: 200 },
      ]
      if (shouldFetchContracts) widgetPayload.push({ widget_key: "contracts.meta_by_ad_daily", limit: 400 })
      if (shouldFetchFatigue) widgetPayload.push({ widget_key: "ads.meta_creative_fatigue_7d", limit: 200 })

      const batch = await fetchWidgetsBatch({
        global_filters: filters,
        widgets: widgetPayload,
      })

      const batchItems = batch.items ?? {}
      setTypeRows(batchItems["creatives.type_cards"]?.items ?? [])
      const detailedResponse = batchItems["ads.creatives_detailed"]
      const legacyResponse = batchItems["creatives.table"]
      const useDetailed = Boolean(detailedResponse && !detailedResponse.missing_view)
      const selectedCreative = useDetailed ? detailedResponse : legacyResponse
      setCreativeRows(selectedCreative?.items ?? [])
      setCreativeMissing(Boolean(selectedCreative?.missing_view))
      setCreativeWidgetKey(useDetailed ? "ads.creatives_detailed" : "creatives.table")
      const contractsResponse = batchItems["contracts.meta_by_ad_daily"]
      setContractRows(contractsResponse?.items ?? [])
      setContractsMissing(Boolean(contractsResponse?.missing_view))
      const fatigueResponse = batchItems["ads.meta_creative_fatigue_7d"]
      setFatigueRows(fatigueResponse?.items ?? [])
      setFatigueMissing(Boolean(fatigueResponse?.missing_view))

      if (shouldFetchContracts && contractsRangeValue.min_date && contractsRangeValue.max_date) {
        const allTimeBatch = await fetchWidgetsBatch({
          global_filters: {
            ...filters,
            start_date: contractsRangeValue.min_date,
            end_date: contractsRangeValue.max_date,
          },
          widgets: [{ widget_key: "contracts.meta_by_ad_daily", limit: 2000 }],
        })
        setContractAllTimeRows(allTimeBatch.items?.["contracts.meta_by_ad_daily"]?.items ?? [])
      } else {
        setContractAllTimeRows([])
      }
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }

  useEffect(() => {
    if (!canFetch) return
    fetchCreativeWidgets()
  }, [startDate, endDate, product, branch, platform, canFetch])

  const aiWidgetOptions = [
    { key: "creatives.type_cards", label: "Format mix" },
    { key: "ads.creatives_detailed", label: "Creatives detailed" },
    { key: "creatives.table", label: "Creative performance" },
  ]

  const resolveCreativeTitle = (row: WidgetRow, fallbackId: string | number) => {
    const meaningfulTitle = pickMeaningful(
      row.creative_title as string | null,
      row.creative_name as string | null,
      row.ad_name as string | null,
      row.campaign_name as string | null,
      row.creative_description as string | null
    )
    const bodySnippet =
      typeof row.creative_body === "string" && !isPlaceholderTitle(row.creative_body)
        ? row.creative_body.slice(0, 120)
        : null
    return meaningfulTitle ?? bodySnippet ?? `Creative #${fallbackId}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Creatives"
        description="Креативы, эффективность и признаки выгорания по выбранным фильтрам."
      />
      <Card>
        <CardHeader>
          <CardTitle>Creatives</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div>
            <label className="text-sm font-medium">Start</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">End</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Product</label>
            <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="All products" />
          </div>
          <div>
            <label className="text-sm font-medium">Branch / City</label>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="All branches" />
          </div>
          <div>
            <label className="text-sm font-medium">Platform</label>
            <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="All platforms" />
          </div>
          <div className="md:col-span-5 flex justify-end">
            <Button onClick={fetchCreativeWidgets} variant="outline" disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasLoaded && !loading && !hasData && (
        <AnalyticsEmptyState
          context="creatives"
          title="Нет данных по креативам"
          description="Подключите рекламные кабинеты, чтобы увидеть креативы и их эффективность."
          connectionGate
        />
      )}

      {hasData && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total spend</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(totals.spend)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Leads</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatNumber(totals.leads)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">CTR</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {totals.impressions > 0 ? formatPercent(totals.clicks / totals.impressions, 1) : "n/a"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">CPL</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {totals.leads > 0 ? formatCurrency(totals.spend / totals.leads) : "n/a"}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Creative source mix</h2>
        {sourceSummary.length > 6 && (
          <Button size="sm" variant="outline" onClick={() => setShowAllSources((prev) => !prev)}>
            {showAllSources ? "Collapse" : "Show all"}
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(showAllSources ? sourceSummary : sourceSummary.slice(0, 6)).map((row, index) => {
          const ctr = row.impressions > 0 ? row.clicks / row.impressions : null
          const cpl = row.leads > 0 ? row.spend / row.leads : null
          return (
            <Card key={`${row.source}-${index}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{row.source}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spend</span>
                  <span className="font-medium">{formatCurrency(row.spend)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leads</span>
                  <span className="font-medium">{formatNumber(row.leads)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CTR</span>
                  <span className="font-medium">{ctr != null ? formatPercent(ctr, 1) : "n/a"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPL</span>
                  <span className="font-medium">{cpl != null ? formatCurrency(cpl) : "n/a"}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {sourceSummary.length === 0 && (
          <div className="text-sm text-muted-foreground">Нет данных по источникам креативов.</div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Creative format mix</h2>
        {formatSummary.length > 6 && (
          <Button size="sm" variant="outline" onClick={() => setShowAllTypes((prev) => !prev)}>
            {showAllTypes ? "Collapse" : "Show all"}
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(showAllTypes ? formatSummary : formatSummary.slice(0, 6)).map((row, index) => {
          const title = normalizeFormatLabel(row.format)
          const ctr = row.impressions > 0 ? row.clicks / row.impressions : null
          const cpl = row.leads > 0 ? row.spend / row.leads : null
          return (
            <Card key={`${title}-${index}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spend</span>
                  <span className="font-medium">{formatCurrency(row.spend)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leads</span>
                  <span className="font-medium">{formatNumber(row.leads)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CTR</span>
                  <span className="font-medium">{ctr != null ? formatPercent(ctr, 1) : "n/a"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPL</span>
                  <span className="font-medium">{cpl != null ? formatCurrency(cpl) : "n/a"}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle>Creative fatigue (7d)</CardTitle>
          <Badge variant="secondary">{fatigueHighlights.length} items</Badge>
        </CardHeader>
        <CardContent>
          {fatigueMissing ? (
            <AnalyticsEmptyState
              context="creatives"
              title="Нет витрины выгорания"
              description="SEM витрина ads.meta_creative_fatigue_7d отсутствует или не обновляется."
              size="sm"
            />
          ) : fatigueHighlights.length === 0 ? (
            <div className="text-sm text-muted-foreground">Нет данных по выгоранию креативов.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Creative</th>
                    <th className="px-3 py-2 text-right">CTR 7d</th>
                    <th className="px-3 py-2 text-right">CTR prev 7d</th>
                    <th className="px-3 py-2 text-right">Δ CTR</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fatigueHighlights.map(({ row, delta }, index) => {
                    const creativeId = row.creative_id ?? row.ad_id ?? row.creative_key ?? index
                    const title = resolveCreativeTitle(row, creativeId)
                    const status = resolveFatigueStatus(delta)
                    return (
                      <tr key={`${creativeId}-${index}`} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="max-w-[280px] line-clamp-2">{title}</div>
                        </td>
                        <td className="px-3 py-2 text-right">{formatPercent(toNumber(row.ctr_7d), 1)}</td>
                        <td className="px-3 py-2 text-right">{formatPercent(toNumber(row.ctr_prev7d), 1)}</td>
                        <td className="px-3 py-2 text-right">{formatPercent(delta, 1)}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant={status.variant} className="text-xs">
                            {status.label}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Creative performance</CardTitle>
            <Badge variant="outline" className="text-xs">
              {creativeWidgetKey === "ads.creatives_detailed" ? "Detailed" : "Legacy"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={onlyActive} onCheckedChange={(value) => setOnlyActive(Boolean(value))} />
              Only active
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={onlyWithContracts} onCheckedChange={(value) => setOnlyWithContracts(Boolean(value))} />
              Only with contracts
            </label>
            {filteredCreatives.length > 8 && (
              <Button size="sm" variant="outline" onClick={() => setShowAllCreatives((prev) => !prev)}>
                {showAllCreatives ? "Collapse" : "Show all"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {creativeMissing ? (
            <AnalyticsEmptyState
              context="creatives"
              title="Нет витрины креативов"
              description="SEM витрина ads.creatives_detailed или creatives.table отсутствует."
              size="sm"
            />
          ) : (
            <>
              {(showAllCreatives ? filteredCreatives : filteredCreatives.slice(0, 8)).map((row, index) => {
                const idLabel = row.creative_id ?? row.creative_key ?? row.ad_id ?? index + 1
                const title = resolveCreativeTitle(row, idLabel)
                const formatLabel = normalizeFormatLabel(
                  (row.creative_format as string | null) ?? (row.object_type as string | null)
                )
                const sourceLabel = normalizeLabel(
                  (row.creative_source as string | null) ?? (row.source as string | null),
                  resolvePlatformLabel(row.platform as string | null)
                )
                const productLabel = normalizeLabel(
                  (row.product_name as string | null) ??
                    (row.product_group as string | null) ??
                    (row.product as string | null),
                  ""
                )
                const hasProductLabel = Boolean(productLabel && productLabel !== "Other")
                const spend = toNumber(row.spend ?? row.spend_value) ?? 0
                const impressions = toNumber(row.impressions ?? row.impressions_value) ?? 0
                const clicks = toNumber(row.clicks ?? row.clicks_value) ?? 0
                const leads = toNumber(row.leads ?? row.conversions ?? row.conversions_value) ?? 0
                const ctr = impressions > 0 ? clicks / impressions : null
                const cpl = leads > 0 ? spend / leads : null
                const cpc = clicks > 0 ? spend / clicks : null
                const link = ((row.permalink_url as string | null) ?? (row.link_url as string | null)) ?? null
                const previewUrl =
                  ((row.preview_image_url as string | null) ??
                    (row.thumbnail_url as string | null) ??
                    (row.media_image_src as string | null)) ??
                  null
                const creativeId = row.creative_id ?? row.creative_key ?? row.ad_id ?? row.adId ?? row.id
                const contractStats = creativeId != null ? contractsByCreative.get(String(creativeId)) : null
                const allTimeStats = creativeId != null ? contractsByCreativeAllTime.get(String(creativeId)) : null
                const contractsCnt = contractStats?.contracts ?? 0
                const revenueFromRow =
                  toNumber(row.revenue_sum ?? row.revenue_total_cost ?? row.revenue) ?? null
                const revenueSum = revenueFromRow ?? contractStats?.revenue ?? 0
                const allTimeContracts = allTimeStats?.contracts ?? 0
                const allTimeRevenue = allTimeStats?.revenue ?? 0
                const roas =
                  toNumber(row.roas ?? row.roas_paid ?? row.roas_crm) ??
                  (spend > 0 ? revenueSum / spend : null)
                const kef = toNumber(row.kef_commercial ?? row.kef)
                const activityScore = impressions + clicks + spend
                const statusMeta = resolveStatus(row, activityScore)
                const statusLabel = statusMeta.label
                const cardClass =
                  contractsCnt > 0
                    ? "border-emerald-300/80 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                    : "border-border"
                const fatigue = creativeId != null ? fatigueByCreative.get(String(creativeId)) : null
                const ctrDelta = fatigue?.ctrDelta ?? null
                const fatigueTone =
                  ctrDelta == null
                    ? null
                    : ctrDelta < -0.01
                      ? "destructive"
                      : ctrDelta > 0.01
                        ? "success"
                        : "outline"
                return (
                  <Card
                    key={`${row.creative_id ?? row.creative_key ?? title}-${index}`}
                    className={`flex h-full flex-col ${cardClass}`}
                  >
                    <CardHeader className="space-y-2 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base line-clamp-2">{title}</CardTitle>
                      </div>
                      {(row.campaign_name || row.adset_name || row.ad_name) && (
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {row.campaign_name && <div className="line-clamp-1">Campaign: {row.campaign_name}</div>}
                          {row.adset_name && <div className="line-clamp-1">Adset: {row.adset_name}</div>}
                          {row.ad_name && <div className="line-clamp-1">Ad: {row.ad_name}</div>}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {resolvePlatformBadge(row.platform as string | null)}
                        <Badge variant="secondary" className="text-xs">
                          {sourceLabel}
                        </Badge>
                        <Badge variant="outline" className="text-xs uppercase">
                          {formatLabel}
                        </Badge>
                        {hasProductLabel && (
                          <Badge variant="outline" className="text-xs">
                            {productLabel}
                          </Badge>
                        )}
                        <Badge variant={statusMeta.variant} className="text-xs">
                          {statusLabel}
                        </Badge>
                        {contractsCnt > 0 && (
                          <Badge variant="success" className="text-xs">
                            Contracts {contractsCnt}
                          </Badge>
                        )}
                        {contractsCnt === 0 && allTimeContracts > 0 && (
                          <Badge variant="outline" className="text-xs">
                            All-time {allTimeContracts}
                          </Badge>
                        )}
                        {ctrDelta != null && (
                          <Badge variant={fatigueTone as "success" | "outline" | "destructive"} className="text-xs">
                            CTR Δ {formatPercent(ctrDelta, 1)}
                          </Badge>
                        )}
                      </div>
                      {row.min_date || row.max_date ? (
                        <div className="text-xs text-muted-foreground">
                          {row.min_date ?? "—"} → {row.max_date ?? "—"}
                        </div>
                      ) : null}
                      <div className="h-28 w-full overflow-hidden rounded-lg border border-border bg-muted/40">
                        <CreativePreview src={previewUrl} label={title} source={sourceLabel} />
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Spend</div>
                        <div className="font-medium">{formatCurrency(spend)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Leads</div>
                        <div className="font-medium">{formatNumber(leads)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">CTR</div>
                        <div className="font-medium">{ctr != null ? formatPercent(ctr, 1) : "n/a"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">CPL</div>
                        <div className="font-medium">{cpl != null ? formatCurrency(cpl) : "n/a"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Clicks</div>
                        <div className="font-medium">{formatNumber(clicks)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Impr</div>
                        <div className="font-medium">{formatNumber(impressions)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">CPC</div>
                        <div className="font-medium">{cpc != null ? formatCurrency(cpc) : "n/a"}</div>
                      </div>
                      {roas != null && (
                        <div>
                          <div className="text-xs text-muted-foreground">ROAS</div>
                          <div className="font-medium">{formatNumber(roas)}</div>
                        </div>
                      )}
                      {kef != null && (
                        <div>
                          <div className="text-xs text-muted-foreground">KEF</div>
                          <div className="font-medium">{formatNumber(kef)}</div>
                        </div>
                      )}
                      {(contractsCnt > 0 || allTimeContracts > 0) && (
                        <>
                          <div>
                            <div className="text-xs text-muted-foreground">Contracts (period)</div>
                            <div className="font-medium">{formatNumber(contractsCnt)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Contracts (all time)</div>
                            <div className="font-medium">{formatNumber(allTimeContracts)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Revenue (period)</div>
                            <div className="font-medium">{formatCurrency(revenueSum)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Revenue (all time)</div>
                            <div className="font-medium">{formatCurrency(allTimeRevenue)}</div>
                          </div>
                        </>
                      )}
                      {fatigue?.fatigueFlags && (
                        <div className="col-span-2 text-xs text-muted-foreground">
                          Fatigue flags: {fatigue.fatigueFlags}
                        </div>
                      )}
                      {link ? (
                        <div className="col-span-2">
                          <Button size="sm" variant="outline" asChild>
                            <a href={link} target="_blank" rel="noreferrer">
                              Open link
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <div className="col-span-2 text-xs text-muted-foreground">No link available</div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
              {filteredCreatives.length === 0 && (
                <div className="text-sm text-muted-foreground">Нет данных по креативам для выбранных фильтров.</div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle>Creatives with contracts</CardTitle>
          <Badge variant="secondary">{creativesWithContracts.length} items</Badge>
        </CardHeader>
        <CardContent>
          {contractsMissing ? (
            <AnalyticsEmptyState
              context="creatives"
              title="Нет витрины контрактов"
              description="SEM витрина contracts.meta_by_ad_daily отсутствует или не обновляется."
              size="sm"
            />
          ) : creativesWithContracts.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              За выбранный период нет креативов с контрактами.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Creative</th>
                    <th className="px-3 py-2 text-left">Platform</th>
                    <th className="px-3 py-2 text-right">Contracts (period)</th>
                    <th className="px-3 py-2 text-right">Revenue (period)</th>
                    <th className="px-3 py-2 text-right">Contracts (all time)</th>
                    <th className="px-3 py-2 text-right">Revenue (all time)</th>
                    <th className="px-3 py-2 text-right">Spend</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {creativesWithContracts.slice(0, 20).map(({ contractRow, enriched, contracts, allTime }, index) => {
                    const creativeId = contractRow.creative_id ?? index
                    const baseRow = enriched ?? (contractRow as unknown as WidgetRow)
                    const title = resolveCreativeTitle(baseRow, creativeId)
                    const spend = enriched ? toNumber(enriched.spend_value ?? enriched.spend) ?? 0 : 0
                    const impressions = enriched ? toNumber(enriched.impressions_value ?? enriched.impressions) ?? 0 : 0
                    const clicks = enriched ? toNumber(enriched.clicks_value ?? enriched.clicks) ?? 0 : 0
                    const activityScore = impressions + clicks + spend
                    const status = enriched
                      ? resolveStatus(enriched, activityScore)
                      : { label: "—", variant: "outline" as const }
                    return (
                      <tr key={`${creativeId}-${index}`} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="max-w-[280px] line-clamp-2">{title}</div>
                        </td>
                        <td className="px-3 py-2">
                          {resolvePlatformLabel((enriched?.platform as string | null) ?? contractRow.platform ?? "meta")}
                        </td>
                        <td className="px-3 py-2 text-right">{formatNumber(contracts?.contracts ?? 0)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(contracts?.revenue ?? 0)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(allTime?.contracts ?? 0)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(allTime?.revenue ?? 0)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(spend)}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant={status.variant} className="text-xs">
                            {status.label}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-lg font-semibold">Insights</div>
          <div className="flex flex-wrap gap-2">
            {aiWidgetOptions.map((option) => (
              <Button
                key={option.key}
                size="sm"
                variant={activeAiWidget === option.key ? "default" : "outline"}
                onClick={() => setActiveAiWidget(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <InsightsPanel
          widgetKey={activeAiWidget}
          dateFrom={startDate}
          dateTo={endDate}
          enabled={canFetch}
        />
      </div>
    </div>
  )
}
