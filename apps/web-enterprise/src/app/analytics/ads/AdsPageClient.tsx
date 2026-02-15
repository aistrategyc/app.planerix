"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { WidgetTable } from "@/components/analytics/WidgetTable"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"
import { KpiSparkline } from "@/app/analytics/components/KpiSparkline"
import { WidgetStatus } from "@/app/analytics/components/WidgetStatus"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { buildLastWeekRange, resolveDefaultCityId } from "@/app/analytics/utils/defaults"
import { formatCurrency, formatNumber, formatPercent, parseNumeric } from "@/app/analytics/utils/formatters"
import { api } from "@/lib/api/config"
import { fetchWidgetRange, fetchWidgetsBatch, WidgetRow } from "@/lib/api/analytics-widgets"
import { camelizeUnknownRecordShallow, parseWidgetRowsSafe } from "@/lib/widgets/widgetParsing"
import { adsKpiTotalRowSchema } from "@/lib/widgets/widgetSchemas"
import { useAuth } from "@/contexts/auth-context"
import { ArrowDownRight, ArrowUpRight, Copy, ExternalLink, ImageOff } from "lucide-react"
import { Area, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { InsightsPanel } from "@/app/analytics/components/InsightsPanel"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"

type AdsDailyRow = {
  date_key?: string | null
  id_city?: number | null
  platform?: string | null
  currency_code?: string | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  adset_id?: string | number | null
  adset_name?: string | null
  ad_id?: string | number | null
  ad_name?: string | null
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  conversions?: number | null
  cpc?: number | null
  ctr?: number | null
  load_timestamp?: string | null
}

type WidgetMeta = {
  supports_filters?: Record<string, boolean> | string[] | null
}

type AdsAnomalyRow = {
  platform?: string | null
  id_city?: number | null
  ad_id?: string | number | null
  ad_name?: string | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  adset_id?: string | number | null
  adset_name?: string | null
  creative_title?: string | null
  preview_image_url?: string | null
  link_url?: string | null
  currency_code?: string | null
  spend_7d?: number | null
  spend_prev7d?: number | null
  cpl_7d?: number | null
  cpl_prev7d?: number | null
  cpl_delta_pct?: number | null
  kef_7d?: number | null
  kef_prev7d?: number | null
  kef_delta?: number | null
  impact_estimate?: number | null
  clicks_7d?: number | null
  clicks_prev7d?: number | null
  conv_7d?: number | null
  conv_prev7d?: number | null
  impr_7d?: number | null
  impr_prev7d?: number | null
  spend_delta_pct?: number | null
  clicks_delta_pct?: number | null
  conv_delta_pct?: number | null
  impr_delta_pct?: number | null
  baseline_days?: number | null
}

type AdsKpiRow = {
  date_key?: string | null
  platform?: string | null
  currency_code?: string | null
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  conversions?: number | null
  conversion_value?: number | null
  platform_leads?: number | null
  crm_requests_cnt?: number | null
  cpl?: number | null
  cac?: number | null
  roas?: number | null
  payback_rate?: number | null
  kef_commercial?: number | null
}

type AdsByPlatformRow = {
  ad_id: string | number | null
  campaign_id?: string | number | null
  campaign_name: string
  adset_id?: string | number | null
  adset_name: string
  ad_name: string
  creative_title?: string | null
  creative_body?: string | null
  preview_image_url?: string | null
  thumbnail_url?: string | null
  media_image_src?: string | null
  permalink_url?: string | null
  link_url?: string | null
  spend: number
  clicks: number
  impressions: number
  conversions: number
  fb_leads?: number | null
  crm_requests_cnt?: number | null
  contracts_cnt?: number | null
  paid_sum?: number | null
  ctr: number | null
  cpc: number | null
  cpa: number | null
  cpm: number | null
  cpl?: number | null
  roas_paid?: number | null
}

type TotalsAccumulator = {
  spend: number
  clicks: number
  impressions: number
  conversions: number
  platformLeads: number
  crmRequests: number
  contracts: number
  revenue: number
  payments: number
  conversionValue: number
}

type CreativeSortMode = "spend" | "leads" | "ctr" | "contracts" | "roas"

type CreativeTypeRow = {
  object_type?: string | null
  spend?: number | null
  impressions?: number | null
  clicks?: number | null
  leads?: number | null
  ctr?: number | null
  cpl?: number | null
  spend_share_7d?: number | null
}

type AdsCreativeRow = {
  date_key?: string | null
  id_city?: number | null
  platform?: string | null
  currency_code?: string | null
  creative_key?: string | number | null
  creative_id?: string | number | null
  creative_name?: string | null
  creative_type?: string | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  adset_id?: string | number | null
  adset_name?: string | null
  ad_id?: string | number | null
  ad_name?: string | null
  link_url?: string | null
  permalink_url?: string | null
  thumbnail_url?: string | null
  preview_image_url?: string | null
  media_image_src?: string | null
  object_type?: string | null
  creative_title?: string | null
  creative_body?: string | null
  conversions?: number | null
  leads?: number | null
  purchases?: number | null
  post_message?: string | null
  spend?: number | null
  clicks?: number | null
  impressions?: number | null
  cpc?: number | null
  ctr?: number | null
  placement?: string | null
  publisher_platform?: string | null
}

type ChannelMixRow = {
  date_key?: string | null
  id_city?: number | null
  channel?: string | null
  spend?: number | null
  spend_share?: number | null
  spend_share_pct?: number | null
  contracts_cnt?: number | null
  contracts_share?: number | null
  contracts_share_pct?: number | null
  leads_cnt?: number | null
  leads_share?: number | null
  leads_share_pct?: number | null
  revenue_share_pct?: number | null
  eff_share_ratio_leads?: number | null
  eff_share_ratio_contracts?: number | null
  cpl?: number | null
  cac?: number | null
  roas?: number | null
  payback_rate?: number | null
  kef_commercial?: number | null
}

type GadsKeywordDailyRow = {
  date_key?: string | null
  campaign_name?: string | null
  campaign_id?: string | number | null
  ad_group_name?: string | null
  ad_group_id?: string | number | null
  keyword_text?: string | null
  keyword_match_type?: string | null
  currency_code?: string | null
  impressions?: number | null
  clicks?: number | null
  cost?: number | null
  spend?: number | null
  cpc?: number | null
  ctr?: number | null
  conversions?: number | null
  conversions_value?: number | null
}

type GadsSpendRow = {
  date_key?: string | null
  id_city?: number | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  advertising_channel_type?: string | null
  currency_code?: string | null
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  conversions?: number | null
  cpc?: number | null
  ctr?: number | null
}

type GadsCampaignPreviewRow = {
  date_key?: string | null
  city_id?: number | null
  platform?: string | null
  customer_id?: string | number | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  advertising_channel_type?: string | null
  creative_id?: string | number | null
  creative_title?: string | null
  preview_image_url?: string | null
  has_preview?: boolean | null
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  conversions?: number | null
  conversions_value?: number | null
}

type GadsRequestsByCampaignRow = {
  date_key?: string | null
  city_id?: number | null
  platform?: string | null
  customer_id?: string | number | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  advertising_channel_type?: string | null
  crm_requests_cnt?: number | null
  gclid_uniq?: number | null
}

type GadsLeadsByCampaignRow = {
  date_key?: string | null
  city_id?: number | null
  platform?: string | null
  customer_id?: string | number | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  advertising_channel_type?: string | null
  leads_cnt?: number | null
  gclid_uniq?: number | null
}

type GadsDeviceRow = {
  date_key?: string | null
  device?: string | null
  day_of_week?: string | null
  hour?: number | null
  currency_code?: string | null
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  cpc?: number | null
  ctr?: number | null
  conversions?: number | null
  cvr?: number | null
  slot_score?: number | null
}

type GadsConversionActionRow = {
  date_key?: string | null
  campaign_id?: string | number | null
  conversion_action_name?: string | null
  conversion_action_category?: string | null
  currency_code?: string | null
  spend?: number | null
  conversions?: number | null
  all_conversions?: number | null
  conversions_share_pct?: number | null
  conversions_value?: number | null
  all_conversions_value?: number | null
  value_value?: number | null
  cpa?: number | null
  kef_proxy?: number | null
}

type MetaCampaignProductRow = {
  date_key?: string | null
  city_id?: number | null
  platform?: string | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  product_id?: string | number | null
  product_name?: string | null
  product_group?: string | null
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  leads_cnt?: number | null
  contracts_cnt?: number | null
  revenue_sum?: number | null
  payments_sum?: number | null
  cpl?: number | null
  cac?: number | null
  roas?: number | null
  kef_commercial?: number | null
  spend_share_pct?: number | null
  contracts_share_pct?: number | null
  eff_share_ratio_contracts?: number | null
}

type CreativeDetailedRow = {
  date_key?: string | null
  city_id?: number | null
  platform?: string | null
  creative_key?: string | number | null
  creative_id?: string | number | null
  creative_title?: string | null
  creative_type?: string | null
  product_name?: string | null
  product_group?: string | null
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  ctr?: number | null
  leads_cnt?: number | null
  contracts_cnt?: number | null
  revenue_sum?: number | null
  roas?: number | null
  kef_commercial?: number | null
  spend_share_pct?: number | null
  revenue_share_pct?: number | null
  preview_image_url?: string | null
  thumbnail_url?: string | null
  permalink_url?: string | null
  link_url?: string | null
  media_image_src?: string | null
  campaign_name?: string | null
  ad_name?: string | null
  adset_name?: string | null
  ad_id?: string | number | null
}

type GadsAssetGroupRow = {
  date_key?: string | null
  customer_id?: string | number | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  asset_group_id?: string | number | null
  asset_group_name?: string | null
  currency_code?: string | null
  impressions?: number | null
  clicks?: number | null
  cost?: number | null
  spend?: number | null
  conversions?: number | null
  conversions_value?: number | null
  preview_image_url?: string | null
  preview_image_width_px?: number | null
  preview_image_height_px?: number | null
  preview_status?: string | null
  has_preview?: boolean | null
  asset_display_name?: string | null
  asset_type?: string | null
}

type MetaCreativeRow = {
  date_key?: string | null
  id_city?: number | null
  platform?: string | null
  currency_code?: string | null
  creative_key?: string | number | null
  creative_id?: string | number | null
  creative_name?: string | null
  creative_type?: string | null
  creative_title?: string | null
  creative_body?: string | null
  link_url?: string | null
  permalink_url?: string | null
  thumbnail_url?: string | null
  preview_image_url?: string | null
  media_image_src?: string | null
  object_type?: string | null
  ad_id?: string | number | null
  ad_name?: string | null
  campaign_name?: string | null
  adset_name?: string | null
  post_message?: string | null
  spend?: number | null
  clicks?: number | null
  impressions?: number | null
  leads?: number | null
  purchases?: number | null
  ctr?: number | null
  cpa?: number | null
  roas?: number | null
  placement?: string | null
  publisher_platform?: string | null
}

type MetaAdsTopRow = {
  date_key?: string | null
  id_city?: number | null
  platform?: string | null
  currency_code?: string | null
  campaign_id?: string | number | null
  campaign_name?: string | null
  adset_id?: string | number | null
  adset_name?: string | null
  ad_id?: string | number | null
  ad_name?: string | null
  creative_title?: string | null
  creative_body?: string | null
  link_url?: string | null
  permalink_url?: string | null
  thumbnail_url?: string | null
  preview_image_url?: string | null
  media_image_src?: string | null
  post_message?: string | null
  spend?: number | null
  fb_leads?: number | null
  crm_requests_cnt?: number | null
  contracts_cnt?: number | null
  paid_sum?: number | null
  cpl?: number | null
  cpa?: number | null
  roas_paid?: number | null
}

type MetaCreativeFatigueRow = {
  platform?: string | null
  creative_id?: string | number | null
  creative_name?: string | null
  creative_type?: string | null
  creative_title?: string | null
  creative_body?: string | null
  link_url?: string | null
  thumbnail_url?: string | null
  permalink_url?: string | null
  post_message?: string | null
  object_type?: string | null
  preview_image_url?: string | null
  currency_code?: string | null
  spend_7d?: number | null
  imp_7d?: number | null
  clk_7d?: number | null
  leads_7d?: number | null
  spend_share_7d?: number | null
  ctr_7d?: number | null
  cvr_7d?: number | null
  cpl_7d?: number | null
  spend_prev7d?: number | null
  imp_prev7d?: number | null
  clk_prev7d?: number | null
  leads_prev7d?: number | null
  ctr_prev7d?: number | null
  cvr_prev7d?: number | null
  cpl_prev7d?: number | null
  ctr_delta?: number | null
  cvr_delta?: number | null
  cpl_delta?: number | null
  fatigue_flags?: number | null
}

type CreativePreviewEntry = {
  previewImageUrl: string | null
  permalinkUrl: string | null
  creativeTitle: string | null
}

type CreativePreviewSource = {
  creative_key?: string | number | null
  creative_id?: string | number | null
  creative_name?: string | null
  creative_title?: string | null
  ad_id?: string | number | null
  ad_name?: string | null
  preview_image_url?: string | null
  thumbnail_url?: string | null
  media_image_src?: string | null
  permalink_url?: string | null
  link_url?: string | null
}

type WidgetResponse<T> = {
  widget_key: string
  items: T[]
  missing_view?: boolean
  meta?: {
    currency_code?: string | null
    money_format?: Record<string, unknown> | null
    metrics?: Record<string, unknown> | null
  }
}

const TAB_SUMMARY = "summary"
const TAB_META = "meta"
const TAB_GADS = "gads"
const TAB_CREATIVES = "creatives"
const TAB_PMAX = "pmax"
const DAY_MS = 24 * 60 * 60 * 1000

type CompareMode = "none" | "wow" | "mom"

const isNumericLabel = (value?: string | null) => Boolean(value && /^\d+$/.test(value.trim()))

const isPlaceholderLabel = (value?: string | null) =>
  Boolean(value && value.includes("{{") && value.includes("}}"))

const normalizeLabel = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (["undefined", "null", "nan", "n/a"].includes(lower)) return null
  if (isPlaceholderLabel(trimmed)) return null
  return trimmed
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

const buildCreativePreviewKeys = (row: CreativePreviewSource) => {
  const rawKeys = [
    row.creative_key,
    row.creative_id,
    row.ad_id,
    row.ad_name,
    row.creative_title,
    row.creative_name,
  ]
  return rawKeys
    .map((value) => (value == null || value === "" ? null : String(value)))
    .filter((value): value is string => Boolean(value))
}

const extractCreativePreview = (row: CreativePreviewSource): CreativePreviewEntry | null => {
  const previewImageUrl =
    row.preview_image_url ?? row.thumbnail_url ?? row.media_image_src ?? null
  const permalinkUrl = row.permalink_url ?? row.link_url ?? null
  const creativeTitle = normalizeLabel(row.creative_title ?? row.creative_name ?? row.ad_name ?? null)
  if (!previewImageUrl && !permalinkUrl && !creativeTitle) return null
  return { previewImageUrl, permalinkUrl, creativeTitle }
}

const upsertCreativePreview = (map: Map<string, CreativePreviewEntry>, row: CreativePreviewSource) => {
  const keys = buildCreativePreviewKeys(row)
  if (!keys.length) return
  const entry = extractCreativePreview(row)
  if (!entry) return
  keys.forEach((key) => {
    const existing = map.get(key) ?? { previewImageUrl: null, permalinkUrl: null, creativeTitle: null }
    if (!existing.previewImageUrl && entry.previewImageUrl) existing.previewImageUrl = entry.previewImageUrl
    if (!existing.permalinkUrl && entry.permalinkUrl) existing.permalinkUrl = entry.permalinkUrl
    if (!existing.creativeTitle && entry.creativeTitle) existing.creativeTitle = entry.creativeTitle
    map.set(key, existing)
  })
}

const resolveCreativePreview = (map: Map<string, CreativePreviewEntry>, row: CreativePreviewSource) => {
  const keys = buildCreativePreviewKeys(row)
  for (const key of keys) {
    const entry = map.get(key)
    if (entry) return entry
  }
  return null
}

const buildEntityLabel = (name?: string | null, id?: string | number | null, fallback = "Item") => {
  const normalized = normalizeLabel(name)
  if (normalized && !isNumericLabel(normalized)) {
    return { title: normalized, meta: id ? `ID ${id}` : null }
  }
  if (id !== null && id !== undefined && id !== "") {
    return { title: `${fallback} #${id}`, meta: null }
  }
  return { title: fallback, meta: null }
}

const pickValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== "") {
      return value
    }
  }
  return null
}

const resolveDateKey = (row: { date_key?: string | null; dateKey?: string | null }) =>
  row.date_key ?? row.dateKey ?? null

const normalizeKey = (value?: string | null) =>
  value ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : ""

const getPlatformMeta = (value?: string | null) => {
  const key = normalizeKey(value)
  if (["meta", "facebook", "fb", "paidmeta", "paidfacebook"].includes(key)) {
    return { label: "Meta", dotClass: "bg-blue-500", hint: "Meta Ads", short: "M" }
  }
  if (["gads", "googleads", "google", "paidgads", "paidgoogle"].includes(key)) {
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
  if (["meta", "facebook", "fb", "paidmeta", "paidfacebook"].includes(key)) {
    return { label: "Meta", dotClass: "bg-blue-500", barClass: "bg-blue-500", hint: "Meta Ads" }
  }
  if (["gads", "googleads", "google", "paidgads", "paidgoogle"].includes(key)) {
    return { label: "Google Ads", dotClass: "bg-amber-500", barClass: "bg-amber-500", hint: "Google Ads" }
  }
  if (key.includes("promo")) {
    return { label: "Promo", dotClass: "bg-fuchsia-500", barClass: "bg-fuchsia-500", hint: "Promo" }
  }
  if (key.includes("event")) {
    return { label: "Event", dotClass: "bg-indigo-500", barClass: "bg-indigo-500", hint: "Event" }
  }
  if (key.includes("telegram")) {
    return { label: "Telegram", dotClass: "bg-sky-500", barClass: "bg-sky-500", hint: "Telegram" }
  }
  if (key.includes("organic")) {
    return { label: "Organic", dotClass: "bg-emerald-500", barClass: "bg-emerald-500", hint: "Organic" }
  }
  if (key.includes("offline")) {
    return { label: "Offline", dotClass: "bg-slate-500", barClass: "bg-slate-500", hint: "Offline" }
  }
  if (!value) {
    return { label: "Unknown", dotClass: "bg-slate-300", barClass: "bg-slate-300", hint: "Unknown" }
  }
  return {
    label: value,
    dotClass: "bg-slate-400",
    barClass: "bg-slate-400",
    hint: value,
  }
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

const PreviewImage = ({
  src,
  alt,
  href,
  fallbackUrl,
}: {
  src: string | null
  alt: string
  href?: string | null
  fallbackUrl?: string | null
}) => {
  const [failed, setFailed] = useState(false)
  const cleanSrc = sanitizePreviewUrl(src)
  if (!cleanSrc || failed) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/30">
          <ImageOff className="h-4 w-4 text-muted-foreground" />
        </div>
        {fallbackUrl && (
          <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground">
            <a href={fallbackUrl} target="_blank" rel="noreferrer">
              Ads Library
            </a>
          </Button>
        )}
      </div>
    )
  }

  const image = (
    <img
      src={cleanSrc}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-12 w-12 rounded-md border border-border/60 object-cover"
    />
  )
  if (!href) return image
  return (
    <a href={href} target="_blank" rel="noreferrer" className="shrink-0">
      {image}
    </a>
  )
}

const CampaignPreviewThumb = ({
  src,
  hasPreview,
}: {
  src?: string | null
  hasPreview?: boolean
}) => {
  const [failed, setFailed] = useState(false)
  const cleanSrc = sanitizePreviewUrl(src ?? null)
  if (!cleanSrc || hasPreview === false || failed) {
    return (
      <Badge variant="outline" className="text-[10px]">
        No preview
      </Badge>
    )
  }
  return (
    <img
      src={cleanSrc}
      alt="Preview"
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

const buildAdsLibraryUrl = (adId?: string | number | null) =>
  adId ? `https://www.facebook.com/ads/library/?id=${adId}` : null

const resolveChannelLabel = (value?: string | null) => {
  const key = normalizeKey(value)
  if (["meta", "facebook", "fb", "paidmeta", "paidfacebook"].includes(key)) return "Meta"
  if (["gads", "googleads", "google", "paidgads", "paidgoogle"].includes(key)) return "Google Ads"
  if (key.includes("promo")) return "Promo"
  if (key.includes("event")) return "Event"
  if (key.includes("telegram")) return "Telegram"
  if (key.includes("organic")) return "Organic"
  if (key.includes("offline")) return "Offline"
  return value || "Unknown"
}

const toNumber = (value: unknown) => parseNumeric(value)

const pickRowValue = (row: WidgetRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== "") return value
  }
  return null
}

const metricNumber = (row: WidgetRow, keys: string[]) => {
  const value = pickRowValue(row, keys)
  return toNumber(value)
}

const normalizeGa4Platform = (value?: string | null) => {
  const key = normalizeKey(value)
  if (!key) return null
  if (key.includes("facebook") || key.includes("instagram") || key.includes("meta")) return "meta"
  if (key.includes("google")) return "gads"
  return key
}

const isGa4PmaxRow = (row: WidgetRow) => {
  const campaignType = normalizeKey(String(pickRowValue(row, ["campaign_type"]) ?? ""))
  const networkType = normalizeKey(String(pickRowValue(row, ["ad_network_type"]) ?? ""))
  return campaignType.includes("performancemax") || networkType.includes("crossnetwork")
}

const buildDateKey = (value: Date) => value.toISOString().slice(0, 10)

const parseDateParam = (value: string | null) => {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed
}

const addDays = (value: Date, days: number) => new Date(value.getTime() + days * DAY_MS)

const calcDelta = (current?: number | null, previous?: number | null) => {
  if (current == null || previous == null || previous === 0) {
    return { delta: null, deltaPct: null }
  }
  const delta = current - previous
  return { delta, deltaPct: (delta / previous) * 100 }
}

const formatSignedPercent = (
  value: number | null | undefined,
  options?: { digits?: number; assumeRatio?: boolean }
) => {
  if (value == null) return "—"
  const formatted = formatPercent(value, options)
  return value > 0 ? `+${formatted}` : formatted
}

const formatDelta = (value?: number | null) => formatSignedPercent(value ?? null, { digits: 1, assumeRatio: false })

const formatDeltaPercent = (value?: number | null) => formatSignedPercent(value ?? null, { digits: 1 })

const DeltaBadge = ({
  label,
  value,
  formatter = formatDelta,
}: {
  label?: string
  value?: number | null
  formatter?: (value?: number | null) => string
}) => {
  if (value == null) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        {label ? `${label} —` : "—"}
      </Badge>
    )
  }
  const isPositive = value >= 0
  return (
    <Badge
      variant="outline"
      className={`gap-1 text-xs font-medium ${
        isPositive
          ? "border-emerald-200/70 bg-emerald-50 text-emerald-700"
          : "border-rose-200/70 bg-rose-50 text-rose-700"
      }`}
    >
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      <span>
        {label ? `${label} ` : ""}
        {formatter(value)}
      </span>
    </Badge>
  )
}

export default function AdsPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const hasCityParam = useMemo(() => Boolean(searchParams.get("id_city") ?? searchParams.get("city_id")), [searchKey, searchParams])
  const isDebug = useMemo(() => searchParams.get("debug") === "1", [searchKey, searchParams])
  const { cities } = useCities()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const canFetch = isAuthenticated && !authLoading

  const [activeTab, setActiveTab] = useState<string>(TAB_SUMMARY)
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersValue>({
    dateRange: {},
    cityId: "all",
  })
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFiltersValue>({
    dateRange: {},
    cityId: "all",
  })
  const [compareMode, setCompareMode] = useState<CompareMode>("none")
  const [defaultsApplied, setDefaultsApplied] = useState(false)

  const [adsDailyRows, setAdsDailyRows] = useState<AdsDailyRow[]>([])
  const [anomalyRows, setAnomalyRows] = useState<AdsAnomalyRow[]>([])
  const [creativeRows, setCreativeRows] = useState<AdsCreativeRow[]>([])
  const [metaCreativeRows, setMetaCreativeRows] = useState<MetaCreativeRow[]>([])
  const [metaAdsTopRows, setMetaAdsTopRows] = useState<MetaAdsTopRow[]>([])
  const [metaFatigueRows, setMetaFatigueRows] = useState<MetaCreativeFatigueRow[]>([])
  const [metaCampaignProductRows, setMetaCampaignProductRows] = useState<MetaCampaignProductRow[]>([])
  const [creativeDetailedRows, setCreativeDetailedRows] = useState<CreativeDetailedRow[]>([])
  const [channelMixRows, setChannelMixRows] = useState<ChannelMixRow[]>([])
  const [gadsKeywordDailyRows, setGadsKeywordDailyRows] = useState<GadsKeywordDailyRow[]>([])
  const [gadsSpendRows, setGadsSpendRows] = useState<GadsSpendRow[]>([])
  const [gadsCampaignPreviewRows, setGadsCampaignPreviewRows] = useState<GadsCampaignPreviewRow[]>([])
  const [gadsRequestCampaignRows, setGadsRequestCampaignRows] = useState<GadsRequestsByCampaignRow[]>([])
  const [gadsLeadCampaignRows, setGadsLeadCampaignRows] = useState<GadsLeadsByCampaignRow[]>([])
  const [gadsDeviceRows, setGadsDeviceRows] = useState<GadsDeviceRow[]>([])
  const [gadsConversionRows, setGadsConversionRows] = useState<GadsConversionActionRow[]>([])
  const [gadsAssetGroupRows, setGadsAssetGroupRows] = useState<GadsAssetGroupRow[]>([])
  const [metaRawCreativesRows, setMetaRawCreativesRows] = useState<WidgetRow[]>([])
  const [metaRawDataQualityRows, setMetaRawDataQualityRows] = useState<WidgetRow[]>([])
  const [metaRawFunnelRows, setMetaRawFunnelRows] = useState<WidgetRow[]>([])
  const [metaRawBridgeRows, setMetaRawBridgeRows] = useState<WidgetRow[]>([])
  const [metaRawMatchRows, setMetaRawMatchRows] = useState<WidgetRow[]>([])
  const [ga4TrafficRows, setGa4TrafficRows] = useState<WidgetRow[]>([])
  const [ga4EventsRows, setGa4EventsRows] = useState<WidgetRow[]>([])
  const [ga4CreativeRows, setGa4CreativeRows] = useState<WidgetRow[]>([])
  const [adsMetaFunnelRows, setAdsMetaFunnelRows] = useState<WidgetRow[]>([])
  const [adsMetaLeadsRows, setAdsMetaLeadsRows] = useState<WidgetRow[]>([])
  const [adsMetaQualityRows, setAdsMetaQualityRows] = useState<WidgetRow[]>([])
  const [adsMetaMatchRows, setAdsMetaMatchRows] = useState<WidgetRow[]>([])
  const [adsMetaCplByFormRows, setAdsMetaCplByFormRows] = useState<WidgetRow[]>([])
  const [adsCreativePerformanceRows, setAdsCreativePerformanceRows] = useState<WidgetRow[]>([])
  const [adsCreativeFatigueRows, setAdsCreativeFatigueRows] = useState<WidgetRow[]>([])
  const [adsGadsTopKeywordsRows, setAdsGadsTopKeywordsRows] = useState<WidgetRow[]>([])
  const [metaRawMissing, setMetaRawMissing] = useState<Record<string, boolean>>({})
  const [adsSummaryMissing, setAdsSummaryMissing] = useState<Record<string, boolean>>({})
  const [adsMetaMissing, setAdsMetaMissing] = useState<Record<string, boolean>>({})
  const [adsCreativeMissing, setAdsCreativeMissing] = useState<Record<string, boolean>>({})
  const [adsGadsMissing, setAdsGadsMissing] = useState<Record<string, boolean>>({})
  const [compareRows, setCompareRows] = useState<AdsDailyRow[]>([])
  const [adsKpiRows, setAdsKpiRows] = useState<AdsKpiRow[]>([])
  const [creativeTypeRows, setCreativeTypeRows] = useState<CreativeTypeRow[]>([])

  const [isLoadingDaily, setIsLoadingDaily] = useState(false)
  const [isLoadingAnomalies, setIsLoadingAnomalies] = useState(false)
  const [isLoadingCreatives, setIsLoadingCreatives] = useState(false)
  const [isLoadingMetaCreatives, setIsLoadingMetaCreatives] = useState(false)
  const [isLoadingMetaAdsTop, setIsLoadingMetaAdsTop] = useState(false)
  const [isLoadingMetaFatigue, setIsLoadingMetaFatigue] = useState(false)
  const [isLoadingMetaCampaignProduct, setIsLoadingMetaCampaignProduct] = useState(false)
  const [isLoadingChannelMix, setIsLoadingChannelMix] = useState(false)
  const [isLoadingGadsSpend, setIsLoadingGadsSpend] = useState(false)
  const [isLoadingGadsCampaignPreviews, setIsLoadingGadsCampaignPreviews] = useState(false)
  const [isLoadingGadsRequests, setIsLoadingGadsRequests] = useState(false)
  const [isLoadingGadsLeads, setIsLoadingGadsLeads] = useState(false)
  const [isLoadingGadsKeywordsDaily, setIsLoadingGadsKeywordsDaily] = useState(false)
  const [isLoadingGadsDevices, setIsLoadingGadsDevices] = useState(false)
  const [isLoadingGadsConversions, setIsLoadingGadsConversions] = useState(false)
  const [isLoadingGadsPmax, setIsLoadingGadsPmax] = useState(false)
  const [isLoadingCompare, setIsLoadingCompare] = useState(false)
  const [isLoadingKpi, setIsLoadingKpi] = useState(false)
  const [isLoadingCreativeTypes, setIsLoadingCreativeTypes] = useState(false)
  const [isLoadingSummaryExtras, setIsLoadingSummaryExtras] = useState(false)
  const [isLoadingMetaExtras, setIsLoadingMetaExtras] = useState(false)
  const [isLoadingCreativeExtras, setIsLoadingCreativeExtras] = useState(false)
  const [isLoadingGadsTopKeywords, setIsLoadingGadsTopKeywords] = useState(false)

  const [copiedId, setCopiedId] = useState<string | number | null>(null)
  const [channelMixMissing, setChannelMixMissing] = useState(false)
  const [metaCreativesMissing, setMetaCreativesMissing] = useState(false)
  const [metaAdsTopMissing, setMetaAdsTopMissing] = useState(false)
  const [metaFatigueMissing, setMetaFatigueMissing] = useState(false)
  const [metaCampaignProductMissing, setMetaCampaignProductMissing] = useState(false)
  const [keywordsDailyMissing, setKeywordsDailyMissing] = useState(false)
  const [gadsCampaignPreviewsMissing, setGadsCampaignPreviewsMissing] = useState(false)
  const [gadsRequestsMissing, setGadsRequestsMissing] = useState(false)
  const [gadsLeadsMissing, setGadsLeadsMissing] = useState(false)
  const [devicesMissing, setDevicesMissing] = useState(false)
  const [conversionsMissing, setConversionsMissing] = useState(false)
  const [kpiMissing, setKpiMissing] = useState(false)
  const [creativeTypesMissing, setCreativeTypesMissing] = useState(false)
  const [showAllAnomalies, setShowAllAnomalies] = useState(false)
  const [showAllTopMeta, setShowAllTopMeta] = useState(false)
  const [showAllFatigue, setShowAllFatigue] = useState(false)
  const [showAllTopCreatives, setShowAllTopCreatives] = useState(false)
  const [showAllMetaCampaignProduct, setShowAllMetaCampaignProduct] = useState(false)
  const [showAllKeywordDaily, setShowAllKeywordDaily] = useState(false)
  const [showAllGadsDemandRows, setShowAllGadsDemandRows] = useState(false)
  const [showAllDeviceRows, setShowAllDeviceRows] = useState(false)
  const [showAllConversionRows, setShowAllConversionRows] = useState(false)
  const [creativeSortMode, setCreativeSortMode] = useState<CreativeSortMode>("spend")
  const [adsRange, setAdsRange] = useState<{ min_date?: string | null; max_date?: string | null } | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [widgetMeta, setWidgetMeta] = useState<Record<string, WidgetMeta>>({})
  const [widgetFilters, setWidgetFilters] = useState<Record<string, Record<string, string>>>({})
  const useBatch = true

  useEffect(() => {
    const tab = searchParams.get("tab")
    const allowedTabs = new Set([TAB_SUMMARY, TAB_META, TAB_GADS, TAB_CREATIVES, TAB_PMAX])
    const rawTab = tab && allowedTabs.has(tab) ? tab : TAB_SUMMARY
    const nextTab = rawTab === TAB_CREATIVES ? TAB_META : rawTab
    const compareParam = searchParams.get("compare")
    const nextCompare: CompareMode = compareParam === "wow" ? "wow" : compareParam === "mom" ? "mom" : "none"
    const cityParam = searchParams.get("id_city") ?? searchParams.get("city_id")
    const nextFilters: AnalyticsFiltersValue = {
      dateRange: {
        from: parseDateParam(searchParams.get("date_from")),
        to: parseDateParam(searchParams.get("date_to")),
      },
      cityId: cityParam ?? "all",
    }
    setActiveTab(nextTab)
    setDraftFilters(nextFilters)
    setAppliedFilters(nextFilters)
    setCompareMode(nextCompare)
  }, [searchKey, searchParams])

  useEffect(() => {
    if (!canFetch) return
    if (hasCityParam) return
    const cityId = resolveDefaultCityId(cities)
    if (!cityId) return
    const nextCity = String(cityId)
    setDraftFilters((prev) => ({ ...prev, cityId: nextCity }))
    setAppliedFilters((prev) => ({ ...prev, cityId: nextCity }))
    updateQuery({ id_city: nextCity })
  }, [canFetch, cities, hasCityParam])

  useEffect(() => {
    if (!canFetch) return
    if (defaultsApplied) return
    if (searchParams.get("date_from") || searchParams.get("date_to")) {
      setDefaultsApplied(true)
      return
    }
    let active = true
    const hydrateDefaults = async () => {
      try {
        const range = await fetchWidgetRange("ads.ads_daily")
        if (!active) return
        setAdsRange(range)
        const dateRange = buildLastWeekRange(range.max_date)
        if (!dateRange) {
          setDefaultsApplied(true)
          return
        }
        const nextFilters: AnalyticsFiltersValue = {
          dateRange,
          cityId: draftFilters.cityId,
        }
        setDraftFilters(nextFilters)
        setAppliedFilters(nextFilters)
      } finally {
        if (active) setDefaultsApplied(true)
      }
    }
    hydrateDefaults()
    return () => {
      active = false
    }
  }, [activeTab, defaultsApplied, draftFilters.cityId, searchParams, canFetch])

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
    if (!draftFilters.dateRange.from || !draftFilters.dateRange.to) {
      setDateError("Select a date range to apply filters.")
      return
    }
    setDateError(null)
    setAppliedFilters(draftFilters)
    updateQuery({
      tab: activeTab,
      date_from: draftFilters.dateRange.from ? buildDateKey(draftFilters.dateRange.from) : null,
      date_to: draftFilters.dateRange.to ? buildDateKey(draftFilters.dateRange.to) : null,
      id_city: draftFilters.cityId,
    })
  }

  const resetFilters = () => {
    const cityId = resolveDefaultCityId(cities)
    const nextCity = cityId ? String(cityId) : "all"
    const resetValue: AnalyticsFiltersValue = { dateRange: {}, cityId: nextCity }
    setDraftFilters(resetValue)
    setAppliedFilters(resetValue)
    setCompareMode("none")
    updateQuery({
      tab: activeTab,
      date_from: null,
      date_to: null,
      compare: null,
      id_city: nextCity,
    })
  }

  const handleTabChange = (value: string) => {
    const allowedTabs = new Set([TAB_SUMMARY, TAB_META, TAB_GADS, TAB_PMAX])
    const nextTab = allowedTabs.has(value) ? value : TAB_SUMMARY
    setActiveTab(nextTab)
    updateQuery({ tab: nextTab })
  }

  const baseParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {
      limit: 200,
      offset: 0,
    }
    if (appliedFilters.dateRange.from) {
      params.start_date = buildDateKey(appliedFilters.dateRange.from)
    }
    if (appliedFilters.dateRange.to) {
      params.end_date = buildDateKey(appliedFilters.dateRange.to)
    }
    if (appliedFilters.cityId && appliedFilters.cityId !== "all") {
      params.id_city = Number(appliedFilters.cityId)
    }
    return params
  }, [appliedFilters])

  const widgetParams = useMemo(() => {
    return { ...baseParams } as Record<string, string | number | undefined>
  }, [baseParams])

  const compactWidgetFilters = (filters: Record<string, string | number | null | undefined>) => {
    const next: Record<string, string | number> = {}
    Object.entries(filters).forEach(([key, value]) => {
      if (value == null || value === "" || value === "all") return
      if (key === "id_city" || key === "city_id") {
        const parsed = Number(value)
        if (!Number.isNaN(parsed)) next[key] = parsed
        return
      }
      next[key] = value as string | number
    })
    return next
  }

  const resolveWidgetFilters = (widgetKey: string, base?: Record<string, string | number | null | undefined>) => {
    const local = widgetFilters[widgetKey] ?? {}
    return compactWidgetFilters({ ...(base ?? {}), ...local })
  }

  const metaParams = useMemo(() => ({ ...baseParams, platform: "meta" }), [baseParams])
  const gadsParams = useMemo(() => ({ ...baseParams }), [baseParams])
  const channelParams = useMemo(() => ({ ...baseParams }), [baseParams])
  const shouldLoadMeta = useMemo(() => activeTab === TAB_SUMMARY || activeTab === TAB_META, [activeTab])
  const shouldLoadGads = useMemo(() => activeTab === TAB_SUMMARY || activeTab === TAB_GADS || activeTab === TAB_PMAX, [activeTab])
  const shouldLoadSummary = activeTab === TAB_SUMMARY

  const compareParams = useMemo(() => {
    if (compareMode === "none") return null
    const { from, to } = appliedFilters.dateRange
    if (!from || !to) return null
    const shiftDays = compareMode === "wow" ? 7 : 30
    const prevFrom = addDays(from, -shiftDays)
    const prevTo = addDays(to, -shiftDays)
    return {
      ...widgetParams,
      start_date: buildDateKey(prevFrom),
      end_date: buildDateKey(prevTo),
    }
  }, [compareMode, appliedFilters.dateRange, widgetParams])

  const batchPayload = useMemo(() => {
    if (!useBatch) return null
    if (!appliedFilters.dateRange.from || !appliedFilters.dateRange.to) return null
    const globalFilters: Record<string, string | number | undefined> = {
      start_date: buildDateKey(appliedFilters.dateRange.from),
      end_date: buildDateKey(appliedFilters.dateRange.to),
    }
    if (appliedFilters.cityId && appliedFilters.cityId !== "all") {
      globalFilters.id_city = Number(appliedFilters.cityId)
    }

    const widgets: {
      widget_key: string
      alias?: string
      filters?: Record<string, string | number | undefined>
      limit?: number
      order_by?: string
    }[] = [
      { widget_key: "ads.kpi_total" },
      { widget_key: "ads.ads_daily", order_by: "-spend" },
    ]
    if (compareParams) {
      widgets.push({
        widget_key: "ads.ads_daily",
        alias: "compare.ads_daily",
        filters: {
          start_date: compareParams.start_date as string,
          end_date: compareParams.end_date as string,
        },
        order_by: "-spend",
      })
    }

    if (activeTab === TAB_SUMMARY) {
      widgets.push(
        { widget_key: "ads.channel_mix_daily", filters: resolveWidgetFilters("ads.channel_mix_daily", {}) },
        {
          widget_key: "ads.ads_anomalies_7d",
          filters: resolveWidgetFilters("ads.ads_anomalies_7d", { platform: "meta" }),
          order_by: "-spend_delta_pct",
          limit: showAllAnomalies ? 200 : 50,
        },
        { widget_key: "ads.creative_type_summary", filters: resolveWidgetFilters("ads.creative_type_summary", {}) },
        {
          widget_key: "ads.meta_creative_fatigue_7d",
          filters: resolveWidgetFilters("ads.meta_creative_fatigue_7d", { platform: "meta" }),
          limit: showAllFatigue ? 200 : 50,
        },
        {
          widget_key: "ads.meta_ads_top_daily",
          filters: resolveWidgetFilters("ads.meta_ads_top_daily", { platform: "meta" }),
          limit: showAllTopMeta ? 200 : 50,
        },
        { widget_key: "ga4.traffic_overview_daily", limit: 300 },
        { widget_key: "ga4.events_conversions_daily", order_by: "-conversions", limit: 300 }
      )
    }

    if (activeTab === TAB_META && false) {
      widgets.push(
        {
          widget_key: "ads.meta_ads_top_daily",
          filters: resolveWidgetFilters("ads.meta_ads_top_daily", { platform: "meta" }),
          limit: showAllTopMeta ? 200 : 50,
        },
        {
          widget_key: "ads.creative_type_summary",
          filters: resolveWidgetFilters("ads.creative_type_summary", { platform: "meta" }),
        },
        {
          widget_key: "ads.creatives_detailed",
          filters: resolveWidgetFilters("ads.creatives_detailed", { platform: "meta" }),
          order_by: "-spend",
          limit: showAllTopCreatives ? 200 : 50,
        },
        {
          widget_key: "ads.ads_ad_profile_daily",
          filters: resolveWidgetFilters("ads.ads_ad_profile_daily", { platform: "meta" }),
          limit: showAllTopCreatives ? 200 : 50,
        },
        {
          widget_key: "ads.meta_campaigns_by_product",
          filters: resolveWidgetFilters("ads.meta_campaigns_by_product", { platform: "meta" }),
          order_by: "-revenue_sum",
          limit: showAllMetaCampaignProduct ? 200 : 50,
        },
        {
          widget_key: "ads.meta_creative_fatigue_7d",
          filters: resolveWidgetFilters("ads.meta_creative_fatigue_7d", { platform: "meta" }),
          limit: showAllFatigue ? 200 : 50,
        },
        {
          widget_key: "ads.meta_creatives_daily",
          filters: resolveWidgetFilters("ads.meta_creatives_daily", { platform: "meta" }),
          limit: showAllTopCreatives ? 200 : 50,
        },
        { widget_key: "ads.meta_funnel_daily", filters: resolveWidgetFilters("ads.meta_funnel_daily", { platform: "meta" }) },
        { widget_key: "ads.meta_leads_daily", filters: resolveWidgetFilters("ads.meta_leads_daily", { platform: "meta" }) },
        { widget_key: "ads.meta_data_quality_daily", filters: resolveWidgetFilters("ads.meta_data_quality_daily", { platform: "meta" }) },
        { widget_key: "ads.meta_leads_match_quality_daily", filters: resolveWidgetFilters("ads.meta_leads_match_quality_daily", { platform: "meta" }) },
        { widget_key: "ads.meta_cpl_by_form_daily", filters: resolveWidgetFilters("ads.meta_cpl_by_form_daily", { platform: "meta" }) },
        { widget_key: "meta.creatives_daily", filters: resolveWidgetFilters("meta.creatives_daily", {}) },
        { widget_key: "meta.data_quality_daily", filters: resolveWidgetFilters("meta.data_quality_daily", {}) },
        { widget_key: "meta.funnel_daily", filters: resolveWidgetFilters("meta.funnel_daily", {}) },
        { widget_key: "meta.lead_to_crm_bridge", filters: resolveWidgetFilters("meta.lead_to_crm_bridge", {}) },
        { widget_key: "meta.leads_match_quality_daily", filters: resolveWidgetFilters("meta.leads_match_quality_daily", {}) }
      )
    }

    if (activeTab === TAB_META) {
      widgets.push(
        {
          widget_key: "ads.meta_ads_top_daily",
          filters: resolveWidgetFilters("ads.meta_ads_top_daily", { platform: "meta" }),
          limit: showAllTopMeta ? 200 : 50,
        },
        { widget_key: "ads.creative_type_summary", filters: resolveWidgetFilters("ads.creative_type_summary", {}) },
        { widget_key: "ads.creative_performance_daily", filters: resolveWidgetFilters("ads.creative_performance_daily", {}) },
        { widget_key: "ads.creative_fatigue_daily", filters: resolveWidgetFilters("ads.creative_fatigue_daily", {}) },
        {
          widget_key: "ads.creatives_detailed",
          filters: resolveWidgetFilters("ads.creatives_detailed", {}),
          order_by: "-spend",
          limit: showAllTopCreatives ? 200 : 50,
        },
        {
          widget_key: "ads.meta_creatives_daily",
          filters: resolveWidgetFilters("ads.meta_creatives_daily", { platform: "meta" }),
          limit: showAllTopCreatives ? 200 : 50,
        },
        {
          widget_key: "ads.ads_ad_profile_daily",
          filters: resolveWidgetFilters("ads.ads_ad_profile_daily", { platform: "meta" }),
          limit: showAllTopCreatives ? 200 : 50,
        },
        {
          widget_key: "ads.meta_creative_fatigue_7d",
          filters: resolveWidgetFilters("ads.meta_creative_fatigue_7d", { platform: "meta" }),
          limit: showAllFatigue ? 200 : 50,
        },
        { widget_key: "ga4.ads_creative_performance_daily", order_by: "-spend", limit: 300 },
        { widget_key: "ga4.events_conversions_daily", order_by: "-conversions", limit: 300 }
      )
    }

    if (activeTab === TAB_GADS) {
      widgets.push(
        {
          widget_key: "ads.gads_keywords_daily",
          filters: resolveWidgetFilters("ads.gads_keywords_daily", {}),
          order_by: "-spend",
          limit: showAllKeywordDaily ? 200 : 50,
        },
        {
          widget_key: "ads.gads.top_keywords",
          filters: resolveWidgetFilters("ads.gads.top_keywords", {}),
          order_by: "-spend",
          limit: showAllKeywordDaily ? 200 : 50,
        },
        {
          widget_key: "ads.gads_campaign_previews_daily",
          filters: resolveWidgetFilters("ads.gads_campaign_previews_daily", {}),
          order_by: "-spend",
          limit: 100,
        },
        {
          widget_key: "ads.gads_requests_by_campaign_daily",
          filters: resolveWidgetFilters("ads.gads_requests_by_campaign_daily", {}),
          order_by: "-crm_requests_cnt",
          limit: showAllGadsDemandRows ? 200 : 50,
        },
        {
          widget_key: "ads.gads_leads_by_campaign_daily",
          filters: resolveWidgetFilters("ads.gads_leads_by_campaign_daily", {}),
          order_by: "-leads_cnt",
          limit: showAllGadsDemandRows ? 200 : 50,
        },
        {
          widget_key: "ads.gads_device_hour_daily",
          filters: resolveWidgetFilters("ads.gads_device_hour_daily", {}),
          order_by: "-spend",
          limit: showAllDeviceRows ? 200 : 50,
        },
        {
          widget_key: "ads.gads_conversion_actions_daily",
          filters: resolveWidgetFilters("ads.gads_conversion_actions_daily", {}),
          order_by: "-conversions",
          limit: showAllConversionRows ? 200 : 50,
        },
        { widget_key: "ads.gads.trend", filters: resolveWidgetFilters("ads.gads.trend", {}) },
        { widget_key: "ga4.ads_creative_performance_daily", order_by: "-spend", limit: 300 },
        { widget_key: "ga4.events_conversions_daily", order_by: "-conversions", limit: 300 }
      )
    }

    if (activeTab === TAB_PMAX) {
      widgets.push(
        { widget_key: "ads.gads_pmax_daily", filters: resolveWidgetFilters("ads.gads_pmax_daily", {}) },
        { widget_key: "ads.gads.trend", filters: resolveWidgetFilters("ads.gads.trend", {}) },
        { widget_key: "ga4.ads_creative_performance_daily", order_by: "-spend", limit: 300 }
      )
    }

    return { widgets, global_filters: globalFilters }
  }, [
    activeTab,
    appliedFilters.dateRange.from,
    appliedFilters.dateRange.to,
    compareParams,
    appliedFilters.cityId,
    showAllAnomalies,
    showAllConversionRows,
    showAllDeviceRows,
    showAllFatigue,
    showAllGadsDemandRows,
    showAllKeywordDaily,
    showAllTopCreatives,
    showAllTopMeta,
    showAllMetaCampaignProduct,
    useBatch,
    widgetFilters,
  ])

  useEffect(() => {
    if (!useBatch || !canFetch || !batchPayload) return
    let active = true
    const load = async () => {
      const batchWidgets = new Set(batchPayload.widgets.map((widget) => widget.alias ?? widget.widget_key))
      const resetFlags: Array<() => void> = []
      const markLoading = (key: string, setter: (value: boolean) => void) => {
        if (batchWidgets.has(key)) {
          setter(true)
          resetFlags.push(() => setter(false))
        }
      }
      markLoading("ads.ads_daily", setIsLoadingDaily)
      markLoading("compare.ads_daily", setIsLoadingCompare)
      markLoading("ads.kpi_total", setIsLoadingKpi)
      markLoading("ads.creative_type_summary", setIsLoadingCreativeTypes)
      markLoading("ads.ads_anomalies_7d", setIsLoadingAnomalies)
      markLoading("ads.ads_ad_profile_daily", setIsLoadingCreatives)
      markLoading("ads.meta_creatives_daily", setIsLoadingMetaCreatives)
      markLoading("ads.meta_ads_top_daily", setIsLoadingMetaAdsTop)
      markLoading("ads.meta_campaigns_by_product", setIsLoadingMetaCampaignProduct)
      markLoading("ads.meta_creative_fatigue_7d", setIsLoadingMetaFatigue)
      markLoading("ads.channel_mix_daily", setIsLoadingChannelMix)
      markLoading("ga4.traffic_overview_daily", setIsLoadingSummaryExtras)
      markLoading("ga4.events_conversions_daily", setIsLoadingSummaryExtras)
      markLoading("ga4.ads_creative_performance_daily", setIsLoadingCreativeExtras)
      markLoading("ads.meta_funnel_daily", setIsLoadingMetaExtras)
      markLoading("ads.meta_leads_daily", setIsLoadingMetaExtras)
      markLoading("ads.meta_data_quality_daily", setIsLoadingMetaExtras)
      markLoading("ads.meta_leads_match_quality_daily", setIsLoadingMetaExtras)
      markLoading("ads.meta_cpl_by_form_daily", setIsLoadingMetaExtras)
      markLoading("ads.creative_performance_daily", setIsLoadingCreativeExtras)
      markLoading("ads.creative_fatigue_daily", setIsLoadingCreativeExtras)
      markLoading("ads.gads_requests_by_campaign_daily", setIsLoadingGadsRequests)
      markLoading("ads.gads_leads_by_campaign_daily", setIsLoadingGadsLeads)
      markLoading("ads.gads_keywords_daily", setIsLoadingGadsKeywordsDaily)
      markLoading("ads.gads.top_keywords", setIsLoadingGadsTopKeywords)
      markLoading("ads.gads_campaign_previews_daily", setIsLoadingGadsCampaignPreviews)
      markLoading("ads.gads_device_hour_daily", setIsLoadingGadsDevices)
      markLoading("ads.gads_conversion_actions_daily", setIsLoadingGadsConversions)
      markLoading("ads.gads.trend", setIsLoadingGadsSpend)
      markLoading("ads.gads_pmax_daily", setIsLoadingGadsPmax)

      try {
        const response = await fetchWidgetsBatch(batchPayload)
        if (!active) return
        const items = response.items ?? {}
        const metaUpdates: Record<string, WidgetMeta> = {}
        const getItems = (key: string) => items[key]?.items ?? []

        Object.entries(items).forEach(([key, value]) => {
          if (value?.meta) metaUpdates[key] = value.meta as WidgetMeta
        })
        if (Object.keys(metaUpdates).length > 0) {
          setWidgetMeta((prev) => ({ ...prev, ...metaUpdates }))
        }

        if (items["ads.ads_daily"]) setAdsDailyRows(getItems("ads.ads_daily") as AdsDailyRow[])
        if (items["compare.ads_daily"]) setCompareRows(getItems("compare.ads_daily") as AdsDailyRow[])
        if (!items["compare.ads_daily"] && compareParams) setCompareRows([])
        if (items["ads.kpi_total"]) {
          setKpiMissing(Boolean(items["ads.kpi_total"].missing_view))
          setAdsKpiRows(getItems("ads.kpi_total") as AdsKpiRow[])
        }
        if (items["ads.creative_type_summary"]) {
          setCreativeTypesMissing(Boolean(items["ads.creative_type_summary"].missing_view))
          setCreativeTypeRows(getItems("ads.creative_type_summary") as CreativeTypeRow[])
        }
        if (items["ads.ads_anomalies_7d"]) setAnomalyRows(getItems("ads.ads_anomalies_7d") as AdsAnomalyRow[])
        if (items["ads.ads_ad_profile_daily"]) setCreativeRows(getItems("ads.ads_ad_profile_daily") as AdsCreativeRow[])
        if (items["ads.meta_creatives_daily"]) {
          setMetaCreativesMissing(Boolean(items["ads.meta_creatives_daily"].missing_view))
          setMetaCreativeRows(getItems("ads.meta_creatives_daily") as MetaCreativeRow[])
        }
        if (items["ads.meta_ads_top_daily"]) {
          setMetaAdsTopMissing(Boolean(items["ads.meta_ads_top_daily"].missing_view))
          setMetaAdsTopRows(getItems("ads.meta_ads_top_daily") as MetaAdsTopRow[])
        }
        if (items["ads.meta_campaigns_by_product"]) {
          setMetaCampaignProductMissing(Boolean(items["ads.meta_campaigns_by_product"].missing_view))
          setMetaCampaignProductRows(getItems("ads.meta_campaigns_by_product") as MetaCampaignProductRow[])
        }
        if (items["ads.meta_creative_fatigue_7d"]) {
          setMetaFatigueMissing(Boolean(items["ads.meta_creative_fatigue_7d"].missing_view))
          setMetaFatigueRows(getItems("ads.meta_creative_fatigue_7d") as MetaCreativeFatigueRow[])
        }
        if (items["ads.creatives_detailed"]) setCreativeDetailedRows(getItems("ads.creatives_detailed") as CreativeDetailedRow[])
        if (items["ads.channel_mix_daily"]) {
          setChannelMixMissing(Boolean(items["ads.channel_mix_daily"].missing_view))
          setChannelMixRows(getItems("ads.channel_mix_daily") as ChannelMixRow[])
        }
        if (items["ga4.traffic_overview_daily"]) {
          setGa4TrafficRows(getItems("ga4.traffic_overview_daily"))
          setAdsSummaryMissing((prev) => ({ ...prev, ga4_traffic: Boolean(items["ga4.traffic_overview_daily"].missing_view) }))
        }
        if (items["ga4.events_conversions_daily"]) {
          setGa4EventsRows(getItems("ga4.events_conversions_daily"))
          setAdsSummaryMissing((prev) => ({ ...prev, ga4_events: Boolean(items["ga4.events_conversions_daily"].missing_view) }))
        }
        if (items["ga4.ads_creative_performance_daily"]) {
          setGa4CreativeRows(getItems("ga4.ads_creative_performance_daily"))
          setAdsSummaryMissing((prev) => ({ ...prev, ga4_creatives: Boolean(items["ga4.ads_creative_performance_daily"].missing_view) }))
        }
        if (items["ads.gads_requests_by_campaign_daily"]) {
          setGadsRequestsMissing(Boolean(items["ads.gads_requests_by_campaign_daily"].missing_view))
          setGadsRequestCampaignRows(getItems("ads.gads_requests_by_campaign_daily") as GadsRequestsByCampaignRow[])
        }
        if (items["ads.gads_leads_by_campaign_daily"]) {
          setGadsLeadsMissing(Boolean(items["ads.gads_leads_by_campaign_daily"].missing_view))
          setGadsLeadCampaignRows(getItems("ads.gads_leads_by_campaign_daily") as GadsLeadsByCampaignRow[])
        }
        if (items["ads.gads_keywords_daily"]) {
          setKeywordsDailyMissing(Boolean(items["ads.gads_keywords_daily"].missing_view))
          setGadsKeywordDailyRows(getItems("ads.gads_keywords_daily") as GadsKeywordDailyRow[])
        }
        if (items["ads.gads.top_keywords"]) {
          setAdsGadsTopKeywordsRows(getItems("ads.gads.top_keywords"))
          setAdsGadsMissing((prev) => ({ ...prev, top_keywords: Boolean(items["ads.gads.top_keywords"].missing_view) }))
        }
        if (items["ads.gads_campaign_previews_daily"]) {
          setGadsCampaignPreviewsMissing(Boolean(items["ads.gads_campaign_previews_daily"].missing_view))
          setGadsCampaignPreviewRows(getItems("ads.gads_campaign_previews_daily") as GadsCampaignPreviewRow[])
        }
        if (items["ads.gads_device_hour_daily"]) {
          setDevicesMissing(Boolean(items["ads.gads_device_hour_daily"].missing_view))
          setGadsDeviceRows(getItems("ads.gads_device_hour_daily") as GadsDeviceRow[])
        }
        if (items["ads.gads_conversion_actions_daily"]) {
          setConversionsMissing(Boolean(items["ads.gads_conversion_actions_daily"].missing_view))
          setGadsConversionRows(getItems("ads.gads_conversion_actions_daily") as GadsConversionActionRow[])
        }
        if (items["ads.gads.trend"]) setGadsSpendRows(getItems("ads.gads.trend") as GadsSpendRow[])
        if (items["ads.gads_pmax_daily"]) setGadsAssetGroupRows(getItems("ads.gads_pmax_daily") as GadsAssetGroupRow[])
        if (items["meta.creatives_daily"]) {
          setMetaRawCreativesRows(getItems("meta.creatives_daily"))
          setMetaRawMissing((prev) => ({ ...prev, creatives: Boolean(items["meta.creatives_daily"].missing_view) }))
        }
        if (items["meta.data_quality_daily"]) {
          setMetaRawDataQualityRows(getItems("meta.data_quality_daily"))
          setMetaRawMissing((prev) => ({ ...prev, quality: Boolean(items["meta.data_quality_daily"].missing_view) }))
        }
        if (items["meta.funnel_daily"]) {
          setMetaRawFunnelRows(getItems("meta.funnel_daily"))
          setMetaRawMissing((prev) => ({ ...prev, funnel: Boolean(items["meta.funnel_daily"].missing_view) }))
        }
        if (items["meta.lead_to_crm_bridge"]) {
          setMetaRawBridgeRows(getItems("meta.lead_to_crm_bridge"))
          setMetaRawMissing((prev) => ({ ...prev, bridge: Boolean(items["meta.lead_to_crm_bridge"].missing_view) }))
        }
        if (items["meta.leads_match_quality_daily"]) {
          setMetaRawMatchRows(getItems("meta.leads_match_quality_daily"))
          setMetaRawMissing((prev) => ({ ...prev, match: Boolean(items["meta.leads_match_quality_daily"].missing_view) }))
        }
        if (items["ads.meta_funnel_daily"]) {
          setAdsMetaFunnelRows(getItems("ads.meta_funnel_daily"))
          setAdsMetaMissing((prev) => ({ ...prev, funnel: Boolean(items["ads.meta_funnel_daily"].missing_view) }))
        }
        if (items["ads.meta_leads_daily"]) {
          setAdsMetaLeadsRows(getItems("ads.meta_leads_daily"))
          setAdsMetaMissing((prev) => ({ ...prev, leads: Boolean(items["ads.meta_leads_daily"].missing_view) }))
        }
        if (items["ads.meta_data_quality_daily"]) {
          setAdsMetaQualityRows(getItems("ads.meta_data_quality_daily"))
          setAdsMetaMissing((prev) => ({ ...prev, quality: Boolean(items["ads.meta_data_quality_daily"].missing_view) }))
        }
        if (items["ads.meta_leads_match_quality_daily"]) {
          setAdsMetaMatchRows(getItems("ads.meta_leads_match_quality_daily"))
          setAdsMetaMissing((prev) => ({ ...prev, match: Boolean(items["ads.meta_leads_match_quality_daily"].missing_view) }))
        }
        if (items["ads.meta_cpl_by_form_daily"]) {
          setAdsMetaCplByFormRows(getItems("ads.meta_cpl_by_form_daily"))
          setAdsMetaMissing((prev) => ({ ...prev, cpl_by_form: Boolean(items["ads.meta_cpl_by_form_daily"].missing_view) }))
        }
        if (items["ads.creative_performance_daily"]) {
          setAdsCreativePerformanceRows(getItems("ads.creative_performance_daily"))
          setAdsCreativeMissing((prev) => ({ ...prev, performance: Boolean(items["ads.creative_performance_daily"].missing_view) }))
        }
        if (items["ads.creative_fatigue_daily"]) {
          setAdsCreativeFatigueRows(getItems("ads.creative_fatigue_daily"))
          setAdsCreativeMissing((prev) => ({ ...prev, fatigue: Boolean(items["ads.creative_fatigue_daily"].missing_view) }))
        }
      } catch (error) {
        if (!active) return
        console.error("Failed to load batch widgets:", error)
      } finally {
        if (!active) return
        resetFlags.forEach((reset) => reset())
      }
    }
    load()
    return () => {
      active = false
    }
  }, [batchPayload, canFetch, compareParams, useBatch])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch) return
      setIsLoadingDaily(true)
      try {
        const response = await api.get<WidgetResponse<AdsDailyRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.ads_daily")}`,
          { params: { ...widgetParams, order_by: "-spend" } }
        )
        if (!active) return
        setAdsDailyRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load ads daily:", error)
        setAdsDailyRows([])
      } finally {
        if (active) setIsLoadingDaily(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [widgetParams, canFetch])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch) return
      setIsLoadingKpi(true)
      try {
        const response = await api.get<WidgetResponse<AdsKpiRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.kpi_total")}`,
          { params: { ...widgetParams } }
        )
        if (!active) return
        setKpiMissing(Boolean(response.data.missing_view))
        setAdsKpiRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load ads KPI:", error)
        setKpiMissing(true)
        setAdsKpiRows([])
      } finally {
        if (active) setIsLoadingKpi(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [widgetParams, canFetch])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch) return
      setIsLoadingCreativeTypes(true)
      try {
        const response = await api.get<WidgetResponse<CreativeTypeRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.creative_type_summary")}`,
          { params: { ...baseParams } }
        )
        if (!active) return
        setCreativeTypesMissing(Boolean(response.data.missing_view))
        setCreativeTypeRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load creative type summary:", error)
        setCreativeTypesMissing(true)
        setCreativeTypeRows([])
      } finally {
        if (active) setIsLoadingCreativeTypes(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [baseParams, canFetch])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!compareParams) {
        setCompareRows([])
        return
      }
      if (!canFetch || useBatch) return
      setIsLoadingCompare(true)
      try {
        const response = await api.get<WidgetResponse<AdsDailyRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.ads_daily")}`,
          { params: { ...compareParams, order_by: "-spend" } }
        )
        if (!active) return
        setCompareRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load compare data:", error)
        setCompareRows([])
      } finally {
        if (active) setIsLoadingCompare(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [compareParams, canFetch])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch) return
      setIsLoadingAnomalies(true)
      try {
        const response = await api.get<WidgetResponse<AdsAnomalyRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.ads_anomalies_7d")}`,
          { params: { ...baseParams, order_by: "-spend_delta_pct" } }
        )
        if (!active) return
        setAnomalyRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load anomalies:", error)
        setAnomalyRows([])
      } finally {
        if (active) setIsLoadingAnomalies(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [baseParams, canFetch])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch) return
      setIsLoadingCreatives(true)
      try {
        const response = await api.get<WidgetResponse<AdsCreativeRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.ads_ad_profile_daily")}`,
          { params: { ...widgetParams } }
        )
        if (!active) return
        setCreativeRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load creatives:", error)
        setCreativeRows([])
      } finally {
        if (active) setIsLoadingCreatives(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [widgetParams, canFetch])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadMeta) {
        if (active) setIsLoadingMetaCreatives(false)
        return
      }
      setIsLoadingMetaCreatives(true)
      try {
        const response = await api.get<WidgetResponse<MetaCreativeRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.meta_creatives_daily")}`,
          { params: { ...metaParams } }
        )
        if (!active) return
        setMetaCreativesMissing(Boolean(response.data.missing_view))
        setMetaCreativeRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load meta creatives:", error)
        setMetaCreativesMissing(true)
        setMetaCreativeRows([])
      } finally {
        if (active) setIsLoadingMetaCreatives(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [metaParams, canFetch, shouldLoadMeta])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadMeta) {
        if (active) setIsLoadingMetaAdsTop(false)
        return
      }
      setIsLoadingMetaAdsTop(true)
      try {
        const response = await api.get<WidgetResponse<MetaAdsTopRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.meta_ads_top_daily")}`,
          { params: { ...metaParams } }
        )
        if (!active) return
        setMetaAdsTopMissing(Boolean(response.data.missing_view))
        setMetaAdsTopRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load meta top ads:", error)
        setMetaAdsTopMissing(true)
        setMetaAdsTopRows([])
      } finally {
        if (active) setIsLoadingMetaAdsTop(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [metaParams, canFetch, shouldLoadMeta])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadMeta) {
        if (active) setIsLoadingMetaFatigue(false)
        return
      }
      setIsLoadingMetaFatigue(true)
      try {
        const response = await api.get<WidgetResponse<MetaCreativeFatigueRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.meta_creative_fatigue_7d")}`,
          { params: { ...metaParams } }
        )
        if (!active) return
        setMetaFatigueMissing(Boolean(response.data.missing_view))
        setMetaFatigueRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load meta creative fatigue:", error)
        setMetaFatigueMissing(true)
        setMetaFatigueRows([])
      } finally {
        if (active) setIsLoadingMetaFatigue(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [metaParams, canFetch, shouldLoadMeta])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadSummary) {
        if (active) setIsLoadingChannelMix(false)
        return
      }
      setIsLoadingChannelMix(true)
      try {
        const response = await api.get<WidgetResponse<ChannelMixRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.channel_mix_daily")}`,
          { params: { ...channelParams } }
        )
        if (!active) return
        setChannelMixMissing(Boolean(response.data.missing_view))
        setChannelMixRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load channel mix:", error)
        setChannelMixMissing(true)
        setChannelMixRows([])
      } finally {
        if (active) setIsLoadingChannelMix(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [channelParams, canFetch, shouldLoadSummary])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadGads) {
        if (active) setIsLoadingGadsRequests(false)
        return
      }
      setIsLoadingGadsRequests(true)
      try {
        const response = await api.get<WidgetResponse<GadsRequestsByCampaignRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.gads_requests_by_campaign_daily")}`,
          { params: { ...gadsParams, order_by: "-crm_requests_cnt" } }
        )
        if (!active) return
        setGadsRequestsMissing(Boolean(response.data.missing_view))
        setGadsRequestCampaignRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load gads requests by campaign:", error)
        setGadsRequestsMissing(true)
        setGadsRequestCampaignRows([])
      } finally {
        if (active) setIsLoadingGadsRequests(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [gadsParams, canFetch, shouldLoadGads])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadGads) {
        if (active) setIsLoadingGadsLeads(false)
        return
      }
      setIsLoadingGadsLeads(true)
      try {
        const response = await api.get<WidgetResponse<GadsLeadsByCampaignRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.gads_leads_by_campaign_daily")}`,
          { params: { ...gadsParams, order_by: "-leads_cnt" } }
        )
        if (!active) return
        setGadsLeadsMissing(Boolean(response.data.missing_view))
        setGadsLeadCampaignRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load gads leads by campaign:", error)
        setGadsLeadsMissing(true)
        setGadsLeadCampaignRows([])
      } finally {
        if (active) setIsLoadingGadsLeads(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [gadsParams, canFetch, shouldLoadGads])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadGads) {
        if (active) setIsLoadingGadsKeywordsDaily(false)
        return
      }
      setIsLoadingGadsKeywordsDaily(true)
      try {
        const response = await api.get<WidgetResponse<GadsKeywordDailyRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.gads_keywords_daily")}`,
          { params: { ...gadsParams, order_by: "-spend" } }
        )
        if (!active) return
        setKeywordsDailyMissing(Boolean(response.data.missing_view))
        setGadsKeywordDailyRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load gads keywords daily:", error)
        setKeywordsDailyMissing(true)
        setGadsKeywordDailyRows([])
      } finally {
        if (active) setIsLoadingGadsKeywordsDaily(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [gadsParams, canFetch, shouldLoadGads])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadGads) {
        if (active) setIsLoadingGadsDevices(false)
        return
      }
      setIsLoadingGadsDevices(true)
      try {
        const response = await api.get<WidgetResponse<GadsDeviceRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.gads_device_hour_daily")}`,
          { params: { ...gadsParams, order_by: "-spend" } }
        )
        if (!active) return
        setDevicesMissing(Boolean(response.data.missing_view))
        setGadsDeviceRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load gads device/hour:", error)
        setDevicesMissing(true)
        setGadsDeviceRows([])
      } finally {
        if (active) setIsLoadingGadsDevices(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [gadsParams, canFetch, shouldLoadGads])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadGads) {
        if (active) setIsLoadingGadsConversions(false)
        return
      }
      setIsLoadingGadsConversions(true)
      try {
        const response = await api.get<WidgetResponse<GadsConversionActionRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.gads_conversion_actions_daily")}`,
          { params: { ...gadsParams, order_by: "-conversions" } }
        )
        if (!active) return
        setConversionsMissing(Boolean(response.data.missing_view))
        setGadsConversionRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load gads conversion actions:", error)
        setConversionsMissing(true)
        setGadsConversionRows([])
      } finally {
        if (active) setIsLoadingGadsConversions(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [gadsParams, canFetch, shouldLoadGads])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadGads) {
        if (active) setIsLoadingGadsSpend(false)
        return
      }
      setIsLoadingGadsSpend(true)
      try {
        const response = await api.get<WidgetResponse<GadsSpendRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.gads.trend")}`,
          { params: { ...gadsParams } }
        )
        if (!active) return
        setGadsSpendRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load gads spend:", error)
        setGadsSpendRows([])
      } finally {
        if (active) setIsLoadingGadsSpend(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [gadsParams, canFetch, shouldLoadGads])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch || useBatch || !shouldLoadGads) {
        if (active) setIsLoadingGadsPmax(false)
        return
      }
      setIsLoadingGadsPmax(true)
      try {
        const response = await api.get<WidgetResponse<GadsAssetGroupRow>>(
          `/analytics/widgets/${encodeURIComponent("ads.gads_pmax_daily")}`,
          { params: { ...gadsParams } }
        )
        if (!active) return
        setGadsAssetGroupRows(response.data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load gads pmax:", error)
        setGadsAssetGroupRows([])
      } finally {
        if (active) setIsLoadingGadsPmax(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [gadsParams, canFetch, shouldLoadGads])

  const tabPlatform =
    activeTab === TAB_META
      ? "meta"
      : activeTab === TAB_GADS || activeTab === TAB_PMAX
        ? "gads"
        : null

  const dailyRowsForTab = useMemo(() => {
    if (!tabPlatform) return adsDailyRows
    return adsDailyRows.filter((row) => normalizeKey(row.platform) === tabPlatform)
  }, [adsDailyRows, tabPlatform])

  const compareRowsForTab = useMemo(() => {
    if (!tabPlatform) return compareRows
    return compareRows.filter((row) => normalizeKey(row.platform) === tabPlatform)
  }, [compareRows, tabPlatform])

  const kpiRowsForTab = useMemo(() => {
    if (!tabPlatform) return adsKpiRows
    return adsKpiRows.filter((row) => normalizeKey(row.platform) === tabPlatform)
  }, [adsKpiRows, tabPlatform])

  const kpiParsed = useMemo(() => {
    return parseWidgetRowsSafe(
      kpiRowsForTab.map((row) => camelizeUnknownRecordShallow(row as unknown as WidgetRow)),
      adsKpiTotalRowSchema
    )
  }, [kpiRowsForTab])

  const currencyCode = useMemo(() => {
    const pick = <T extends { currency_code?: string | null }>(rows: T[]) =>
      rows.find((row) => row.currency_code)?.currency_code ?? null
    return (
      pick(kpiRowsForTab) ??
      pick(dailyRowsForTab) ??
      pick(gadsSpendRows) ??
      pick(gadsKeywordDailyRows) ??
      pick(gadsDeviceRows) ??
      pick(gadsConversionRows) ??
      pick(gadsAssetGroupRows) ??
      pick(metaCreativeRows) ??
      pick(metaAdsTopRows) ??
      pick(metaFatigueRows) ??
      null
    )
  }, [
    dailyRowsForTab,
    gadsAssetGroupRows,
    gadsConversionRows,
    gadsDeviceRows,
    gadsKeywordDailyRows,
    gadsSpendRows,
    kpiRowsForTab,
    metaAdsTopRows,
    metaCreativeRows,
    metaFatigueRows,
  ])

  const formatMoney = (value: number | string | null | undefined) =>
    formatCurrency(value ?? null, { currencyCode: currencyCode ?? undefined })

  const kpiTrendData = useMemo(() => {
    const bucket = new Map<
      string,
      {
        date: string
        spend: number
        clicks: number
        platformLeads: number
        crmRequests: number
        contracts: number
        revenue: number
        payments: number
        impressions: number
        conversionValue: number
      }
    >()

    if (kpiParsed.items.length > 0) {
      kpiParsed.items.forEach((row) => {
        const date = String(row.dateKey ?? row.dayKey ?? "")
        if (!date) return
        const entry =
          bucket.get(date) ??
          {
            date,
            spend: 0,
            clicks: 0,
            platformLeads: 0,
            crmRequests: 0,
            contracts: 0,
            revenue: 0,
            payments: 0,
            impressions: 0,
            conversionValue: 0,
          }
        entry.spend += row.spend ?? 0
        entry.clicks += row.clicks ?? 0
        const platformLeads = row.platformLeads ?? row.conversions ?? 0
        entry.platformLeads += platformLeads
        entry.crmRequests += row.crmRequestsCnt ?? 0
        entry.contracts += row.contractsCnt ?? 0
        entry.revenue += row.revenueSum ?? row.revenueTotalCost ?? 0
        entry.payments += row.paymentsSum ?? row.paidSum ?? 0
        entry.impressions += row.impressions ?? 0
        entry.conversionValue += row.conversionValue ?? 0
        bucket.set(date, entry)
      })
      return Array.from(bucket.values()).sort((a, b) => a.date.localeCompare(b.date))
    }

    // Fallback: if KPI view is missing, build a basic trend from ads_daily.
    dailyRowsForTab.forEach((row) => {
      const date = resolveDateKey(row as { date_key?: string | null; dateKey?: string | null })
      if (!date) return
      const entry =
        bucket.get(date) ??
        {
          date,
          spend: 0,
          clicks: 0,
          platformLeads: 0,
          crmRequests: 0,
          contracts: 0,
          revenue: 0,
          payments: 0,
          impressions: 0,
          conversionValue: 0,
        }
      entry.spend += toNumber((row as { spend?: number | null }).spend) ?? 0
      entry.clicks += toNumber((row as { clicks?: number | null }).clicks) ?? 0
      const platformLeads = toNumber((row as { conversions?: number | null }).conversions) ?? 0
      entry.platformLeads += platformLeads
      entry.impressions += toNumber((row as { impressions?: number | null }).impressions) ?? 0
      bucket.set(date, entry)
    })

    return Array.from(bucket.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyRowsForTab, kpiParsed.items])

  const filteredAnomalies = useMemo(() => {
    const rows = anomalyRows.filter(
      (row) =>
        row.spend_delta_pct != null ||
        row.clicks_delta_pct != null ||
        row.conv_delta_pct != null ||
        row.impr_delta_pct != null
    )
    return rows.sort((a, b) => {
      const aValue = Math.abs(toNumber(a.spend_delta_pct) ?? 0)
      const bValue = Math.abs(toNumber(b.spend_delta_pct) ?? 0)
      return bValue - aValue
    })
  }, [anomalyRows])

  const totals = useMemo(() => {
    if (kpiParsed.items.length > 0) {
      return kpiParsed.items.reduce<TotalsAccumulator>(
        (acc, row) => {
          acc.spend += row.spend ?? 0
          acc.clicks += row.clicks ?? 0
          acc.impressions += row.impressions ?? 0
          const platformLeads = row.platformLeads ?? row.conversions ?? 0
          acc.conversions += platformLeads
          acc.platformLeads += platformLeads
          acc.crmRequests += row.crmRequestsCnt ?? 0
          acc.contracts += row.contractsCnt ?? 0
          acc.revenue += row.revenueSum ?? row.revenueTotalCost ?? 0
          acc.payments += row.paymentsSum ?? row.paidSum ?? 0
          acc.conversionValue += row.conversionValue ?? 0
          return acc
        },
        {
          spend: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
          platformLeads: 0,
          crmRequests: 0,
          contracts: 0,
          revenue: 0,
          payments: 0,
          conversionValue: 0,
        }
      )
    }

    // Fallback totals from daily (platform only).
    return dailyRowsForTab.reduce<TotalsAccumulator>(
      (acc, row) => {
        acc.spend += toNumber((row as { spend?: number | null }).spend) ?? 0
        acc.clicks += toNumber((row as { clicks?: number | null }).clicks) ?? 0
        const platformLeads = toNumber((row as { conversions?: number | null }).conversions) ?? 0
        acc.conversions += platformLeads
        acc.platformLeads += platformLeads
        acc.impressions += toNumber((row as { impressions?: number | null }).impressions) ?? 0
        return acc
      },
      {
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        platformLeads: 0,
        crmRequests: 0,
        contracts: 0,
        revenue: 0,
        payments: 0,
        conversionValue: 0,
      }
    )
  }, [dailyRowsForTab, kpiParsed.items])

  const hasCrmLeadsData = useMemo(() => {
    if (kpiParsed.items.length > 0) {
      return kpiParsed.items.some((row) => row.crmRequestsCnt != null && row.crmRequestsCnt > 0)
    }
    const hasInDaily = dailyRowsForTab.some((row) => (row as { crm_requests_cnt?: number | null }).crm_requests_cnt != null)
    return hasInDaily
  }, [dailyRowsForTab, kpiParsed.items])

  const hasCrmOutcomesData = useMemo(() => {
    if (kpiParsed.items.length > 0) {
      return kpiParsed.items.some(
        (row) =>
          (row.contractsCnt ?? 0) > 0 ||
          (row.revenueSum ?? row.revenueTotalCost ?? 0) > 0 ||
          (row.paymentsSum ?? row.paidSum ?? 0) > 0
      )
    }
    return false
  }, [kpiParsed.items])

  const platformLeadsIsFractional = totals.platformLeads != null && Math.abs(totals.platformLeads % 1) > 0.001

  const compareTotals = useMemo(() => {
    return compareRowsForTab.reduce<TotalsAccumulator>(
      (acc, row) => {
        acc.spend += toNumber(row.spend) ?? 0
        acc.clicks += toNumber(row.clicks) ?? 0
        const platformLeads =
          toNumber((row as { platform_leads?: number | null }).platform_leads) ??
          toNumber((row as { conversions?: number | null }).conversions) ??
          0
        acc.conversions += platformLeads
        acc.platformLeads += platformLeads
        acc.impressions += toNumber(row.impressions) ?? 0
        acc.conversionValue += toNumber((row as { conversion_value?: number | null }).conversion_value) ?? 0
        return acc
      },
      {
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        platformLeads: 0,
        crmRequests: 0,
        contracts: 0,
        revenue: 0,
        payments: 0,
        conversionValue: 0,
      }
    )
  }, [compareRowsForTab])

  const dailyRoas = totals.spend > 0 ? totals.revenue / totals.spend : null
  const totalCtr = totals.impressions > 0 ? totals.clicks / totals.impressions : null
  const compareCtr = compareTotals.impressions > 0 ? compareTotals.clicks / compareTotals.impressions : null
  const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : null
  const compareCpc = compareTotals.clicks > 0 ? compareTotals.spend / compareTotals.clicks : null
  const totalCpa = totals.platformLeads > 0 ? totals.spend / totals.platformLeads : null
  const compareCpa = compareTotals.platformLeads > 0 ? compareTotals.spend / compareTotals.platformLeads : null
  const totalCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null
  const compareCpm = compareTotals.impressions > 0 ? (compareTotals.spend / compareTotals.impressions) * 1000 : null

  const tabKpiCards = useMemo(
    () => [
      { label: "Spend", value: totals.spend, format: (v: number | null) => formatMoney(v ?? null) },
      { label: "Impr", value: totals.impressions, format: (v: number | null) => formatNumber(v ?? null) },
      { label: "Clicks", value: totals.clicks, format: (v: number | null) => formatNumber(v ?? null) },
      { label: "Leads", value: totals.platformLeads, format: (v: number | null) => formatNumber(v ?? null) },
      { label: "CTR", value: totalCtr, format: (v: number | null) => formatPercent(v ?? null) },
      { label: "CPL", value: totalCpa, format: (v: number | null) => formatMoney(v ?? null) },
      {
        label: "CRM leads",
        value: hasCrmLeadsData ? totals.crmRequests : null,
        format: (v: number | null) => formatNumber(v ?? null),
        note: hasCrmLeadsData ? null : "Attribution not linked",
      },
    ],
    [formatMoney, hasCrmLeadsData, totalCpa, totalCtr, totals.clicks, totals.crmRequests, totals.impressions, totals.platformLeads, totals.spend]
  )

  const kpiSparklines = useMemo(
    () => ({
      spend: kpiTrendData.map((row) => ({ value: row.spend })),
      clicks: kpiTrendData.map((row) => ({ value: row.clicks })),
      platformLeads: kpiTrendData.map((row) => ({ value: row.platformLeads })),
      crmRequests: kpiTrendData.map((row) => ({ value: row.crmRequests })),
      contracts: kpiTrendData.map((row) => ({ value: row.contracts })),
      revenue: kpiTrendData.map((row) => ({ value: row.revenue })),
      payments: kpiTrendData.map((row) => ({ value: row.payments })),
      impressions: kpiTrendData.map((row) => ({ value: row.impressions })),
      roas: kpiTrendData.map((row) => {
        if (!row.spend) return { value: null }
        const base = row.revenue > 0 ? row.revenue : row.conversionValue > 0 ? row.conversionValue : row.platformLeads
        return { value: base / row.spend }
      }),
      cac: kpiTrendData.map((row) => ({ value: row.contracts ? row.spend / row.contracts : null })),
      payback: kpiTrendData.map((row) => ({ value: row.revenue ? row.payments / row.revenue : null })),
      linkRate: kpiTrendData.map((row) => ({
        value: row.platformLeads ? row.crmRequests / row.platformLeads : null,
      })),
      requestToContractRate: kpiTrendData.map((row) => ({
        value: row.crmRequests ? row.contracts / row.crmRequests : null,
      })),
      ctr: kpiTrendData.map((row) => ({ value: row.impressions ? row.clicks / row.impressions : null })),
      cpa: kpiTrendData.map((row) => ({ value: row.platformLeads ? row.spend / row.platformLeads : null })),
      cpc: kpiTrendData.map((row) => ({ value: row.clicks ? row.spend / row.clicks : null })),
      cpm: kpiTrendData.map((row) => ({ value: row.impressions ? (row.spend / row.impressions) * 1000 : null })),
    }),
    [kpiTrendData]
  )

  const lastLoadTimestamp = useMemo(() => {
    const timestamps = dailyRowsForTab
      .map((row) => row.load_timestamp)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => !Number.isNaN(value))
    if (!timestamps.length) return null
    return new Date(Math.max(...timestamps))
  }, [dailyRowsForTab])

  const gadsConversionsTotal = useMemo(() => {
    return gadsSpendRows.reduce((sum, row) => sum + (toNumber(row.conversions) ?? 0), 0)
  }, [gadsSpendRows])

  const gadsDemandMissing = gadsRequestsMissing && gadsLeadsMissing

  const readinessWarnings = useMemo(() => {
    const warnings: string[] = []
    if (kpiMissing) warnings.push("KPI view missing — using daily aggregates.")
    if (!hasCrmLeadsData) warnings.push("CRM leads attribution is not linked.")
    if (hasCrmLeadsData && !hasCrmOutcomesData) warnings.push("CRM outcomes (contracts/payments/revenue) are missing.")
    if (conversionsMissing && gadsConversionsTotal > 0) {
      warnings.push("GAds conversions exist, but conversion actions dim is missing.")
    }
    if (creativeTypesMissing) warnings.push("Creative type summary not available.")
    return warnings
  }, [creativeTypesMissing, conversionsMissing, gadsConversionsTotal, hasCrmLeadsData, hasCrmOutcomesData, kpiMissing])

  const ga4TrafficSummary = useMemo(() => {
    type Ga4TrafficSummary = {
      sessions: number
      users: number
      engagedSessions: number
      conversions: number
      revenue: number
    }

    return ga4TrafficRows.reduce<Ga4TrafficSummary>(
      (acc, row) => {
        const sessions = metricNumber(row, ["sessions", "session_cnt", "session_count"]) ?? 0
        const users = metricNumber(row, ["total_users", "active_users", "activeUsers"]) ?? 0
        const engaged = metricNumber(row, ["engaged_sessions", "engagedSessions"]) ?? 0
        const conversions = metricNumber(row, ["conversions", "conversion_cnt"]) ?? 0
        const revenue = metricNumber(row, ["purchase_revenue", "revenue"]) ?? 0
        acc.sessions += sessions
        acc.users += users
        acc.engagedSessions += engaged
        acc.conversions += conversions
        acc.revenue += revenue
        return acc
      },
      { sessions: 0, users: 0, engagedSessions: 0, conversions: 0, revenue: 0 }
    )
  }, [ga4TrafficRows])

  const ga4EngagementRate = ga4TrafficSummary.sessions > 0
    ? ga4TrafficSummary.engagedSessions / ga4TrafficSummary.sessions
    : null

  const ga4EventsTop = useMemo(() => {
    return ga4EventsRows
      .map((row) => ({
        eventName: String(pickRowValue(row, ["event_name", "event"]) ?? "Event"),
        platform: String(pickRowValue(row, ["platform"]) ?? ""),
        channelGroup: String(pickRowValue(row, ["channel_group"]) ?? ""),
        conversions: metricNumber(row, ["conversions", "conversion_cnt"]) ?? 0,
        revenue: metricNumber(row, ["purchase_revenue", "revenue"]) ?? 0,
      }))
      .sort((a, b) => b.conversions - a.conversions)
  }, [ga4EventsRows])

  const ga4MetaEvents = useMemo(() => {
    return ga4EventsTop
      .filter((row) => normalizeGa4Platform(row.platform) === "meta")
      .slice(0, 8)
  }, [ga4EventsTop])

  const ga4GadsEvents = useMemo(() => {
    return ga4EventsTop
      .filter((row) => normalizeGa4Platform(row.platform) === "gads")
      .slice(0, 8)
  }, [ga4EventsTop])

  const ga4CreativeTop = useMemo(() => {
    return ga4CreativeRows
      .map((row) => {
        const campaignName = String(pickRowValue(row, ["campaign_name"]) ?? "Campaign")
        const adGroupName = String(pickRowValue(row, ["ad_group_name"]) ?? "Ad group")
        const creativeId = String(pickRowValue(row, ["creative_id"]) ?? "Creative")
        const campaignType = String(pickRowValue(row, ["campaign_type"]) ?? "—")
        const networkType = String(pickRowValue(row, ["ad_network_type"]) ?? "—")
        const impressions = metricNumber(row, ["impressions"]) ?? 0
        const clicks = metricNumber(row, ["clicks"]) ?? 0
        const spend = metricNumber(row, ["spend"]) ?? 0
        const users = metricNumber(row, ["total_users"]) ?? 0
        const revenue = metricNumber(row, ["revenue", "purchase_revenue"]) ?? 0
        return {
          campaignName,
          adGroupName,
          creativeId,
          campaignType,
          networkType,
          impressions,
          clicks,
          spend,
          users,
          revenue,
          ctr: impressions > 0 ? clicks / impressions : null,
          roas: spend > 0 ? revenue / spend : null,
          isPmax: isGa4PmaxRow(row),
        }
      })
      .sort((a, b) => b.spend - a.spend)
  }, [ga4CreativeRows])

  const ga4PmaxCreativeTop = useMemo(() => ga4CreativeTop.filter((row) => row.isPmax).slice(0, 8), [ga4CreativeTop])
  const ga4SearchCreativeTop = useMemo(() => ga4CreativeTop.filter((row) => !row.isPmax).slice(0, 8), [ga4CreativeTop])

  const metaCreativeBase = creativeRows.length > 0 ? creativeRows : metaCreativeRows
  const metaCreativeFiltered = useMemo(() => {
    return metaCreativeBase.filter((row) => {
      const platform = (row as { platform?: string | null }).platform
      if (!platform) return tabPlatform === TAB_GADS ? false : true
      return normalizeKey(platform) === "meta"
    })
  }, [metaCreativeBase, tabPlatform])

  const creativeTypeSummary = useMemo(() => {
    if (creativeTypeRows.length > 0) {
      return creativeTypeRows
        .map((row) => {
          const spend = toNumber(row.spend) ?? 0
          const impressions = toNumber(row.impressions) ?? 0
          const clicks = toNumber(row.clicks) ?? 0
          const leads = toNumber(row.leads) ?? 0
          const ctr = row.ctr ?? (impressions > 0 ? clicks / impressions : null)
          const cpl = row.cpl ?? (leads > 0 ? spend / leads : null)
          return {
            type: row.object_type ?? "unknown",
            count: null,
            share: toNumber(row.spend_share_7d),
            spend,
            clicks,
            impressions,
            leads,
            results: leads,
            ctr,
            cpc: clicks > 0 ? spend / clicks : null,
            cpl,
            cpa: cpl,
            cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
          }
        })
        .sort((a, b) => b.spend - a.spend)
    }
    const bucket = new Map<
      string,
      {
        type: string
        count: number
        spend: number
        clicks: number
        impressions: number
        leads: number
        results: number
      }
    >()
    metaCreativeFiltered.forEach((row) => {
      const type = (pickValue(row, ["creative_type", "object_type"]) as string | null) ?? "unknown"
      const entry = bucket.get(type) ?? {
        type,
        count: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        leads: 0,
        results: 0,
      }
      const conversions = toNumber((row as { conversions?: number | null }).conversions) ?? 0
      const leads =
        toNumber((row as { leads?: number | null }).leads) ??
        toNumber((row as { fb_leads?: number | null }).fb_leads) ??
        0
      const results = conversions > 0 ? conversions : leads
      entry.count += 1
      entry.spend += toNumber((row as { spend?: number | null }).spend) ?? 0
      entry.clicks += toNumber((row as { clicks?: number | null }).clicks) ?? 0
      entry.impressions += toNumber((row as { impressions?: number | null }).impressions) ?? 0
      entry.leads += leads
      entry.results += results
      bucket.set(type, entry)
    })
    return Array.from(bucket.values())
      .map((row) => ({
        ...row,
        share: null,
        ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
        cpc: row.clicks > 0 ? row.spend / row.clicks : null,
        cpl: row.leads > 0 ? row.spend / row.leads : null,
        cpa: row.results > 0 ? row.spend / row.results : null,
        cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : null,
      }))
      .sort((a, b) => b.spend - a.spend)
  }, [creativeTypeRows, metaCreativeFiltered])

  const creativeTypeRanking = useMemo(() => {
    const byCtr = creativeTypeSummary.filter((row) => row.ctr != null)
    const byCpa = creativeTypeSummary.filter((row) => row.cpa != null)
    const bestCtr = [...byCtr].sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0))[0] ?? null
    const bestCpa = [...byCpa].sort((a, b) => (a.cpa ?? Infinity) - (b.cpa ?? Infinity))[0] ?? null
    return { bestCtr, bestCpa }
  }, [creativeTypeSummary])

  const metaCreativeAggregated = useMemo(() => {
    const bucket = new Map<string, MetaCreativeRow>()
    metaCreativeFiltered.forEach((row) => {
      const key = String(
        row.creative_key ??
          row.creative_id ??
          row.ad_id ??
          row.ad_name ??
          row.creative_title ??
          "creative"
      )
      const existing = bucket.get(key)
      const spend = (toNumber(existing?.spend) ?? 0) + (toNumber(row.spend) ?? 0)
      const clicks = (toNumber(existing?.clicks) ?? 0) + (toNumber(row.clicks) ?? 0)
      const impressions = (toNumber(existing?.impressions) ?? 0) + (toNumber(row.impressions) ?? 0)
      const leads = (toNumber(existing?.leads) ?? 0) + (toNumber(row.leads) ?? 0)
      const purchases = (toNumber(existing?.purchases) ?? 0) + (toNumber(row.purchases) ?? 0)
      bucket.set(key, {
        ...row,
        ...existing,
        spend,
        clicks,
        impressions,
        leads,
        purchases,
        creative_title: existing?.creative_title ?? row.creative_title,
        creative_name: existing?.creative_name ?? row.creative_name,
        ad_name: existing?.ad_name ?? row.ad_name,
        preview_image_url:
          existing?.preview_image_url ?? row.preview_image_url ?? row.thumbnail_url ?? row.media_image_src,
        permalink_url: existing?.permalink_url ?? row.permalink_url ?? row.link_url,
        link_url: existing?.link_url ?? row.link_url,
        campaign_name: existing?.campaign_name ?? row.campaign_name,
        adset_name: existing?.adset_name ?? row.adset_name,
      })
    })
    return Array.from(bucket.values())
  }, [metaCreativeFiltered])

  const creativePreviewMap = useMemo(() => {
    const map = new Map<string, CreativePreviewEntry>()
    metaCreativeBase.forEach((row) => {
      upsertCreativePreview(map, row as CreativePreviewSource)
    })
    return map
  }, [metaCreativeBase])

  const placementSummary = useMemo(() => {
    const bucket = new Map<
      string,
      {
        label: string
        spend: number
        clicks: number
        impressions: number
        leads: number
      }
    >()
    metaCreativeFiltered.forEach((row) => {
      const label = row.publisher_platform ?? row.placement ?? "Unknown"
      const key = normalizeKey(label) || "unknown"
      const entry = bucket.get(key) ?? {
        label,
        spend: 0,
        clicks: 0,
        impressions: 0,
        leads: 0,
      }
      entry.spend += toNumber(row.spend) ?? 0
      entry.clicks += toNumber(row.clicks) ?? 0
      entry.impressions += toNumber(row.impressions) ?? 0
      entry.leads += toNumber(row.leads) ?? 0
      bucket.set(key, entry)
    })
    const rows = Array.from(bucket.values()).sort((a, b) => b.spend - a.spend)
    const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0)
    return { rows: rows.slice(0, 6), totalSpend }
  }, [metaCreativeFiltered])

  const creativeDetailedAggregated = useMemo(() => {
    if (creativeDetailedRows.length === 0) return []
    const bucket = new Map<string, CreativeDetailedRow>()
    creativeDetailedRows.forEach((row) => {
      const key = String(
        row.creative_key ??
          row.creative_id ??
          row.ad_name ??
          row.creative_title ??
          row.campaign_name ??
          "creative"
      )
      const existing = bucket.get(key)
      const previewFallback = resolveCreativePreview(creativePreviewMap, row as CreativePreviewSource)
      const spend = (toNumber(existing?.spend) ?? 0) + (toNumber(row.spend) ?? 0)
      const clicks = (toNumber(existing?.clicks) ?? 0) + (toNumber(row.clicks) ?? 0)
      const impressions = (toNumber(existing?.impressions) ?? 0) + (toNumber(row.impressions) ?? 0)
      const leads = (toNumber(existing?.leads_cnt) ?? 0) + (toNumber(row.leads_cnt) ?? 0)
      const contracts = (toNumber(existing?.contracts_cnt) ?? 0) + (toNumber(row.contracts_cnt) ?? 0)
      const revenue = (toNumber(existing?.revenue_sum) ?? 0) + (toNumber(row.revenue_sum) ?? 0)
      bucket.set(key, {
        ...row,
        ...existing,
        spend,
        clicks,
        impressions,
        leads_cnt: leads,
        contracts_cnt: contracts,
        revenue_sum: revenue,
        creative_title: existing?.creative_title ?? row.creative_title ?? previewFallback?.creativeTitle,
        creative_type: existing?.creative_type ?? row.creative_type,
        product_name: existing?.product_name ?? row.product_name,
        product_group: existing?.product_group ?? row.product_group,
        preview_image_url:
          existing?.preview_image_url ??
          row.preview_image_url ??
          row.thumbnail_url ??
          previewFallback?.previewImageUrl,
        permalink_url: existing?.permalink_url ?? row.permalink_url ?? previewFallback?.permalinkUrl,
        campaign_name: existing?.campaign_name ?? row.campaign_name,
        adset_name: existing?.adset_name ?? row.adset_name,
        ad_name: existing?.ad_name ?? row.ad_name,
      })
    })
    return Array.from(bucket.values())
  }, [creativeDetailedRows, creativePreviewMap])

  const topCreatives = useMemo(() => {
    const baseSource = creativeDetailedAggregated.length > 0 ? creativeDetailedAggregated : metaCreativeAggregated
    const filtered = baseSource.filter((row) => {
      const spend = toNumber((row as { spend?: number | null }).spend) ?? 0
      const clicks = toNumber((row as { clicks?: number | null }).clicks) ?? 0
      const impressions = toNumber((row as { impressions?: number | null }).impressions) ?? 0
      return spend > 0 || clicks > 0 || impressions > 0
    })
    const base = filtered.length > 0 ? filtered : baseSource
    return [...base].sort((a, b) => {
      const spendA = toNumber((a as { spend?: number | null }).spend) ?? 0
      const spendB = toNumber((b as { spend?: number | null }).spend) ?? 0
      const leadsA =
        toNumber((a as { leads_cnt?: number | null }).leads_cnt) ??
        toNumber((a as { leads?: number | null }).leads) ??
        toNumber((a as { conversions?: number | null }).conversions) ??
        0
      const leadsB =
        toNumber((b as { leads_cnt?: number | null }).leads_cnt) ??
        toNumber((b as { leads?: number | null }).leads) ??
        toNumber((b as { conversions?: number | null }).conversions) ??
        0
      const contractsA = toNumber((a as { contracts_cnt?: number | null }).contracts_cnt) ?? 0
      const contractsB = toNumber((b as { contracts_cnt?: number | null }).contracts_cnt) ?? 0
      const revenueA = toNumber((a as { revenue_sum?: number | null }).revenue_sum) ?? 0
      const revenueB = toNumber((b as { revenue_sum?: number | null }).revenue_sum) ?? 0
      const impressionsA = toNumber((a as { impressions?: number | null }).impressions) ?? 0
      const clicksA = toNumber((a as { clicks?: number | null }).clicks) ?? 0
      const impressionsB = toNumber((b as { impressions?: number | null }).impressions) ?? 0
      const clicksB = toNumber((b as { clicks?: number | null }).clicks) ?? 0
      const ctrA =
        (a as { ctr?: number | null }).ctr ??
        (impressionsA > 0 ? clicksA / impressionsA : 0)
      const ctrB =
        (b as { ctr?: number | null }).ctr ??
        (impressionsB > 0 ? clicksB / impressionsB : 0)
      const roasA =
        (a as { roas?: number | null }).roas ??
        (spendA > 0 ? revenueA / spendA : 0)
      const roasB =
        (b as { roas?: number | null }).roas ??
        (spendB > 0 ? revenueB / spendB : 0)
      if (creativeSortMode === "leads") return leadsB - leadsA
      if (creativeSortMode === "contracts") return contractsB - contractsA
      if (creativeSortMode === "roas") return roasB - roasA
      if (creativeSortMode === "ctr") return ctrB - ctrA
      return spendB - spendA
    })
  }, [creativeDetailedAggregated, creativeSortMode, metaCreativeAggregated])

  const metaAdsTopAggregated = useMemo(() => {
    const bucket = new Map<string, MetaAdsTopRow>()
    metaAdsTopRows.forEach((row) => {
      const key = String(
        row.ad_id ??
          row.ad_name ??
          row.creative_title ??
          row.campaign_id ??
          row.adset_id ??
          "ad"
      )
      const existing = bucket.get(key)
      const previewFallback = resolveCreativePreview(creativePreviewMap, row as CreativePreviewSource)
      const spend = (toNumber(existing?.spend) ?? 0) + (toNumber(row.spend) ?? 0)
      const fbLeads = (toNumber(existing?.fb_leads) ?? 0) + (toNumber(row.fb_leads) ?? 0)
      const crmLeads = (toNumber(existing?.crm_requests_cnt) ?? 0) + (toNumber(row.crm_requests_cnt) ?? 0)
      const contracts = (toNumber(existing?.contracts_cnt) ?? 0) + (toNumber(row.contracts_cnt) ?? 0)
      const paidSum = (toNumber(existing?.paid_sum) ?? 0) + (toNumber(row.paid_sum) ?? 0)
      bucket.set(key, {
        ...row,
        ...existing,
        spend,
        fb_leads: fbLeads,
        crm_requests_cnt: crmLeads,
        contracts_cnt: contracts,
        paid_sum: paidSum,
        ad_name: existing?.ad_name ?? row.ad_name,
        creative_title: existing?.creative_title ?? row.creative_title ?? previewFallback?.creativeTitle,
        creative_body: existing?.creative_body ?? row.creative_body,
        preview_image_url:
          existing?.preview_image_url ??
          row.preview_image_url ??
          row.thumbnail_url ??
          row.media_image_src ??
          previewFallback?.previewImageUrl,
        permalink_url:
          existing?.permalink_url ??
          row.permalink_url ??
          row.link_url ??
          previewFallback?.permalinkUrl,
        link_url: existing?.link_url ?? row.link_url,
        campaign_name: existing?.campaign_name ?? row.campaign_name,
        adset_name: existing?.adset_name ?? row.adset_name,
      })
    })
    return Array.from(bucket.values())
  }, [metaAdsTopRows, creativePreviewMap])

  const topMetaResultRows = useMemo(() => {
    const filtered = metaAdsTopAggregated.filter((row) => {
      const leads = (toNumber(row.crm_requests_cnt) ?? 0) || (toNumber(row.fb_leads) ?? 0)
      const contracts = toNumber(row.contracts_cnt) ?? 0
      const hasLabel = Boolean(row.ad_name || row.creative_title || row.creative_body || row.ad_id)
      return hasLabel && (leads > 0 || contracts > 0)
    })
    const base = filtered.length > 0 ? filtered : metaAdsTopAggregated
    return [...base]
      .sort((a, b) => {
        const aScore =
          (toNumber(a.contracts_cnt) ?? 0) ||
          (toNumber(a.crm_requests_cnt) ?? 0) ||
          (toNumber(a.fb_leads) ?? 0)
        const bScore =
          (toNumber(b.contracts_cnt) ?? 0) ||
          (toNumber(b.crm_requests_cnt) ?? 0) ||
          (toNumber(b.fb_leads) ?? 0)
        return bScore - aScore
      })
      .slice(0, 8)
  }, [metaAdsTopAggregated])

  const adsByPlatform = useMemo((): AdsByPlatformRow[] => {
    const bucket = new Map<
      string,
      {
        ad_id: string | number | null
        campaign_name: string
        adset_name: string
        ad_name: string
        spend: number
        clicks: number
        impressions: number
        conversions: number
      }
    >()
    dailyRowsForTab.forEach((row) => {
      const adId = row.ad_id ?? `${row.campaign_id ?? "campaign"}-${row.adset_id ?? "adset"}-${row.ad_name ?? "ad"}`
      const key = String(adId)
      const entry = bucket.get(key) ?? {
        ad_id: row.ad_id ?? null,
        campaign_name: row.campaign_name ?? "Campaign",
        adset_name: row.adset_name ?? "Adset",
        ad_name: row.ad_name ?? "Ad",
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
      }
      entry.spend += toNumber(row.spend) ?? 0
      entry.clicks += toNumber(row.clicks) ?? 0
      entry.impressions += toNumber(row.impressions) ?? 0
      entry.conversions += toNumber(row.conversions) ?? 0
      bucket.set(key, entry)
    })
    return Array.from(bucket.values())
      .map((row) => ({
        ...row,
        ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
        cpc: row.clicks > 0 ? row.spend / row.clicks : null,
        cpa: row.conversions > 0 ? row.spend / row.conversions : null,
        cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : null,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8)
  }, [dailyRowsForTab])

  const topMetaAdsRows = useMemo(() => {
    if (metaAdsTopAggregated.length > 0) {
      const filtered = metaAdsTopAggregated.filter((row) => {
        const spend = toNumber(row.spend) ?? 0
        const leads = toNumber(row.fb_leads) ?? 0
        const contracts = toNumber(row.contracts_cnt) ?? 0
        return spend > 0 || leads > 0 || contracts > 0
      })
      return filtered.length > 0 ? filtered : metaAdsTopAggregated
    }
    return adsByPlatform
  }, [adsByPlatform, metaAdsTopAggregated])

  const metaFatigueDisplay = useMemo(() => {
    return [...metaFatigueRows]
      .filter((row) => row.creative_id || row.creative_name)
      .sort((a, b) => {
        const aScore =
          Math.abs(a.cpl_delta ?? 0) ||
          Math.abs(a.ctr_delta ?? 0) ||
          Math.abs(a.spend_share_7d ?? 0)
        const bScore =
          Math.abs(b.cpl_delta ?? 0) ||
          Math.abs(b.ctr_delta ?? 0) ||
          Math.abs(b.spend_share_7d ?? 0)
        return bScore - aScore
      })
  }, [metaFatigueRows])

  const channelSummary = useMemo(() => {
    const totals = { spend: 0, contracts: 0, leads: 0 }
    const bucket = new Map<string, { channel: string; spend: number; contracts: number; leads: number }>()
    channelMixRows.forEach((row) => {
      const channel = resolveChannelLabel(row.channel ?? "")
      const spend = toNumber(row.spend) ?? 0
      const contracts = toNumber(row.contracts_cnt) ?? 0
      const leads = toNumber(row.leads_cnt) ?? 0
      totals.spend += spend
      totals.contracts += contracts
      totals.leads += leads
      const entry = bucket.get(channel) ?? { channel, spend: 0, contracts: 0, leads: 0 }
      entry.spend += spend
      entry.contracts += contracts
      entry.leads += leads
      bucket.set(channel, entry)
    })
    const rows = Array.from(bucket.values())
      .map((row) => ({
        ...row,
        spendShare: totals.spend ? row.spend / totals.spend : null,
        contractsShare: totals.contracts ? row.contracts / totals.contracts : null,
        leadsShare: totals.leads ? row.leads / totals.leads : null,
      }))
      .sort((a, b) => {
        const spendDelta = (b.spend ?? 0) - (a.spend ?? 0)
        if (spendDelta !== 0) return spendDelta
        return (b.contracts ?? 0) - (a.contracts ?? 0)
      })
    return {
      rows,
      hasSpend: totals.spend > 0,
      hasLeads: totals.leads > 0,
    }
  }, [channelMixRows])

  const keywordDailyRows = useMemo(() => {
    return [...gadsKeywordDailyRows]
      .map((row) => {
        const impressions = toNumber(row.impressions) ?? 0
        const clicks = toNumber(row.clicks) ?? 0
        const spend = toNumber(row.spend) ?? 0
        return {
          ...row,
          impressions_value: impressions,
          clicks_value: clicks,
          spend_value: spend,
          conversions_value: toNumber(row.conversions) ?? 0,
          ctr: impressions > 0 ? clicks / impressions : null,
          cpc: clicks > 0 ? spend / clicks : null,
        }
      })
      .sort((a, b) => b.spend_value - a.spend_value)
  }, [gadsKeywordDailyRows])

  const deviceRows = useMemo(() => {
    return [...gadsDeviceRows]
      .map((row) => ({
        ...row,
        spend_value: toNumber(row.spend) ?? 0,
        impressions_value: toNumber(row.impressions) ?? 0,
        clicks_value: toNumber(row.clicks) ?? 0,
        conversions_value: toNumber(row.conversions) ?? 0,
      }))
      .sort((a, b) => b.spend_value - a.spend_value)
  }, [gadsDeviceRows])

  const conversionActionRows = useMemo(() => {
    const totalConversions = gadsConversionRows.reduce(
      (sum, row) => sum + (toNumber(row.conversions) ?? 0),
      0
    )
    return [...gadsConversionRows]
      .map((row) => ({
        ...row,
        conversions_value: toNumber(row.conversions) ?? 0,
        all_conversions_value: toNumber(row.all_conversions) ?? 0,
        value_value: toNumber(row.conversions_value) ?? 0,
        spend_value: toNumber(row.spend) ?? 0,
        conversions_share_pct_value:
          row.conversions_share_pct ??
          (totalConversions > 0 ? (toNumber(row.conversions) ?? 0) / totalConversions : null),
        cpa_value:
          row.cpa ??
          ((toNumber(row.spend) ?? 0) > 0 && (toNumber(row.conversions) ?? 0) > 0
            ? (toNumber(row.spend) ?? 0) / (toNumber(row.conversions) ?? 0)
            : null),
        kef_proxy_value: row.kef_proxy ?? null,
      }))
      .sort((a, b) => b.conversions_value - a.conversions_value)
  }, [gadsConversionRows])

  const gadsCampaignSummary = useMemo(() => {
    const bucket = new Map<
      string,
      {
        campaignId: string | number | null
        campaignName: string
        spend: number
        clicks: number
        impressions: number
        conversions: number
      }
    >()
    gadsSpendRows.forEach((row) => {
      const campaignId = row.campaign_id ?? null
      const name = normalizeLabel(row.campaign_name) ?? (campaignId != null ? `Campaign #${campaignId}` : "Campaign")
      const key = String(campaignId ?? name)
      const entry =
        bucket.get(key) ?? {
          campaignId,
          campaignName: name,
          spend: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
        }
      entry.spend += toNumber(row.spend) ?? 0
      entry.clicks += toNumber(row.clicks) ?? 0
      entry.impressions += toNumber(row.impressions) ?? 0
      entry.conversions += toNumber(row.conversions) ?? 0
      bucket.set(key, entry)
    })
    return Array.from(bucket.values()).sort((a, b) => b.spend - a.spend).slice(0, 8)
  }, [gadsSpendRows])

  const gadsCampaignPreviewSummary = useMemo(() => {
    const bucket = new Map<
      string,
      {
        campaignId: string | number | null
        campaignName: string
        channelType?: string | null
        creativeTitle?: string | null
        previewImageUrl?: string | null
        hasPreview?: boolean
        spend: number
        clicks: number
        impressions: number
        conversions: number
        conversionsValue: number
      }
    >()
    gadsCampaignPreviewRows.forEach((row) => {
      const campaignId = row.campaign_id ?? null
      const name = normalizeLabel(row.campaign_name) ?? (campaignId != null ? `Campaign #${campaignId}` : "Campaign")
      const key = String(campaignId ?? name)
      const entry =
        bucket.get(key) ?? {
          campaignId,
          campaignName: name,
          channelType: row.advertising_channel_type ?? null,
          creativeTitle: null,
          previewImageUrl: null,
          hasPreview: row.has_preview !== false,
          spend: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
          conversionsValue: 0,
        }
      entry.spend += toNumber(row.spend) ?? 0
      entry.clicks += toNumber(row.clicks) ?? 0
      entry.impressions += toNumber(row.impressions) ?? 0
      entry.conversions += toNumber(row.conversions) ?? 0
      entry.conversionsValue += toNumber(row.conversions_value) ?? 0
      if (!entry.previewImageUrl && row.preview_image_url) {
        entry.previewImageUrl = row.preview_image_url
      }
      if (row.has_preview === false) {
        entry.hasPreview = false
      } else if (entry.hasPreview == null) {
        entry.hasPreview = Boolean(row.preview_image_url)
      }
      if (!entry.creativeTitle && row.creative_title) {
        entry.creativeTitle = row.creative_title
      }
      bucket.set(key, entry)
    })
    return Array.from(bucket.values()).sort((a, b) => b.spend - a.spend).slice(0, 8)
  }, [gadsCampaignPreviewRows])

  const gadsCampaignPreviewMap = useMemo(() => {
    const map = new Map<string, { previewImageUrl: string | null; creativeTitle: string | null; hasPreview: boolean }>()
    gadsCampaignPreviewRows.forEach((row) => {
      const key = String(row.campaign_id ?? row.campaign_name ?? "")
      if (!key) return
      const entry = map.get(key) ?? { previewImageUrl: null, creativeTitle: null, hasPreview: row.has_preview !== false }
      if (!entry.previewImageUrl && row.preview_image_url) entry.previewImageUrl = row.preview_image_url
      if (!entry.creativeTitle && row.creative_title) entry.creativeTitle = row.creative_title
      if (row.has_preview === false) entry.hasPreview = false
      map.set(key, entry)
    })
    return map
  }, [gadsCampaignPreviewRows])

  const gadsDemandSummary = useMemo(() => {
    const bucket = new Map<
      string,
      {
        campaignId: string | number | null
        campaignName: string
        requests: number
        leads: number
        requestClicks: number
        leadClicks: number
        platform?: string | null
        channelType?: string | null
      }
    >()
    gadsRequestCampaignRows.forEach((row) => {
      const campaignId = row.campaign_id ?? null
      const name = normalizeLabel(row.campaign_name) ?? (campaignId != null ? `Campaign #${campaignId}` : "Campaign")
      const key = String(campaignId ?? name)
      const entry =
        bucket.get(key) ?? {
          campaignId,
          campaignName: name,
          requests: 0,
          leads: 0,
          requestClicks: 0,
          leadClicks: 0,
          platform: row.platform ?? null,
          channelType: row.advertising_channel_type ?? null,
        }
      entry.requests += toNumber(row.crm_requests_cnt) ?? 0
      entry.requestClicks += toNumber(row.gclid_uniq) ?? 0
      if (!entry.platform && row.platform) entry.platform = row.platform
      if (!entry.channelType && row.advertising_channel_type) entry.channelType = row.advertising_channel_type
      bucket.set(key, entry)
    })
    gadsLeadCampaignRows.forEach((row) => {
      const campaignId = row.campaign_id ?? null
      const name = normalizeLabel(row.campaign_name) ?? (campaignId != null ? `Campaign #${campaignId}` : "Campaign")
      const key = String(campaignId ?? name)
      const entry =
        bucket.get(key) ?? {
          campaignId,
          campaignName: name,
          requests: 0,
          leads: 0,
          requestClicks: 0,
          leadClicks: 0,
          platform: row.platform ?? null,
          channelType: row.advertising_channel_type ?? null,
        }
      entry.leads += toNumber(row.leads_cnt) ?? 0
      entry.leadClicks += toNumber(row.gclid_uniq) ?? 0
      if (!entry.platform && row.platform) entry.platform = row.platform
      if (!entry.channelType && row.advertising_channel_type) entry.channelType = row.advertising_channel_type
      bucket.set(key, entry)
    })
    return Array.from(bucket.values()).sort((a, b) => (b.requests + b.leads) - (a.requests + a.leads))
  }, [gadsLeadCampaignRows, gadsRequestCampaignRows])

  const adGroupRows = useMemo(() => {
    const bucket = new Map<string, { name: string; spend: number; clicks: number; impressions: number; conversions: number }>()
    gadsKeywordDailyRows.forEach((row) => {
      const name =
        (pickValue(row, ["ad_group_name", "ad_group_id"]) as string | number | null) ?? "Ad group"
      const key = String(name)
      const entry = bucket.get(key) ?? { name: String(name), spend: 0, clicks: 0, impressions: 0, conversions: 0 }
      entry.spend += toNumber(row.spend ?? row.cost) ?? 0
      entry.clicks += toNumber(row.clicks) ?? 0
      entry.impressions += toNumber(row.impressions) ?? 0
      entry.conversions += toNumber(row.conversions) ?? 0
      bucket.set(key, entry)
    })
    return Array.from(bucket.values())
      .map((row) => ({
        ...row,
        ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
        cpc: row.clicks > 0 ? row.spend / row.clicks : null,
        cpa: row.conversions > 0 ? row.spend / row.conversions : null,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8)
  }, [gadsKeywordDailyRows])

  const pmaxCampaigns = useMemo(() => {
    const bucket = new Map<
      string,
      {
        name: string
        spend: number
        clicks: number
        impressions: number
        conversions: number
        previewImageUrl: string | null
        previewWidth: number | null
        previewHeight: number | null
        previewStatus: string | null
        assetName: string | null
        assetType: string | null
      }
    >()
    if (gadsAssetGroupRows.length > 0) {
      gadsAssetGroupRows.forEach((row) => {
        const name = row.asset_group_name ?? row.campaign_name ?? "PMax Asset Group"
        const key = String(row.asset_group_id ?? row.campaign_id ?? name)
        const previewImageUrl = row.preview_image_url ?? null
        const previewWidth = toNumber(row.preview_image_width_px) ?? null
        const previewHeight = toNumber(row.preview_image_height_px) ?? null
        const previewStatus = row.preview_status ?? (previewImageUrl ? "ok" : null)
        const entry =
          bucket.get(key) ?? {
            name,
            spend: 0,
            clicks: 0,
            impressions: 0,
            conversions: 0,
            previewImageUrl,
            previewWidth,
            previewHeight,
            previewStatus,
            assetName: row.asset_display_name ?? null,
            assetType: row.asset_type ?? null,
          }
        entry.spend += toNumber(row.cost ?? row.spend) ?? 0
        entry.clicks += toNumber(row.clicks) ?? 0
        entry.impressions += toNumber(row.impressions) ?? 0
        entry.conversions += toNumber(row.conversions) ?? 0
        if (!entry.previewImageUrl && previewImageUrl) {
          entry.previewImageUrl = previewImageUrl
          entry.previewWidth = previewWidth
          entry.previewHeight = previewHeight
          entry.previewStatus = previewStatus ?? "ok"
        }
        if (!entry.assetName && row.asset_display_name) entry.assetName = row.asset_display_name
        if (!entry.assetType && row.asset_type) entry.assetType = row.asset_type
        if (!entry.previewStatus && row.preview_status) entry.previewStatus = row.preview_status
        bucket.set(key, entry)
      })
    } else {
      gadsSpendRows.forEach((row) => {
        const channelKey = normalizeKey(row.advertising_channel_type)
        if (!channelKey.includes("performancemax") && !channelKey.includes("pmax")) return
        const name = row.campaign_name ?? "PMax Campaign"
        const key = String(row.campaign_id ?? name)
        const entry =
          bucket.get(key) ?? {
            name,
            spend: 0,
            clicks: 0,
            impressions: 0,
            conversions: 0,
            previewImageUrl: null,
            previewWidth: null,
            previewHeight: null,
            previewStatus: null,
            assetName: null,
            assetType: null,
          }
        entry.spend += toNumber(row.spend) ?? 0
        entry.clicks += toNumber(row.clicks) ?? 0
        entry.impressions += toNumber(row.impressions) ?? 0
        entry.conversions += toNumber(row.conversions) ?? 0
        bucket.set(key, entry)
      })
    }
    return Array.from(bucket.values())
      .map((row) => ({
        ...row,
        ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
        cpc: row.clicks > 0 ? row.spend / row.clicks : null,
        cpa: row.conversions > 0 ? row.spend / row.conversions : null,
        cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : null,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6)
  }, [gadsAssetGroupRows, gadsSpendRows])

  const handleCompareChange = (value: CompareMode) => {
    setCompareMode(value)
    updateQuery({ compare: value === "none" ? null : value })
  }

  const handleCopyName = async (value: string, id: string | number | null) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id ?? value)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (error) {
      console.error("Failed to copy", error)
    }
  }

  const showCompareDelta = compareMode !== "none" && compareParams
  const insightsWidgetKey = useMemo(() => {
    if (activeTab === "meta") return "ads.meta_ads_top_daily"
    if (activeTab === "gads") return "ads.gads_pmax_daily"
    if (activeTab === "pmax") return "ads.gads_pmax_daily"
    return "ads.kpi_total"
  }, [activeTab])

  const resolveWidgetSupports = (meta?: WidgetMeta | null) => {
    if (!meta?.supports_filters) return new Set<string>()
    if (Array.isArray(meta.supports_filters)) {
      return new Set(meta.supports_filters.map((value) => String(value)))
    }
    return new Set(
      Object.entries(meta.supports_filters)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key)
    )
  }

  const updateWidgetFilter = (widgetKey: string, key: string, value: string) => {
    setWidgetFilters((prev) => {
      const next = { ...(prev[widgetKey] ?? {}) }
      if (!value || value === "all") {
        delete next[key]
      } else {
        next[key] = value
      }
      return { ...prev, [widgetKey]: next }
    })
  }

  const WidgetMiniFilters = ({ widgetKey }: { widgetKey: string }) => {
    const meta = widgetMeta[widgetKey]
    const supported = resolveWidgetSupports(meta)
    const supportsCity = supported.has("city") || supported.has("city_id") || supported.has("id_city")
    const supportsPlatform = supported.has("platform")
    const supportsDevice = supported.has("device")
    const supportsStatus = supported.has("status")
    const supportsConversion = supported.has("conversion_type")
    const local = widgetFilters[widgetKey] ?? {}
    if (!supportsCity && !supportsPlatform && !supportsDevice && !supportsStatus && !supportsConversion) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        {supportsCity && (
          <Select value={local.id_city ?? "all"} onValueChange={(value) => updateWidgetFilter(widgetKey, "id_city", value)}>
            <SelectTrigger className="h-7 w-[140px]">
              <SelectValue placeholder="Місто" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі міста</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city.id_city} value={String(city.id_city)}>
                  {city.city_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {supportsPlatform && (
          <Select
            value={local.platform ?? "all"}
            onValueChange={(value) => updateWidgetFilter(widgetKey, "platform", value)}
          >
            <SelectTrigger className="h-7 w-[130px]">
              <SelectValue placeholder="Платформа" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі платформи</SelectItem>
              <SelectItem value="meta">Meta</SelectItem>
              <SelectItem value="gads">Google Ads</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        )}
        {supportsDevice && (
          <Select value={local.device ?? "all"} onValueChange={(value) => updateWidgetFilter(widgetKey, "device", value)}>
            <SelectTrigger className="h-7 w-[120px]">
              <SelectValue placeholder="Device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="desktop">Desktop</SelectItem>
              <SelectItem value="tablet">Tablet</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        )}
        {supportsStatus && (
          <Select value={local.status ?? "all"} onValueChange={(value) => updateWidgetFilter(widgetKey, "status", value)}>
            <SelectTrigger className="h-7 w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="limited">Limited</SelectItem>
            </SelectContent>
          </Select>
        )}
        {supportsConversion && (
          <Select
            value={local.conversion_type ?? "all"}
            onValueChange={(value) => updateWidgetFilter(widgetKey, "conversion_type", value)}
          >
            <SelectTrigger className="h-7 w-[150px]">
              <SelectValue placeholder="Conversions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="conversions">Conversions</SelectItem>
              <SelectItem value="all_conversions">All conversions</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    )
  }

  const TabKpiStrip = ({ title }: { title: string }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        {tabKpiCards.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="text-xs text-muted-foreground">{metric.label}</div>
            <div className="mt-2 text-lg font-semibold">{metric.format(metric.value ?? null)}</div>
            {metric.note && <div className="mt-1 text-[11px] text-muted-foreground">{metric.note}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics · Ads"
        description="Платформна аналітика Meta та Google Ads, креативи й розподіл джерел."
      />

      {dateError && <div className="text-xs text-red-600">{dateError}</div>}

      <AnalyticsFilters
        value={draftFilters}
        onDateChange={(value) => {
          setDraftFilters((prev) => ({ ...prev, dateRange: value }))
          setDateError(null)
        }}
        onCityChange={(value) => setDraftFilters((prev) => ({ ...prev, cityId: value }))}
        showCity
        allowAllCities={false}
        compact
        extraControls={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={compareMode} onValueChange={(value) => handleCompareChange(value as CompareMode)}>
              <SelectTrigger className="h-8 w-full sm:w-[180px]">
                <SelectValue placeholder="Compare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No comparison</SelectItem>
                <SelectItem value="wow">WoW (prev 7d)</SelectItem>
                <SelectItem value="mom">MoM (prev 30d)</SelectItem>
              </SelectContent>
            </Select>
            {compareMode !== "none" && !compareParams && (
              <span className="text-xs text-muted-foreground">Select a date range to compare.</span>
            )}
          </div>
        }
        onApply={applyFilters}
        onReset={resetFilters}
        isLoading={
          isLoadingDaily ||
          isLoadingAnomalies ||
          isLoadingCreatives ||
          isLoadingMetaCreatives ||
          isLoadingChannelMix ||
          isLoadingSummaryExtras ||
          isLoadingMetaExtras ||
          isLoadingCreativeExtras ||
          isLoadingGadsTopKeywords ||
          isLoadingGadsSpend ||
          isLoadingGadsKeywordsDaily ||
          isLoadingGadsDevices ||
          isLoadingGadsConversions ||
          isLoadingGadsPmax ||
          isLoadingCompare ||
          isLoadingKpi ||
          isLoadingCreativeTypes
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full max-w-[720px] grid-cols-4">
          <TabsTrigger value={TAB_SUMMARY}>Summary</TabsTrigger>
          <TabsTrigger value={TAB_META}>Meta</TabsTrigger>
          <TabsTrigger value={TAB_GADS}>Google Ads</TabsTrigger>
          <TabsTrigger value={TAB_PMAX}>PMax</TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_SUMMARY} className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Data readiness</CardTitle>
          <p className="text-xs text-muted-foreground">
            Coverage, freshness і попередження про якість даних.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-card/40 p-3">
            <div className="text-xs text-muted-foreground">Coverage</div>
            <div className="text-sm font-semibold">
              {adsRange?.min_date && adsRange?.max_date
                ? `${adsRange.min_date} → ${adsRange.max_date}`
                : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground">ads.ads_daily</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/40 p-3">
            <div className="text-xs text-muted-foreground">Freshness</div>
            <div className="text-sm font-semibold">
              {lastLoadTimestamp
                ? lastLoadTimestamp.toLocaleString("uk-UA")
                : "—"}
            </div>
            {lastLoadTimestamp && (
              <div className="text-[11px] text-muted-foreground">
                {Math.floor((Date.now() - lastLoadTimestamp.getTime()) / DAY_MS)} дн. тому
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border/60 bg-card/40 p-3">
            <div className="text-xs text-muted-foreground">Warnings</div>
            {readinessWarnings.length === 0 ? (
              <div className="text-sm font-semibold text-emerald-600">No critical warnings</div>
            ) : (
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {readinessWarnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Ads KPI</CardTitle>
          {kpiMissing && (
            <p className="text-xs text-muted-foreground">
              KPI view is unavailable, показуємо агрегат із daily-даних.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-10 gap-3">
            {[
              {
                label: "Spend",
                badges: ["Total", "Platform"],
                current: totals.spend,
                prev: showCompareDelta ? compareTotals.spend : null,
                format: (v: number | null) => formatMoney(v ?? null),
                sparkline: kpiSparklines.spend,
              },
              {
                label: "Leads (platform)",
                badges: [
                  "Total",
                  "Platform",
                  ...(platformLeadsIsFractional ? ["Modelled"] : []),
                ],
                current: totals.platformLeads,
                prev: showCompareDelta ? compareTotals.platformLeads : null,
                format: (v: number | null) => formatNumber(v ?? null),
                sparkline: kpiSparklines.platformLeads,
              },
              {
                label: "CRM requests",
                badges: ["Total", "CRM"],
                note: hasCrmLeadsData ? null : "Attribution not linked",
                current: hasCrmLeadsData ? totals.crmRequests : null,
                prev: null,
                format: (v: number | null) => formatNumber(v ?? null),
                sparkline: kpiSparklines.crmRequests,
              },
              {
                label: "Contracts",
                badges: ["Total", "CRM"],
                note: hasCrmOutcomesData ? null : "CRM outcomes missing",
                current: hasCrmOutcomesData ? totals.contracts : null,
                prev: null,
                format: (v: number | null) => formatNumber(v ?? null),
                sparkline: kpiSparklines.contracts,
              },
              {
                label: "Revenue",
                badges: ["Total", "CRM"],
                note: hasCrmOutcomesData ? null : "CRM outcomes missing",
                current: hasCrmOutcomesData ? totals.revenue : null,
                prev: null,
                format: (v: number | null) => formatMoney(v ?? null),
                sparkline: kpiSparklines.revenue,
              },
              {
                label: "Payments",
                badges: ["Total", "CRM"],
                note: hasCrmOutcomesData ? null : "CRM outcomes missing",
                current: hasCrmOutcomesData ? totals.payments : null,
                prev: null,
                format: (v: number | null) => formatMoney(v ?? null),
                sparkline: kpiSparklines.payments,
              },
              {
                label: "ROAS (CRM)",
                badges: ["CRM", "Total"],
                note: hasCrmOutcomesData ? null : "CRM outcomes missing",
                current: hasCrmOutcomesData ? dailyRoas : null,
                prev: null,
                format: (v: number | null) =>
                  formatNumber(v ?? null, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                sparkline: kpiSparklines.roas,
              },
              {
                label: "CAC (CRM)",
                badges: ["CRM", "Total"],
                note: hasCrmOutcomesData ? null : "CRM outcomes missing",
                current: hasCrmOutcomesData && totals.contracts > 0 ? totals.spend / totals.contracts : null,
                prev: null,
                format: (v: number | null) => formatMoney(v ?? null),
                sparkline: kpiSparklines.cac,
              },
              {
                label: "Payback",
                badges: ["CRM", "Total"],
                note: hasCrmOutcomesData ? null : "CRM outcomes missing",
                current: hasCrmOutcomesData && totals.revenue > 0 ? totals.payments / totals.revenue : null,
                prev: null,
                format: (v: number | null) => formatPercent(v ?? null),
                sparkline: kpiSparklines.payback,
              },
              {
                label: "Link rate",
                badges: ["Quality"],
                note: hasCrmLeadsData ? null : "Attribution not linked",
                current: hasCrmLeadsData && totals.platformLeads > 0 ? totals.crmRequests / totals.platformLeads : null,
                prev: null,
                format: (v: number | null) => formatPercent(v ?? null),
                sparkline: kpiSparklines.linkRate,
              },
              {
                label: "Req → Contract",
                badges: ["Quality"],
                note: hasCrmOutcomesData ? null : "CRM outcomes missing",
                current:
                  hasCrmOutcomesData && totals.crmRequests > 0 ? totals.contracts / totals.crmRequests : null,
                prev: null,
                format: (v: number | null) => formatPercent(v ?? null),
                sparkline: kpiSparklines.requestToContractRate,
              },
            ].map((metric) => {
              const delta = showCompareDelta ? calcDelta(metric.current, metric.prev) : { delta: null, deltaPct: null }
              const isPositive = (delta.delta ?? 0) >= 0
              return (
                <Card key={metric.label} className="border-border/60 bg-card/40 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-xs text-muted-foreground">{metric.label}</CardTitle>
                      {metric.badges?.map((badge) => (
                        <Badge key={`${metric.label}-${badge}`} variant="outline" className="text-[10px] uppercase">
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{metric.format(metric.current)}</div>
                      {metric.note && (
                        <div className="mt-1 text-[11px] text-muted-foreground">{metric.note}</div>
                      )}
                    {showCompareDelta ? (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {delta.deltaPct == null ? (
                          "—"
                        ) : (
                          <>
                            {isPositive ? (
                              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3 text-rose-500" />
                            )}
                            <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                              {formatDelta(delta.deltaPct)}
                            </span>
                          </>
                        )}
                        <span>vs prev</span>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-muted-foreground">Поточний період</div>
                    )}
                    </div>
                    <div className="w-24 shrink-0">
                      <KpiSparkline data={metric.sparkline} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              {
                label: "Impressions",
                current: totals.impressions,
                prev: showCompareDelta ? compareTotals.impressions : null,
                format: (v: number | null) => formatNumber(v ?? null),
                sparkline: kpiSparklines.impressions,
              },
              {
                label: "CTR",
                current: totalCtr,
                prev: showCompareDelta ? compareCtr : null,
                format: (v: number | null) => formatPercent(v ?? null),
                sparkline: kpiSparklines.ctr,
              },
              {
                label: "CPA",
                current: totalCpa,
                prev: showCompareDelta ? compareCpa : null,
                format: (v: number | null) => formatMoney(v ?? null),
                sparkline: kpiSparklines.cpa,
              },
              {
                label: "CPC",
                current: totalCpc,
                prev: showCompareDelta ? compareCpc : null,
                format: (v: number | null) => formatMoney(v ?? null),
                sparkline: kpiSparklines.cpc,
              },
              {
                label: "CPM",
                current: totalCpm,
                prev: showCompareDelta ? compareCpm : null,
                format: (v: number | null) => formatMoney(v ?? null),
                sparkline: kpiSparklines.cpm,
              },
            ].map((metric) => {
              const delta = showCompareDelta ? calcDelta(metric.current, metric.prev) : { delta: null, deltaPct: null }
              const isPositive = (delta.delta ?? 0) >= 0
              return (
                <Card key={metric.label} className="border-border/60 bg-card/40 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">{metric.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{metric.format(metric.current)}</div>
                    {showCompareDelta ? (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {delta.deltaPct == null ? (
                          "—"
                        ) : (
                          <>
                            {isPositive ? (
                              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3 text-rose-500" />
                            )}
                            <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                              {formatDelta(delta.deltaPct)}
                            </span>
                          </>
                        )}
                        <span>vs prev</span>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-muted-foreground">Поточний період</div>
                    )}
                    </div>
                    <div className="w-24 shrink-0">
                      <KpiSparkline data={metric.sparkline} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="rounded-xl border border-border/60 p-4">
            <div>
              <div className="text-sm font-semibold">KPI trend</div>
              <div className="text-xs text-muted-foreground">Spend + funnel (platform leads → CRM requests → contracts).</div>
            </div>
            {kpiTrendData.length < 2 ? (
              <div className="mt-3">
                <WidgetStatus
                  title="Нет данных для тренда"
                  description="KPI или daily-данные еще не обновились."
                />
              </div>
            ) : (
              <div className="mt-3 h-[240px]">
                <SafeResponsiveContainer>
                  <ComposedChart data={kpiTrendData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adsSpendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.5} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...chartGridProps} vertical={false} />
                    <XAxis dataKey="date" {...chartAxisProps} />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(value) => formatNumber(value as number)}
                      label={{ value: "Spend", angle: -90, position: "insideLeft", offset: 12 }}
                      {...chartAxisProps}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) => formatNumber(value as number)}
                      label={{ value: "Leads", angle: 90, position: "insideRight", offset: 12 }}
                      {...chartAxisProps}
                    />
	                    <Tooltip
	                      contentStyle={chartTooltipStyle}
	                      itemStyle={chartTooltipItemStyle}
	                      formatter={(value, name) => {
	                        const label = String(name)
	                        if (value === null || value === undefined) return ["—", label]
	                        const numeric = typeof value === "number" ? value : Number(value)
	                        if (label === "spend") return [formatMoney(numeric), "Spend"]
	                        if (label === "platformLeads") return [formatNumber(numeric), "Leads (platform)"]
	                        if (label === "crmRequests") return [formatNumber(numeric), "CRM requests"]
	                        if (label === "contracts") return [formatNumber(numeric), "Contracts"]
	                        return [formatNumber(numeric), label]
	                      }}
	                    />
                    <Legend verticalAlign="top" height={28} />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      name="Spend"
                      stroke={CHART_COLORS.primary}
                      fill="url(#adsSpendFill)"
                      strokeWidth={2}
                      dot={false}
                      yAxisId="left"
                    />
                    <Line
                      type="monotone"
                      dataKey="platformLeads"
                      name="Leads (platform)"
                      stroke={CHART_COLORS.secondary}
                      strokeWidth={2}
                      dot={false}
                      yAxisId="right"
                    />
                    <Line
                      type="monotone"
                      dataKey="crmRequests"
                      name="CRM requests"
                      stroke={CHART_COLORS.tertiary}
                      strokeWidth={2}
                      dot={false}
                      yAxisId="right"
                    />
                    <Line
                      type="monotone"
                      dataKey="contracts"
                      name="Contracts"
                      stroke={CHART_COLORS.quaternary}
                      strokeWidth={2}
                      dot={false}
                      yAxisId="right"
                    />
                  </ComposedChart>
                </SafeResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Highlights</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Sources",
                  value: channelSummary.rows.length,
                  hint: "Channels with spend or contracts",
                },
                {
                  label: "Anomalies (7d)",
                  value: filteredAnomalies.length,
                  hint: "Signals outside baseline",
                },
                {
                  label: "Creative fatigue",
                  value: metaFatigueDisplay.length,
                  hint: "Creatives with negative deltas",
                },
                {
                  label: "Creatives w/ results",
                  value: topMetaResultRows.length,
                  hint: "Leads or contracts in period",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold">{formatNumber(item.value)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{item.hint}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <InsightsPanel
            widgetKey={insightsWidgetKey}
            dateFrom={appliedFilters.dateRange?.from?.toISOString().slice(0, 10)}
            dateTo={appliedFilters.dateRange?.to?.toISOString().slice(0, 10)}
            idCity={appliedFilters.cityId}
            enabled={canFetch}
          />

          {isLoadingChannelMix ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : channelMixRows.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Sources share</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {channelSummary.rows.map((row) => {
                  const channelMeta = getChannelMeta(row.channel)
                  const primaryShare = row.contractsShare ?? row.spendShare ?? row.leadsShare
                  const shareLabel = primaryShare != null ? formatPercent(primaryShare, { digits: 1 }) : "—"
                  const shareWidth =
                    primaryShare != null ? Math.max(4, Math.min(100, Math.round(primaryShare * 100))) : 0
                  return (
                    <div key={row.channel} className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${channelMeta.dotClass}`} />
                          <span className="text-sm font-semibold">{channelMeta.label}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {shareLabel}
                        </Badge>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-muted/40">
                        <div
                          className={`h-1.5 rounded-full ${channelMeta.barClass}`}
                          style={{ width: `${shareWidth}%` }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        {channelSummary.hasSpend && (
                          <div>
                            <div className="text-[11px] uppercase tracking-wide">Spend</div>
                            <div className="text-sm font-semibold text-foreground">{formatMoney(row.spend)}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-[11px] uppercase tracking-wide">Contracts</div>
                          <div className="text-sm font-semibold text-foreground">{formatNumber(row.contracts)}</div>
                        </div>
                        {channelSummary.hasLeads && (
                          <div>
                            <div className="text-[11px] uppercase tracking-wide">Leads</div>
                            <div className="text-sm font-semibold text-foreground">{formatNumber(row.leads)}</div>
                          </div>
                        )}
                        {channelSummary.hasLeads && row.leadsShare != null && (
                          <div>
                            <div className="text-[11px] uppercase tracking-wide">Lead share</div>
                            <div className="text-sm font-semibold text-foreground">{formatPercent(row.leadsShare)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : channelMixMissing ? (
            <AnalyticsEmptyState
              title="Немає даних по джерелам"
              description="Перевірте SEM витрину channel_mix_daily_city."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає даних по джерелам"
              description="Ще немає даних для розподілу джерел."
              context="ads"
              size="sm"
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>GA4 Quality Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ga4TrafficRows.length > 0 || ga4EventsTop.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Sessions</div>
                      <div className="mt-1 text-base font-semibold">{formatNumber(ga4TrafficSummary.sessions)}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Users</div>
                      <div className="mt-1 text-base font-semibold">{formatNumber(ga4TrafficSummary.users)}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Engagement</div>
                      <div className="mt-1 text-base font-semibold">{formatPercent(ga4EngagementRate)}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Conversions</div>
                      <div className="mt-1 text-base font-semibold">{formatNumber(ga4TrafficSummary.conversions)}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">GA4 Revenue</div>
                      <div className="mt-1 text-base font-semibold">{formatMoney(ga4TrafficSummary.revenue)}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="text-xs text-muted-foreground">Events</div>
                      <div className="mt-1 text-base font-semibold">{formatNumber(ga4EventsTop.length)}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {ga4EventsTop.slice(0, 6).map((row, index) => (
                      <div key={`${row.eventName}-${index}`} className="rounded-xl border border-border/60 bg-card/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold">{row.eventName}</div>
                          {row.platform ? <Badge variant="outline">{row.platform}</Badge> : null}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <div>Conversions</div>
                            <div className="text-sm font-semibold text-foreground">{formatNumber(row.conversions)}</div>
                          </div>
                          <div>
                            <div>Revenue</div>
                            <div className="text-sm font-semibold text-foreground">{formatMoney(row.revenue)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : adsSummaryMissing.ga4_traffic || adsSummaryMissing.ga4_events ? (
                <WidgetStatus
                  title="GA4 widgets unavailable"
                  description="ga4.traffic_overview_daily / ga4.events_conversions_daily недоступны."
                />
              ) : (
                <WidgetStatus
                  title="GA4 data is empty"
                  description="За выбранный период нет прикладных GA4 событий для рекламы."
                />
              )}
            </CardContent>
          </Card>

          {isLoadingAnomalies ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredAnomalies.length > 0 ? (
            <Card>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3">
                <CardTitle>Anomalies 7d</CardTitle>
                {filteredAnomalies.length > 8 && (
                  <Button size="sm" variant="outline" onClick={() => setShowAllAnomalies((prev) => !prev)}>
                    {showAllAnomalies ? "Collapse" : "Show all"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Ad</TableHead>
                        <TableHead className="text-right">Spend 7d</TableHead>
                        <TableHead className="text-right">Prev 7d</TableHead>
                        <TableHead className="text-right">Δ Spend</TableHead>
                        <TableHead className="text-right">Δ Clicks</TableHead>
                        <TableHead className="text-right">Δ Conv</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(showAllAnomalies ? filteredAnomalies : filteredAnomalies.slice(0, 8)).map((row, index) => {
                        const adName = normalizeLabel(row.ad_name ?? null)
                        const creativeTitle = normalizeLabel(row.creative_title ?? null)
                        const campaignName = normalizeLabel((row as { campaign_name?: string | null }).campaign_name ?? null)
                        const adsetName = normalizeLabel((row as { adset_name?: string | null }).adset_name ?? null)
                        const ad = buildEntityLabel(adName ?? creativeTitle, row.ad_id, "Ad")
                        const title = campaignName ?? ad.title
                        const previewUrl = row.preview_image_url ?? null
                        const fallbackUrl = buildAdsLibraryUrl(row.ad_id ?? null)
                        const previewLink = (row as { link_url?: string | null }).link_url ?? fallbackUrl
                        return (
                          <TableRow key={`${row.ad_id ?? "anomaly"}-${index}`}>
                            <TableCell>
                              <div className="flex items-start gap-3">
                                <PreviewImage src={previewUrl} alt={title} href={previewLink} fallbackUrl={fallbackUrl} />
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium">{title}</span>
                                  {creativeTitle && creativeTitle !== title && (
                                    <span className="text-[11px] text-muted-foreground line-clamp-1">{creativeTitle}</span>
                                  )}
                                  {adsetName && adsetName !== title && (
                                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                                      Adset: {adsetName}
                                    </span>
                                  )}
                                  {adName && adName !== title && adName !== creativeTitle && (
                                    <span className="text-[11px] text-muted-foreground line-clamp-1">Ad: {adName}</span>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2">
                                    {renderPlatformBadge(row.platform)}
                                    {row.baseline_days ? (
                                      <span className="text-[11px] text-muted-foreground">
                                        baseline {row.baseline_days}d
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatMoney(row.spend_7d)}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.spend_prev7d)}</TableCell>
                            <TableCell className="text-right">
                              <DeltaBadge value={row.spend_delta_pct} />
                            </TableCell>
                            <TableCell className="text-right">
                              <DeltaBadge value={row.clicks_delta_pct} />
                            </TableCell>
                            <TableCell className="text-right">
                              <DeltaBadge value={row.conv_delta_pct} />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <AnalyticsEmptyState
              title="Немає аномалій"
              description="За останні 7 днів аномалій не виявлено."
              context="ads"
              size="sm"
            />
          )}
        </TabsContent>

        <TabsContent value={TAB_CREATIVES} className="space-y-4">
          {isLoadingDaily || isLoadingKpi ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <TabKpiStrip title="Meta KPI" />
          )}

          {isLoadingMetaAdsTop || isLoadingDaily ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : topMetaAdsRows.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Top Meta ads</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <WidgetMiniFilters widgetKey="ads.meta_ads_top_daily" />
                    <Badge variant="secondary">{topMetaAdsRows.length}</Badge>
                    {topMetaAdsRows.length > 6 && (
                      <Button size="sm" variant="outline" onClick={() => setShowAllTopMeta((prev) => !prev)}>
                        {showAllTopMeta ? "Collapse" : "Show all"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {(showAllTopMeta ? topMetaAdsRows : topMetaAdsRows.slice(0, 6)).map((row, index) => {
                  const rowAny = row as Record<string, unknown>
                  const adName = normalizeLabel((rowAny.ad_name as string | null) ?? null)
                  const creativeTitle =
                    normalizeLabel(
                      (rowAny.creative_title as string | null) ??
                        (rowAny.creative_body as string | null) ??
                        adName ??
                        null
                    ) ?? null
                  const label = buildEntityLabel(creativeTitle, rowAny.ad_id as string | number | null, "Ad")
                  const campaignName =
                    normalizeLabel(
                      (rowAny.campaign_name as string | null) ??
                        (rowAny.adset_name as string | null) ??
                        null
                    ) ?? null
                  const campaignLabel =
                    campaignName ??
                    (rowAny.campaign_id != null ? `Campaign #${rowAny.campaign_id}` : null) ??
                    (rowAny.adset_id != null ? `Adset #${rowAny.adset_id}` : null) ??
                    "Campaign"
                  const creativeBody = normalizeLabel((rowAny.creative_body as string | null) ?? null)
                  const spend = toNumber(rowAny.spend) ?? 0
                  const leads = toNumber(rowAny.fb_leads) ?? 0
                  const crmLeads = toNumber(rowAny.crm_requests_cnt)
                  const contracts = toNumber(rowAny.contracts_cnt) ?? 0
                  const paidSum = toNumber(rowAny.paid_sum)
                  const cpl = rowAny.cpl != null ? toNumber(rowAny.cpl) : leads > 0 ? spend / leads : null
                  const cpa = rowAny.cpa != null ? toNumber(rowAny.cpa) : contracts > 0 ? spend / contracts : null
                  const roas =
                    rowAny.roas_paid != null
                      ? toNumber(rowAny.roas_paid)
                      : paidSum != null && spend > 0
                        ? paidSum / spend
                        : null
                  const previewUrl =
                    (rowAny.preview_image_url as string | null) ??
                    (rowAny.thumbnail_url as string | null) ??
                    (rowAny.media_image_src as string | null) ??
                    null
                    const previewLink =
                      (rowAny.permalink_url as string | null) ??
                      (rowAny.link_url as string | null) ??
                      null
                    const fallbackUrl = buildAdsLibraryUrl(rowAny.ad_id as string | number | null)
                    const openUrl = previewLink ?? fallbackUrl
                    return (
                      <div
                        key={`${rowAny.ad_id ?? label.title}-${index}`}
                        className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <PreviewImage src={previewUrl} alt={label.title} href={openUrl} fallbackUrl={fallbackUrl} />
                            <div>
                              <div className="text-sm font-semibold">{campaignLabel}</div>
                              {label.title && label.title !== campaignLabel && (
                                <div className="text-xs text-muted-foreground">{label.title}</div>
                              )}
                              {adName && adName !== label.title && adName !== campaignLabel && (
                                <div className="text-xs text-muted-foreground">Ad: {adName}</div>
                              )}
                            {creativeBody && creativeBody !== label.title && creativeBody !== adName && (
                              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{creativeBody}</div>
                            )}
                          </div>
                        </div>
                        {renderPlatformBadge("meta")}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">CPL {cpl == null ? "—" : formatMoney(cpl)}</Badge>
                        <Badge variant="secondary">CPA {cpa == null ? "—" : formatMoney(cpa)}</Badge>
                        <Badge variant="secondary">
                          ROAS{" "}
                          {roas == null
                            ? "—"
                            : formatNumber(roas, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(spend)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {crmLeads != null ? "CRM leads" : "Platform leads"}
                          </div>
                          <div className="font-semibold">{formatNumber(crmLeads ?? leads)}</div>
                          {crmLeads != null && leads > 0 && (
                            <div className="text-[11px] text-muted-foreground">FB leads: {formatNumber(leads)}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Contracts</div>
                          <div className="font-semibold">{formatNumber(contracts)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Paid sum</div>
                          <div className="font-semibold">{formatMoney(paidSum)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : metaAdsTopMissing ? (
            <AnalyticsEmptyState
              title="Немає Meta оголошень"
              description="Перевірте SEM витрину meta_ads_top_daily."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає Meta оголошень"
              description="Перевірте Meta підключення або вибраний період."
              context="ads"
              size="sm"
            />
          )}

          {isLoadingMetaCampaignProduct ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : metaCampaignProductRows.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Campaigns × Product</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <WidgetMiniFilters widgetKey="ads.meta_campaigns_by_product" />
                    <Badge variant="secondary">{metaCampaignProductRows.length}</Badge>
                    {metaCampaignProductRows.length > 8 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAllMetaCampaignProduct((prev) => !prev)}
                      >
                        {showAllMetaCampaignProduct ? "Collapse" : "Show all"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Contracts</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                      <TableHead className="text-right">KEF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(showAllMetaCampaignProduct
                      ? metaCampaignProductRows
                      : metaCampaignProductRows.slice(0, 8)
                    ).map((row, index) => {
                      const campaign =
                        normalizeLabel(row.campaign_name) ??
                        (row.campaign_id != null ? `Campaign #${row.campaign_id}` : "Campaign")
                      const product =
                        normalizeLabel(row.product_name) ??
                        normalizeLabel(row.product_group) ??
                        "Unknown"
                      return (
                        <TableRow key={`${row.campaign_id ?? "meta-prod"}-${row.product_id ?? index}`}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{campaign}</span>
                              <span className="text-xs text-muted-foreground">{renderPlatformBadge("meta")}</span>
                            </div>
                          </TableCell>
                          <TableCell>{product}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.spend)}</TableCell>
                          <TableCell className="text-right">{formatNumber(row.leads_cnt)}</TableCell>
                          <TableCell className="text-right">{formatNumber(row.contracts_cnt)}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.revenue_sum)}</TableCell>
                          <TableCell className="text-right">
                            {row.roas == null
                              ? "—"
                              : formatNumber(row.roas, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.kef_commercial == null
                              ? "—"
                              : formatNumber(row.kef_commercial, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : metaCampaignProductMissing ? (
            <AnalyticsEmptyState
              title="Campaigns × Product недоступні"
              description="Перевірте SEM витрину meta_campaigns_by_product_daily_city."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає даних Campaigns × Product"
              description="Спробуйте розширити період або перевірити контрактну атрибуцію."
              context="ads"
              size="sm"
            />
          )}

          {placementSummary.rows.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Placement split</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {placementSummary.rows.map((row) => {
                  const share = placementSummary.totalSpend > 0 ? row.spend / placementSummary.totalSpend : null
                  const ctr = row.impressions > 0 ? row.clicks / row.impressions : null
                  return (
                    <div key={row.label} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{row.label}</div>
                        {share != null && (
                          <Badge variant="secondary" className="text-xs">
                            {formatPercent(share, { digits: 1 })}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(row.spend)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Leads</div>
                          <div className="font-semibold">{formatNumber(row.leads)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">CTR</div>
                          <div className="font-semibold">{ctr == null ? "—" : formatPercent(ctr)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Impr</div>
                          <div className="font-semibold">{formatNumber(row.impressions)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {creativeTypeSummary.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Meta creative types</CardTitle>
                  <WidgetMiniFilters widgetKey="ads.meta_creatives_daily" />
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {creativeTypeSummary.slice(0, 3).map((row) => (
                  <div key={`meta-type-${row.type}`} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs uppercase">
                        {row.type === "unknown" ? "Unknown" : row.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {row.share != null
                          ? `${formatPercent(row.share, { digits: 1 })} share`
                          : row.count != null
                            ? `${row.count} ads`
                            : "—"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Spend</div>
                        <div className="font-semibold">{formatMoney(row.spend)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Leads</div>
                        <div className="font-semibold">{formatNumber(row.leads)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">CTR</div>
                        <div className="font-semibold">{row.ctr == null ? "—" : formatPercent(row.ctr)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">CPA</div>
                        <div className="font-semibold">{row.cpa == null ? "—" : formatMoney(row.cpa)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {isDebug ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Meta CRM signals (ads)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Funnel</div>
                    {adsMetaMissing.funnel ? (
                      <WidgetStatus title="Нет витрины funnel" description="ads.meta_funnel_daily не подключена." />
                    ) : (
                      <WidgetTable
                        rows={adsMetaFunnelRows}
                        emptyLabel={isLoadingMetaExtras ? "Loading..." : "Нет данных funnel."}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Leads daily</div>
                    {adsMetaMissing.leads ? (
                      <WidgetStatus title="Нет витрины leads" description="ads.meta_leads_daily не подключена." />
                    ) : (
                      <WidgetTable
                        rows={adsMetaLeadsRows}
                        emptyLabel={isLoadingMetaExtras ? "Loading..." : "Нет данных leads."}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Data quality</div>
                    {adsMetaMissing.quality ? (
                      <WidgetStatus title="Нет витрины data quality" description="ads.meta_data_quality_daily не подключена." />
                    ) : (
                      <WidgetTable
                        rows={adsMetaQualityRows}
                        emptyLabel={isLoadingMetaExtras ? "Loading..." : "Нет данных по качеству."}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Leads match quality</div>
                    {adsMetaMissing.match ? (
                      <WidgetStatus title="Нет витрины match quality" description="ads.meta_leads_match_quality_daily не подключена." />
                    ) : (
                      <WidgetTable
                        rows={adsMetaMatchRows}
                        emptyLabel={isLoadingMetaExtras ? "Loading..." : "Нет данных match quality."}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">CPL by form</div>
                    {adsMetaMissing.cpl_by_form ? (
                      <WidgetStatus title="Нет витрины CPL by form" description="ads.meta_cpl_by_form_daily не подключена." />
                    ) : (
                      <WidgetTable
                        rows={adsMetaCplByFormRows}
                        emptyLabel={isLoadingMetaExtras ? "Loading..." : "Нет данных CPL by form."}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Meta raw signals</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Creatives</div>
                    {metaRawMissing.creatives ? (
                      <WidgetStatus title="Нет витрины creatives" description="meta.creatives_daily не подключена." />
                    ) : (
                      <WidgetTable rows={metaRawCreativesRows} emptyLabel="Нет данных creatives." />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Data quality</div>
                    {metaRawMissing.quality ? (
                      <WidgetStatus title="Нет витрины data quality" description="meta.data_quality_daily не подключена." />
                    ) : (
                      <WidgetTable rows={metaRawDataQualityRows} emptyLabel="Нет данных по качеству." />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Funnel</div>
                    {metaRawMissing.funnel ? (
                      <WidgetStatus title="Нет витрины funnel" description="meta.funnel_daily не подключена." />
                    ) : (
                      <WidgetTable rows={metaRawFunnelRows} emptyLabel="Нет данных funnel." />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Lead → CRM bridge</div>
                    {metaRawMissing.bridge ? (
                      <WidgetStatus title="Нет витрины bridge" description="meta.lead_to_crm_bridge не подключена." />
                    ) : (
                      <WidgetTable rows={metaRawBridgeRows} emptyLabel="Нет данных bridge." />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Leads match quality</div>
                    {metaRawMissing.match ? (
                      <WidgetStatus title="Нет витрины match" description="meta.leads_match_quality_daily не подключена." />
                    ) : (
                      <WidgetTable rows={metaRawMatchRows} emptyLabel="Нет данных по match quality." />
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value={TAB_META} className="space-y-4">
          {isLoadingDaily || isLoadingKpi ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <TabKpiStrip title="Meta KPI" />
          )}

          {isLoadingMetaAdsTop || isLoadingDaily ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : topMetaAdsRows.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Top Meta ads</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <WidgetMiniFilters widgetKey="ads.meta_ads_top_daily" />
                    <Badge variant="secondary">{topMetaAdsRows.length}</Badge>
                    {topMetaAdsRows.length > 6 && (
                      <Button size="sm" variant="outline" onClick={() => setShowAllTopMeta((prev) => !prev)}>
                        {showAllTopMeta ? "Collapse" : "Show all"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {(showAllTopMeta ? topMetaAdsRows : topMetaAdsRows.slice(0, 6)).map((row, index) => {
                  const adName = normalizeLabel(row.ad_name ?? null)
                  const creativeTitle = normalizeLabel(row.creative_title ?? row.creative_body ?? adName ?? null)
                  const label = buildEntityLabel(creativeTitle, row.ad_id ?? null, "Ad")
                  const campaignName = normalizeLabel(row.campaign_name ?? row.adset_name ?? null)
                  const campaignLabel =
                    campaignName ??
                    (row.campaign_id != null ? `Campaign #${row.campaign_id}` : null) ??
                    (row.adset_id != null ? `Adset #${row.adset_id}` : null) ??
                    "Campaign"
                  const spend = toNumber(row.spend) ?? 0
                  const leads = toNumber(row.fb_leads) ?? 0
                  const crmLeads = toNumber(row.crm_requests_cnt)
                  const contracts = toNumber(row.contracts_cnt) ?? 0
                  const paidSum = toNumber(row.paid_sum)
                  const cpl = row.cpl != null ? toNumber(row.cpl) : leads > 0 ? spend / leads : null
                  const cpa = row.cpa != null ? toNumber(row.cpa) : contracts > 0 ? spend / contracts : null
                  const roas =
                    row.roas_paid != null
                      ? toNumber(row.roas_paid)
                      : paidSum != null && spend > 0
                        ? paidSum / spend
                        : null
                  const previewUrl = row.preview_image_url ?? row.thumbnail_url ?? row.media_image_src ?? null
                  const previewLink = row.permalink_url ?? row.link_url ?? null
                  const fallbackUrl = buildAdsLibraryUrl(row.ad_id ?? null)
                  const openUrl = previewLink ?? fallbackUrl
                  return (
                    <div
                      key={`${row.ad_id ?? label.title}-${index}`}
                      className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <PreviewImage src={previewUrl} alt={label.title} href={openUrl} fallbackUrl={fallbackUrl} />
                          <div>
                            <div className="text-sm font-semibold">{label.title}</div>
                            <div className="text-xs text-muted-foreground">Campaign: {campaignLabel}</div>
                          </div>
                        </div>
                        {renderPlatformBadge("meta")}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">CPL {cpl == null ? "—" : formatMoney(cpl)}</Badge>
                        <Badge variant="secondary">CPA {cpa == null ? "—" : formatMoney(cpa)}</Badge>
                        <Badge variant="secondary">
                          ROAS{" "}
                          {roas == null
                            ? "—"
                            : formatNumber(roas, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(spend)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {crmLeads != null ? "CRM leads" : "Platform leads"}
                          </div>
                          <div className="font-semibold">{formatNumber(crmLeads ?? leads)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Contracts</div>
                          <div className="font-semibold">{formatNumber(contracts)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Paid sum</div>
                          <div className="font-semibold">{formatMoney(paidSum)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : metaAdsTopMissing ? (
            <AnalyticsEmptyState
              title="Немає Meta оголошень"
              description="Перевірте SEM витрину meta_ads_top_daily."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає Meta оголошень"
              description="Перевірте Meta підключення або вибраний період."
              context="ads"
              size="sm"
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>GA4 Meta Events</CardTitle>
            </CardHeader>
            <CardContent>
              {ga4MetaEvents.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {ga4MetaEvents.map((row, index) => (
                    <div key={`${row.eventName}-${index}`} className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{row.eventName}</div>
                        <Badge variant="outline">GA4</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {row.channelGroup || "—"}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Conversions</div>
                          <div className="font-semibold">{formatNumber(row.conversions)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Revenue</div>
                          <div className="font-semibold">{formatMoney(row.revenue)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <WidgetStatus
                  title="Meta GA4 events not found"
                  description="GA4 события Meta не найдены в выбранном периоде."
                />
              )}
            </CardContent>
          </Card>

          {false && (
          <Card>
            <CardHeader>
              <CardTitle>Creatives diagnostics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Performance daily</div>
                {adsCreativeMissing.performance ? (
                  <WidgetStatus title="Нет витрины performance" description="ads.creative_performance_daily не подключена." />
                ) : (
                  <WidgetTable rows={adsCreativePerformanceRows} emptyLabel={isLoadingCreativeExtras ? "Loading..." : "Нет данных performance."} />
                )}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Fatigue daily</div>
                {adsCreativeMissing.fatigue ? (
                  <WidgetStatus title="Нет витрины fatigue" description="ads.creative_fatigue_daily не подключена." />
                ) : (
                  <WidgetTable rows={adsCreativeFatigueRows} emptyLabel={isLoadingCreativeExtras ? "Loading..." : "Нет данных fatigue."} />
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {isLoadingMetaFatigue ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : metaFatigueDisplay.length > 0 ? (
            <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Creative fatigue 7d</CardTitle>
                    <div className="flex items-center gap-2">
                      <WidgetMiniFilters widgetKey="ads.meta_creative_fatigue_7d" />
                      <Badge variant="secondary">{metaFatigueDisplay.length}</Badge>
                      {metaFatigueDisplay.length > 6 && (
                        <Button size="sm" variant="outline" onClick={() => setShowAllFatigue((prev) => !prev)}>
                          {showAllFatigue ? "Collapse" : "Show all"}
                        </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {(showAllFatigue ? metaFatigueDisplay : metaFatigueDisplay.slice(0, 6)).map((row, index) => {
                  const name = normalizeLabel(row.creative_name) ?? `Creative #${row.creative_id ?? index + 1}`
                  const ctrDelta = row.ctr_delta ?? calcDelta(row.ctr_7d, row.ctr_prev7d).deltaPct
                  const cplDelta = row.cpl_delta ?? calcDelta(row.cpl_7d, row.cpl_prev7d).deltaPct
                  const spendDelta = calcDelta(row.spend_7d, row.spend_prev7d).deltaPct
                  const previewUrl = row.preview_image_url ?? row.thumbnail_url ?? null
                  const previewLink = row.permalink_url ?? row.link_url ?? null
                  return (
                    <div
                      key={`${row.creative_id ?? name}-${index}`}
                      className="rounded-xl border border-border bg-card/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <PreviewImage src={previewUrl} alt={name} href={previewLink} />
                          <div>
                            <div className="text-sm font-semibold">{name}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.object_type ?? row.creative_type ?? "—"}
                            </div>
                          </div>
                        </div>
                        {renderPlatformBadge(row.platform ?? "meta")}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <DeltaBadge label="CTR" value={ctrDelta} formatter={formatDeltaPercent} />
                        <DeltaBadge label="CPL" value={cplDelta} formatter={formatDeltaPercent} />
                        <DeltaBadge label="Spend" value={spendDelta} formatter={formatDelta} />
                        {row.fatigue_flags != null && row.fatigue_flags > 0 && (
                          <Badge variant="outline">Flags {row.fatigue_flags}</Badge>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend 7d</div>
                          <div className="font-semibold">{formatMoney(row.spend_7d)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Prev 7d</div>
                          <div className="font-semibold">{formatMoney(row.spend_prev7d)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Leads 7d</div>
                          <div className="font-semibold">{formatNumber(row.leads_7d)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">CPL 7d</div>
                          <div className="font-semibold">{formatMoney(row.cpl_7d)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : metaFatigueMissing ? (
            <AnalyticsEmptyState
              title="Немає даних по fatigue"
              description="Перевірте SEM витрину meta_creative_fatigue_7d."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає даних по fatigue"
              description="Після підключення Meta зʼявляться ризики вигорання."
              context="ads"
              size="sm"
            />
          )}

          {isLoadingCreatives || isLoadingMetaCreatives ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-36 w-full" />
              ))}
            </div>
          ) : creativeTypeSummary.length > 0 ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Creative type ranking</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                    <div className="text-xs text-muted-foreground">Top CTR</div>
                    {creativeTypeRanking.bestCtr ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold">
                            {creativeTypeRanking.bestCtr.ctr != null &&
                            creativeTypeRanking.bestCtr.ctr * 100 >= 0.01
                              ? formatPercent(creativeTypeRanking.bestCtr.ctr, { digits: 2 })
                              : "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Spend {formatMoney(creativeTypeRanking.bestCtr.spend)}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs uppercase">
                          {creativeTypeRanking.bestCtr.type === "unknown"
                            ? "Unknown"
                            : creativeTypeRanking.bestCtr.type}
                        </Badge>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-muted-foreground">Немає даних</div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                    <div className="text-xs text-muted-foreground">Best CPA</div>
                    {creativeTypeRanking.bestCpa ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold">
                            {creativeTypeRanking.bestCpa.cpa == null
                              ? "—"
                              : formatMoney(creativeTypeRanking.bestCpa.cpa)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Spend {formatMoney(creativeTypeRanking.bestCpa.spend)}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs uppercase">
                          {creativeTypeRanking.bestCpa.type === "unknown"
                            ? "Unknown"
                            : creativeTypeRanking.bestCpa.type}
                        </Badge>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-muted-foreground">Немає даних</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Creative Type Summary</CardTitle>
                    <WidgetMiniFilters widgetKey="ads.creative_type_summary" />
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {creativeTypeSummary.slice(0, 6).map((row) => (
                    <div key={row.type} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs uppercase">
                          {row.type === "unknown" ? "Unknown" : row.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {row.share != null
                            ? `${formatPercent(row.share, { digits: 1 })} share`
                            : row.count != null
                              ? `${row.count} ads`
                              : "—"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(row.spend)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Leads</div>
                          <div className="font-semibold">{formatNumber(row.leads)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">CTR</div>
                          <div className="font-semibold">{row.ctr == null ? "—" : formatPercent(row.ctr)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">CPA</div>
                          <div className="font-semibold">{row.cpa == null ? "—" : formatMoney(row.cpa)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Top creatives</CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 p-1 text-[11px]">
                        {[
                          { value: "spend", label: "Spend" },
                          { value: "leads", label: "Leads" },
                          { value: "contracts", label: "Contracts" },
                          { value: "roas", label: "ROAS" },
                          { value: "ctr", label: "CTR" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setCreativeSortMode(option.value as CreativeSortMode)}
                            className={`rounded-full px-2 py-1 transition ${
                              creativeSortMode === option.value
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <WidgetMiniFilters widgetKey="ads.creatives_detailed" />
                      <Badge variant="secondary">{topCreatives.length}</Badge>
                      {topCreatives.length > 6 && (
                        <Button size="sm" variant="outline" onClick={() => setShowAllTopCreatives((prev) => !prev)}>
                          {showAllTopCreatives ? "Collapse" : "Show all"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {(showAllTopCreatives ? topCreatives : topCreatives.slice(0, 6)).map((row, index) => {
                    const rawTitle = normalizeLabel(
                      (pickValue(row, [
                        "creative_title",
                        "creative_name",
                        "ad_name",
                        "post_message",
                        "creative_body",
                        "campaign_name",
                      ]) as string | null) ?? null
                    )
                    const campaignId = pickValue(row, ["campaign_id", "adset_id"]) as string | number | null
                    const campaignTitle =
                      normalizeLabel(pickValue(row, ["campaign_name", "adset_name"]) as string | null) ??
                      (campaignId != null ? `Campaign #${campaignId}` : null) ??
                      "Campaign"
                    const creativeType =
                      (pickValue(row, ["object_type", "creative_type"]) as string | null) ?? null
                    const link = (pickValue(row, ["permalink_url", "link_url"]) as string | null) ?? null
                    const previewUrl =
                      (pickValue(row, ["preview_image_url", "thumbnail_url", "media_image_src"]) as string | null) ?? null
                    const adsLibraryId = pickValue(row, ["ad_id"]) as string | number | null
                    const fallbackUrl = buildAdsLibraryUrl(adsLibraryId)
                    const openUrl = link ?? fallbackUrl
                    const adId = pickValue(row, ["ad_id", "creative_id"]) as string | number | null
                    const platformLabel =
                      (pickValue(row, ["platform"]) as string | null) ??
                      (adId ? "meta" : "meta")
                    const label = buildEntityLabel(rawTitle, adId, "Creative")
                    const spend = toNumber((row as { spend?: number | null }).spend) ?? null
                    const clicks = toNumber((row as { clicks?: number | null }).clicks) ?? null
                    const impressions = toNumber((row as { impressions?: number | null }).impressions) ?? null
                    const leads =
                      toNumber((row as { leads_cnt?: number | null }).leads_cnt) ??
                      toNumber((row as { leads?: number | null }).leads) ??
                      toNumber((row as { fb_leads?: number | null }).fb_leads) ??
                      toNumber((row as { conversions?: number | null }).conversions) ??
                      null
                    const contracts = toNumber((row as { contracts_cnt?: number | null }).contracts_cnt) ?? null
                    const revenue = toNumber((row as { revenue_sum?: number | null }).revenue_sum) ?? null
                    const roas =
                      (row as { roas?: number | null }).roas ??
                      (spend && revenue ? revenue / spend : null)
                    const cpl = leads && spend ? spend / leads : null
                    const copyTarget =
                      normalizeLabel(
                        (row as {
                          ad_name?: string | null
                          creative_title?: string | null
                          creative_name?: string | null
                        }).ad_name ??
                          (row as { creative_title?: string | null }).creative_title ??
                          (row as { creative_name?: string | null }).creative_name ??
                          null
                      ) ?? label.title
                    const ctrValue = (row as { ctr?: number | null }).ctr ?? null
                    const displayUrl = openUrl ?? null
                    return (
                      <Card key={`${adId ?? "creative"}-${index}`} className="border-border/60">
                        <CardHeader className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <PreviewImage src={previewUrl} alt={label.title} href={openUrl} fallbackUrl={fallbackUrl} />
                              <div>
                                <CardTitle className="text-base">{label.title}</CardTitle>
                                <p className="text-xs text-muted-foreground">Campaign: {campaignTitle}</p>
                              </div>
                            </div>
                            {renderPlatformBadge(platformLabel ?? "meta")}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {creativeType && (
                              <Badge variant="secondary" className="text-xs">
                                {creativeType}
                              </Badge>
                            )}
                            {ctrValue != null && (
                              <Badge variant="outline" className="text-xs">
                                CTR {ctrValue * 100 < 0.01 ? "—" : formatPercent(ctrValue, { digits: 2 })}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">Spend</div>
                            <div className="font-medium">{formatMoney(spend)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Clicks</div>
                            <div className="font-medium">{formatNumber(clicks)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Leads</div>
                            <div className="font-medium">{formatNumber(leads)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">CPL</div>
                            <div className="font-medium">{cpl == null ? "—" : formatMoney(cpl)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Contracts</div>
                            <div className="font-medium">{formatNumber(contracts)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">ROAS</div>
                            <div className="font-medium">{roas == null ? "—" : formatNumber(roas)}</div>
                          </div>
                          {impressions != null && impressions > 0 && (
                            <div>
                              <div className="text-xs text-muted-foreground">CTR</div>
                              <div className="font-medium">
                                {clicks != null ? formatPercent(clicks / impressions, { digits: 2 }) : "—"}
                              </div>
                            </div>
                          )}
                          {displayUrl && (
                            <div className="col-span-2 text-xs text-muted-foreground truncate" title={displayUrl}>
                              {displayUrl}
                            </div>
                          )}
                          <div className="col-span-2 flex flex-wrap items-center gap-2 pt-2">
                          {openUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => window.open(openUrl, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open
                            </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCopyName(copyTarget, adId)}
                            >
                              <Copy className="h-3 w-3" />
                              {copiedId === (adId ?? copyTarget) ? "Copied" : "Copy name"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Creatives with results</CardTitle>
                    <Badge variant="secondary">{topMetaResultRows.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {topMetaResultRows.length > 0 ? (
                    topMetaResultRows.slice(0, 6).map((row, index) => {
                      const title = normalizeLabel(row.creative_title ?? row.ad_name ?? row.campaign_name ?? null) ?? "Creative"
                      const label = buildEntityLabel(title, row.ad_id ?? null, "Creative")
                      const campaignName = normalizeLabel(row.campaign_name ?? null)
                      const previewUrl = row.preview_image_url ?? row.thumbnail_url ?? row.media_image_src ?? null
                      const previewLink = row.permalink_url ?? row.link_url ?? null
                      const fallbackUrl = buildAdsLibraryUrl(row.ad_id ?? null)
                      const openUrl = previewLink ?? fallbackUrl
                      const spend = toNumber(row.spend) ?? 0
                      const crmLeads = toNumber(row.crm_requests_cnt)
                      const fbLeads = toNumber(row.fb_leads) ?? 0
                      const leads = crmLeads ?? fbLeads
                      const contracts = toNumber(row.contracts_cnt) ?? 0
                      const cpl = leads > 0 ? spend / leads : null
                      const cpa = contracts > 0 ? spend / contracts : null
                      return (
                        <div
                          key={`${row.ad_id ?? label.title}-${index}`}
                          className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <PreviewImage src={previewUrl} alt={label.title} href={openUrl} fallbackUrl={fallbackUrl} />
                              <div>
                                <div className="text-sm font-semibold">{label.title}</div>
                                {campaignName && <div className="text-xs text-muted-foreground">Campaign: {campaignName}</div>}
                              </div>
                            </div>
                            {renderPlatformBadge("meta")}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <Badge variant="secondary">CPL {cpl == null ? "—" : formatMoney(cpl)}</Badge>
                            <Badge variant="secondary">CPA {cpa == null ? "—" : formatMoney(cpa)}</Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <div className="text-xs text-muted-foreground">Spend</div>
                              <div className="font-semibold">{formatMoney(spend)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                {crmLeads != null ? "CRM leads" : "Platform leads"}
                              </div>
                              <div className="font-semibold">{formatNumber(leads)}</div>
                              {crmLeads != null && fbLeads > 0 && (
                                <div className="text-[11px] text-muted-foreground">FB leads: {formatNumber(fbLeads)}</div>
                              )}
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Contracts</div>
                              <div className="font-semibold">{formatNumber(contracts)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Paid sum</div>
                              <div className="font-semibold">{formatMoney(toNumber(row.paid_sum))}</div>
                            </div>
                          </div>
                          {openUrl && (
                            <div className="mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => window.open(openUrl, "_blank")}
                              >
                                <ExternalLink className="h-3 w-3" />
                                Open
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <AnalyticsEmptyState
                      title="Немає креативів з результатом"
                      description="Немає креативів із лідами або контрактами у цьому періоді."
                      context="ads"
                      size="sm"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          ) : creativeTypesMissing || metaCreativesMissing ? (
            <AnalyticsEmptyState
              title="Немає креативів"
              description="Потрібна SEM витрина creative_type_summary або meta_creatives_daily."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає креативів"
              description="Перевірте Meta підключення або вибраний період."
              context="ads"
              size="sm"
            />
          )}
        </TabsContent>

        <TabsContent value={TAB_GADS} className="space-y-4">
          {isLoadingDaily || isLoadingKpi ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <TabKpiStrip title="Google Ads KPI" />
          )}

          {isLoadingGadsCampaignPreviews ? (
            <Skeleton className="h-40 w-full" />
          ) : gadsCampaignPreviewsMissing ? (
            <WidgetStatus
              title="Нет витрины campaign previews"
              description="ads.gads_campaign_previews_daily не подключена."
            />
          ) : gadsCampaignPreviewSummary.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Campaign previews</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {gadsCampaignPreviewSummary.map((row) => {
                  const ctr = row.impressions > 0 ? row.clicks / row.impressions : null
                  const cpc = row.clicks > 0 ? row.spend / row.clicks : null
                  const cpa = row.conversions > 0 ? row.spend / row.conversions : null
                  return (
                    <div key={row.campaignId ?? row.campaignName} className="rounded-xl border border-border bg-card/40 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-24 overflow-hidden rounded-lg bg-muted/60 flex items-center justify-center">
                          <CampaignPreviewThumb src={row.previewImageUrl} hasPreview={row.hasPreview} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold truncate">{row.campaignName}</div>
                            {renderPlatformBadge("gads")}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs">
                            <Badge variant="secondary">CTR {ctr == null ? "—" : formatPercent(ctr)}</Badge>
                            <Badge variant="secondary">CPC {cpc == null ? "—" : formatMoney(cpc)}</Badge>
                            <Badge variant="secondary">CPA {cpa == null ? "—" : formatMoney(cpa)}</Badge>
                            {row.channelType && <Badge variant="outline">{normalizeLabel(row.channelType)}</Badge>}
                          </div>
                          {row.creativeTitle && (
                            <div className="mt-2 text-xs text-muted-foreground truncate">Creative: {row.creativeTitle}</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(row.spend)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Clicks</div>
                          <div className="font-semibold">{formatNumber(row.clicks)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Conversions</div>
                          <div className="font-semibold">{formatNumber(row.conversions)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Impressions</div>
                          <div className="font-semibold">{formatNumber(row.impressions)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : null}

          {gadsCampaignSummary.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Campaign performance</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {gadsCampaignSummary.map((row) => {
                  const ctr = row.impressions > 0 ? row.clicks / row.impressions : null
                  const cpc = row.clicks > 0 ? row.spend / row.clicks : null
                  const cpa = row.conversions > 0 ? row.spend / row.conversions : null
                  const preview = gadsCampaignPreviewMap.get(String(row.campaignId ?? row.campaignName))
                  return (
                    <div key={row.campaignName} className="rounded-xl border border-border bg-card/40 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-24 overflow-hidden rounded-lg bg-muted/60 flex items-center justify-center">
                          <CampaignPreviewThumb src={preview?.previewImageUrl} hasPreview={preview?.hasPreview} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold truncate">{row.campaignName}</div>
                            {renderPlatformBadge("gads")}
                          </div>
                          {preview?.creativeTitle && (
                            <div className="mt-1 text-xs text-muted-foreground truncate">Creative: {preview.creativeTitle}</div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <Badge variant="secondary">CTR {ctr == null ? "—" : formatPercent(ctr)}</Badge>
                            <Badge variant="secondary">CPC {cpc == null ? "—" : formatMoney(cpc)}</Badge>
                            <Badge variant="secondary">CPA {cpa == null ? "—" : formatMoney(cpa)}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(row.spend)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Clicks</div>
                          <div className="font-semibold">{formatNumber(row.clicks)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Conversions</div>
                          <div className="font-semibold">{formatNumber(row.conversions)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Impressions</div>
                          <div className="font-semibold">{formatNumber(row.impressions)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>GA4 Google Events</CardTitle>
            </CardHeader>
            <CardContent>
              {ga4GadsEvents.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {ga4GadsEvents.map((row, index) => (
                    <div key={`${row.eventName}-${index}`} className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{row.eventName}</div>
                        <Badge variant="outline">GA4</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {row.channelGroup || "—"}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Conversions</div>
                          <div className="font-semibold">{formatNumber(row.conversions)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Revenue</div>
                          <div className="font-semibold">{formatMoney(row.revenue)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <WidgetStatus
                  title="Google GA4 events not found"
                  description="GA4 события Google Ads не найдены в выбранном периоде."
                />
              )}
            </CardContent>
          </Card>

          {isLoadingGadsRequests || isLoadingGadsLeads ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : gadsDemandSummary.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>CRM requests & leads by campaign</CardTitle>
                  <div className="flex items-center gap-2">
                    <WidgetMiniFilters widgetKey="ads.gads_requests_by_campaign_daily" />
                    <Badge variant="secondary">{gadsDemandSummary.length}</Badge>
                    {gadsDemandSummary.length > 10 && (
                      <Button size="sm" variant="outline" onClick={() => setShowAllGadsDemandRows((prev) => !prev)}>
                        {showAllGadsDemandRows ? "Collapse" : "Show all"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {(showAllGadsDemandRows ? gadsDemandSummary : gadsDemandSummary.slice(0, 10)).map((row) => {
                  const leadRate = row.requests > 0 ? row.leads / row.requests : null
                  const campaignMeta = row.campaignId != null ? `ID ${row.campaignId}` : null
                  return (
                    <div key={`${row.campaignId ?? row.campaignName}`} className="rounded-xl border border-border bg-card/40 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{row.campaignName}</div>
                          {campaignMeta && <div className="text-xs text-muted-foreground">{campaignMeta}</div>}
                        </div>
                        {renderPlatformBadge("gads")}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">Lead rate {leadRate == null ? "—" : formatPercent(leadRate)}</Badge>
                        {row.channelType && (
                          <Badge variant="outline">{normalizeLabel(row.channelType)}</Badge>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Requests</div>
                          <div className="font-semibold">{formatNumber(row.requests)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Leads</div>
                          <div className="font-semibold">{formatNumber(row.leads)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Click IDs (req)</div>
                          <div className="font-semibold">{formatNumber(row.requestClicks)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Click IDs (leads)</div>
                          <div className="font-semibold">{formatNumber(row.leadClicks)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : gadsDemandMissing ? (
            <AnalyticsEmptyState
              title="Немає CRM запитів по кампаніях"
              description="Перевірте SEM витрини gads_requests_by_campaign_daily або gads_leads_by_campaign_daily."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає CRM запитів по кампаніях"
              description="Немає CRM лідів або запитів у вибраному періоді."
              context="ads"
              size="sm"
            />
          )}

          {isLoadingGadsKeywordsDaily ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : keywordDailyRows.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Keywords</CardTitle>
                  <div className="flex items-center gap-2">
                    <WidgetMiniFilters widgetKey="ads.gads_keywords_daily" />
                    <Badge variant="secondary">{keywordDailyRows.length}</Badge>
                    {keywordDailyRows.length > 10 && (
                      <Button size="sm" variant="outline" onClick={() => setShowAllKeywordDaily((prev) => !prev)}>
                        {showAllKeywordDaily ? "Collapse" : "Show all"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {(showAllKeywordDaily ? keywordDailyRows : keywordDailyRows.slice(0, 10)).map((row, index) => {
                  const keyword = row.keyword_text ?? "Keyword"
                  const match = row.keyword_match_type ?? "—"
                  const campaignLabel =
                    normalizeLabel(row.campaign_name) ??
                    (row.campaign_id != null ? `Campaign #${row.campaign_id}` : "Campaign")
                  const adGroupLabel =
                    normalizeLabel(row.ad_group_name) ??
                    (row.ad_group_id != null ? `Ad group #${row.ad_group_id}` : "Ad group")
                  const impressions = toNumber(row.impressions) ?? 0
                  const clicks = toNumber(row.clicks) ?? 0
                  const spend = toNumber(row.spend) ?? 0
                  const conversions = toNumber(row.conversions) ?? 0
                  const ctrValue = row.ctr ?? (impressions > 0 ? clicks / impressions : null)
                  const cpcValue = row.cpc ?? (clicks > 0 ? spend / clicks : null)
                  const cpaValue = conversions > 0 ? spend / conversions : null
                  return (
                    <div key={`${keyword}-${index}`} className="rounded-xl border border-border bg-card/40 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{keyword}</div>
                          <div className="text-xs text-muted-foreground">Match: {match}</div>
                          <div className="text-xs text-muted-foreground">Campaign: {campaignLabel}</div>
                          <div className="text-xs text-muted-foreground">Ad group: {adGroupLabel}</div>
                        </div>
                        {renderPlatformBadge("gads")}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">CTR {ctrValue == null ? "—" : formatPercent(ctrValue)}</Badge>
                        <Badge variant="secondary">CPC {cpcValue == null ? "—" : formatMoney(cpcValue)}</Badge>
                        <Badge variant="secondary">CPA {cpaValue == null ? "—" : formatMoney(cpaValue)}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(row.spend_value)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Clicks</div>
                          <div className="font-semibold">{formatNumber(row.clicks_value)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Conversions</div>
                          <div className="font-semibold">{formatNumber(row.conversions_value)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Impressions</div>
                          <div className="font-semibold">{formatNumber(row.impressions_value)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : keywordsDailyMissing ? (
            <AnalyticsEmptyState
              title="Немає keyword daily"
              description="Перевірте SEM витрину gads_keywords_daily."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає keyword daily"
              description="Дані зʼявляться після оновлення Google Ads."
              context="ads"
              size="sm"
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Top keywords (ads)</CardTitle>
            </CardHeader>
            <CardContent>
              {adsGadsMissing.top_keywords ? (
                <WidgetStatus title="Нет витрины top keywords" description="ads.gads.top_keywords не подключена." />
              ) : (
                <WidgetTable
                  rows={adsGadsTopKeywordsRows}
                  emptyLabel={isLoadingGadsTopKeywords ? "Loading..." : "Нет данных top keywords."}
                />
              )}
            </CardContent>
          </Card>

          {isLoadingGadsDevices ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : deviceRows.length > 0 ? (
            <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Device & hour mix</CardTitle>
                    <div className="flex items-center gap-2">
                      <WidgetMiniFilters widgetKey="ads.gads_device_hour_daily" />
                      <Badge variant="secondary">{deviceRows.length}</Badge>
                      {deviceRows.length > 10 && (
                        <Button size="sm" variant="outline" onClick={() => setShowAllDeviceRows((prev) => !prev)}>
                          {showAllDeviceRows ? "Collapse" : "Show all"}
                        </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {(showAllDeviceRows ? deviceRows : deviceRows.slice(0, 10)).map((row, index) => {
                  const device = row.device ?? "Device"
                  const hourLabel = row.hour != null ? `${row.hour.toString().padStart(2, "0")}:00` : "—"
                  const dayLabel = row.day_of_week ?? ""
                  const impressions = toNumber(row.impressions_value) ?? 0
                  const clicks = toNumber(row.clicks_value) ?? 0
                  const spend = toNumber(row.spend_value) ?? 0
                  const ctrValue = row.ctr ?? (impressions > 0 ? clicks / impressions : null)
                  const cpcValue = row.cpc ?? (clicks > 0 ? spend / clicks : null)
                  return (
                    <div key={`${device}-${index}`} className="rounded-xl border border-border bg-card/40 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{device}</div>
                        {renderPlatformBadge("gads")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {dayLabel ? `${dayLabel} · ${hourLabel}` : hourLabel}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">CTR {ctrValue == null ? "—" : formatPercent(ctrValue)}</Badge>
                        <Badge variant="secondary">CPC {cpcValue == null ? "—" : formatMoney(cpcValue)}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(row.spend_value)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Clicks</div>
                          <div className="font-semibold">{formatNumber(row.clicks_value)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Conversions</div>
                          <div className="font-semibold">{formatNumber(row.conversions_value)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Impressions</div>
                          <div className="font-semibold">{formatNumber(row.impressions_value)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : devicesMissing ? (
            <AnalyticsEmptyState
              title="Немає device даних"
              description="Перевірте SEM витрину gads_device_hour_daily."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає device даних"
              description="Дані зʼявляться після оновлення Google Ads."
              context="ads"
              size="sm"
            />
          )}

          {isLoadingGadsConversions ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : conversionActionRows.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Conversion actions</CardTitle>
                  <div className="flex items-center gap-2">
                    <WidgetMiniFilters widgetKey="ads.gads_conversion_actions_daily" />
                    <Badge variant="secondary">{conversionActionRows.length}</Badge>
                    {conversionActionRows.length > 10 && (
                      <Button size="sm" variant="outline" onClick={() => setShowAllConversionRows((prev) => !prev)}>
                        {showAllConversionRows ? "Collapse" : "Show all"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {(showAllConversionRows ? conversionActionRows : conversionActionRows.slice(0, 10)).map((row, index) => (
                  <div key={`${row.conversion_action_name ?? row.conversion_action_category ?? "conv"}-${index}`} className="rounded-xl border border-border bg-card/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {row.conversion_action_name ?? row.conversion_action_category ?? "Conversion"}
                        </div>
                        {row.conversion_action_category && (
                          <div className="text-xs text-muted-foreground">Category: {row.conversion_action_category}</div>
                        )}
                      </div>
                      {renderPlatformBadge("gads")}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Conversions</div>
                        <div className="font-semibold">{formatNumber(row.conversions_value)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">All conversions</div>
                        <div className="font-semibold">{formatNumber(row.all_conversions_value)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Share</div>
                        <div className="font-semibold">
                          {row.conversions_share_pct_value == null
                            ? "—"
                            : formatPercent(row.conversions_share_pct_value, { digits: 1 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">CPA</div>
                        <div className="font-semibold">
                          {row.cpa_value == null ? "—" : formatMoney(row.cpa_value)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Value</div>
                        <div className="font-semibold">{formatMoney(row.value_value)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Kef proxy</div>
                        <div className="font-semibold">
                          {row.kef_proxy_value == null ? "—" : formatNumber(row.kef_proxy_value)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : conversionsMissing ? (
            <AnalyticsEmptyState
              title="Conversion actions недоступні"
              description="Перевірте SEM витрину gads_conversion_actions_daily."
              context="ads"
              size="sm"
            />
          ) : gadsConversionsTotal > 0 ? (
            <AnalyticsEmptyState
              title="Conversion actions без маппинга"
              description="Факти конверсій є, але довідник conversion actions не підʼєднаний."
              context="ads"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає conversion actions"
              description="За вибраний період конверсій не було."
              context="ads"
              size="sm"
            />
          )}

          {adGroupRows.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Ad groups snapshot</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {adGroupRows.map((row) => (
                  <div key={row.name} className="rounded-xl border border-border bg-card/40 p-4">
                    <div className="text-sm font-semibold">{row.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">CTR {formatPercent(row.ctr, { digits: 2 })}</Badge>
                      <Badge variant="secondary">CPA {row.cpa == null ? "—" : formatMoney(row.cpa)}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Spend</div>
                        <div className="font-semibold">{formatMoney(row.spend)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Clicks</div>
                        <div className="font-semibold">{formatNumber(row.clicks)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Conversions</div>
                        <div className="font-semibold">{formatNumber(row.conversions)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Impressions</div>
                        <div className="font-semibold">{formatNumber(row.impressions)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <AnalyticsEmptyState
              title="Немає ad group даних"
              description="Після підключення keyword view зʼявляться групи оголошень."
              context="ads"
              size="sm"
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>GA4 Campaign Touchpoints</CardTitle>
            </CardHeader>
            <CardContent>
              {ga4SearchCreativeTop.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {ga4SearchCreativeTop.map((row, index) => (
                    <div key={`${row.creativeId}-${index}`} className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{row.campaignName}</div>
                        <Badge variant="outline">{row.campaignType}</Badge>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {row.adGroupName} · {row.creativeId}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(row.spend)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Users</div>
                          <div className="font-semibold">{formatNumber(row.users)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">CTR</div>
                          <div className="font-semibold">{row.ctr == null ? "—" : formatPercent(row.ctr)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <WidgetStatus
                  title="GA4 campaign touchpoints not found"
                  description="GA4 ads_creative_performance_daily не вернул строк для Google Ads."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value={TAB_PMAX} className="space-y-4">
          {isLoadingGadsSpend || isLoadingGadsPmax ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : pmaxCampaigns.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>PMax campaigns</CardTitle>
                  <WidgetMiniFilters widgetKey="ads.gads_pmax_daily" />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {pmaxCampaigns.map((row) => (
                  <div key={row.name} className="rounded-xl border border-border bg-card/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{row.name}</div>
                      {renderPlatformBadge("gads")}
                    </div>
                    {(row.assetName || row.assetType) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.assetName ? `Asset: ${row.assetName}` : "Asset"}
                        {row.assetType ? ` · ${row.assetType}` : ""}
                      </div>
                    )}
                    <div className="mt-3">
                      {row.previewImageUrl ? (
                        <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                          <img
                            src={row.previewImageUrl}
                            alt={row.assetName ?? row.name}
                            className="h-28 w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
                          {row.previewStatus === "non_image" ? "Non-image asset" : "Missing preview"}
                        </div>
                      )}
                      {row.previewWidth && row.previewHeight && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {row.previewWidth}×{row.previewHeight}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">CTR {formatPercent(row.ctr, { digits: 2 })}</Badge>
                      <Badge variant="secondary">CPA {row.cpa == null ? "—" : formatMoney(row.cpa)}</Badge>
                      <Badge variant="secondary">CPM {row.cpm == null ? "—" : formatMoney(row.cpm)}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Spend</div>
                        <div className="font-semibold">{formatMoney(row.spend)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Clicks</div>
                        <div className="font-semibold">{formatNumber(row.clicks)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Conversions</div>
                        <div className="font-semibold">{formatNumber(row.conversions)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Impressions</div>
                        <div className="font-semibold">{formatNumber(row.impressions)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <AnalyticsEmptyState
              title="PMax даних немає"
              description="Якщо PMax активний, перевірте advertising_channel_type у gads_spend_daily."
              context="ads"
              size="sm"
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>GA4 PMax Touchpoints</CardTitle>
            </CardHeader>
            <CardContent>
              {ga4PmaxCreativeTop.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {ga4PmaxCreativeTop.map((row, index) => (
                    <div key={`${row.creativeId}-${index}`} className="rounded-xl border border-border/60 bg-card/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{row.campaignName}</div>
                        <Badge variant="outline">{row.networkType}</Badge>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {row.adGroupName} · {row.creativeId}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Spend</div>
                          <div className="font-semibold">{formatMoney(row.spend)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Users</div>
                          <div className="font-semibold">{formatNumber(row.users)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">ROAS</div>
                          <div className="font-semibold">
                            {row.roas == null ? "—" : formatNumber(row.roas, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <WidgetStatus
                  title="GA4 PMax rows not found"
                  description="GA4 ads_creative_performance_daily не вернул строк по Performance Max."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
