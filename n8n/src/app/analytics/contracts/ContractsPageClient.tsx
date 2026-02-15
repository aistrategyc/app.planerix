"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { AnalyticsFilters, AnalyticsFiltersValue } from "@/app/analytics/components/AnalyticsFilters"
import { KpiSparkline } from "@/app/analytics/components/KpiSparkline"
import { WidgetStatus } from "@/app/analytics/components/WidgetStatus"
import { InsightsPanel } from "@/app/analytics/components/InsightsPanel"
import { buildLastWeekRange } from "@/app/analytics/utils/defaults"
import { formatCurrency, formatNumber, formatPercent } from "@/app/analytics/utils/formatters"
import { fetchWidget, fetchWidgetsBatch, fetchWidgetRange, WidgetRangeResponse } from "@/lib/api/analytics-widgets"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { Area, CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from "@/contexts/auth-context"
import { CHART_COLORS, chartAxisProps, chartGridProps, chartTooltipItemStyle, chartTooltipStyle } from "@/components/analytics/chart-theme"
import { PageHeader } from "@/components/layout/PageHeader"
import { WidgetTable } from "@/components/analytics/WidgetTable"
import { SafeResponsiveContainer } from "@/components/analytics/SafeResponsiveContainer"

interface ContractsDailyRow {
  date_key: string
  id_city?: number | null
  city_name?: string | null
  channel?: string | null
  contracts_cnt?: number | null
  revenue_total_cost?: number | null
  payments_sum?: number | null
}

interface AttributionDailyRow {
  date_key: string
  id_city?: number | null
  channel?: string | null
  contracts_cnt?: number | null
}

interface ContractsAttributedRow {
  contract_id?: string | null
  contract_date?: string | null
  contract_date_key?: string | null
  id_city?: number | null
  city_name?: string | null
  attributed_platform?: string | null
  campaign_name?: string | null
  ad_name?: string | null
  product?: string | null
  product_name?: string | null
  course_name?: string | null
  form_name?: string | null
  meta_campaign_name?: string | null
  meta_adset_name?: string | null
  meta_ad_name?: string | null
  meta_ad_id?: string | number | null
  gads_campaign_name?: string | null
  gads_ad_group_name?: string | null
  gads_campaign_label_hint?: string | null
  creative_id?: string | number | null
  creative_title?: string | null
  preview_image_url?: string | null
  permalink_url?: string | null
  display_title?: string | null
  display_channel?: string | null
  offline_source_type_label?: string | null
  offline_owner_name?: string | null
  total_cost?: number | null
  payments_sum?: number | null
}

interface TopCampaignRow {
  campaign_id?: string | null
  campaign_name?: string | null
  platform?: string | null
  contracts_cnt?: number | null
  revenue_total_cost?: number | null
  payments_sum?: number | null
}

interface PaidCreativeContractRow {
  contract_date_key?: string | null
  contract_id?: string | number | null
  id_city?: number | null
  city_name?: string | null
  channel?: string | null
  platform?: string | null
  campaign_name?: string | null
  ad_name?: string | null
  creative_id?: string | number | null
  creative_title?: string | null
  preview_image_url?: string | null
  permalink_url?: string | null
  total_cost?: number | null
  paid_sum?: number | null
  payments_sum?: number | null
}

interface FormUnitEconomicsRow {
  date_key?: string | null
  form_id?: string | number | null
  form_name?: string | null
  product_name?: string | null
  leads_cnt?: number | null
  contracts_cnt?: number | null
  contracts_sum?: number | null
  revenue_sum?: number | null
  planned_first_pay?: number | null
  payments_sum?: number | null
  currency_code?: string | null
}

interface MetaContractsRow {
  date_key?: string | null
  id_city?: number | null
  city_name?: string | null
  campaign_name?: string | null
  adset_name?: string | null
  ad_name?: string | null
  contracts_cnt?: number | null
}

interface GadsContractsRow {
  date_key?: string | null
  id_city?: number | null
  city_name?: string | null
  campaign_name?: string | null
  advertising_channel_type?: string | null
  contracts_cnt?: number | null
}

interface ProductAttributionRow {
  date_key?: string | null
  id_city?: number | null
  city_name?: string | null
  platform?: string | null
  product_id?: number | null
  course_id?: number | null
  product_name?: string | null
  course_name?: string | null
  contracts_cnt?: number | null
  revenue_sum?: number | null
  payments_sum?: number | null
  avg_check?: number | null
}

interface ProductAttributedDetailRow {
  [k: string]: unknown
  contract_date_key?: string | null
  id_city?: number | null
  creative_id?: string | number | null
  creative_title?: string | null
  preview_image_url?: string | null
  product_id?: number | null
  product_name?: string | null
  paid_sum?: number | null
  contract_id?: string | number | null
}

interface LeadsCohortRow {
  date_key?: string | null
  lead_day_key?: string | null
  id_city?: number | null
  platform?: string | null
  leads_cnt?: number | null
  contracts_cnt_7d?: number | null
  contracts_cnt_14d?: number | null
  contracts_cnt_30d?: number | null
  revenue_30d?: number | null
}

interface KpiDecompositionRow {
  date_key?: string | null
  city_id?: number | null
  dimension_type?: string | null
  dimension_value?: string | null
  spend?: number | null
  leads_cnt?: number | null
  contracts_cnt?: number | null
  revenue_sum?: number | null
  payments_sum?: number | null
  cpl?: number | null
  cac?: number | null
  roas?: number | null
}

interface LeadJourneyRow {
  date_key?: string | null
  city_id?: number | null
  city_name?: string | null
  lead_id?: string | number | null
  first_contact_at?: string | null
  lead_status?: string | null
  lead_course_name?: string | null
  first_form_name?: string | null
  first_utm_source?: string | null
  contract_id?: string | number | null
  contract_date?: string | null
  product_name?: string | null
  revenue_sum?: number | null
  payments_sum?: number | null
  platform?: string | null
  source?: string | null
  lead_score?: number | null
  temperature?: string | null
}

interface LeadCreativeInteractionRow {
  date_key?: string | null
  lead_id?: string | number | null
  city_id?: number | null
  creative_id?: string | number | null
  creative_title?: string | null
  platform?: string | null
  touch_count?: number | null
  last_touch_ts?: string | null
  attributed_flag?: boolean | null
  time_to_contract_days?: number | null
}

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
    return { label: "Unknown", dotClass: "bg-slate-300", hint: "Unknown platform", short: "?" }
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

const getCoverageBadge = (ratio: number | null) => {
  if (ratio == null) return { label: "No data", variant: "outline" as const }
  if (ratio >= 0.4) return { label: "High coverage", variant: "success" as const }
  if (ratio >= 0.2) return { label: "Medium coverage", variant: "warning" as const }
  return { label: "Low coverage", variant: "destructive" as const }
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

const parseDateValue = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getTime()
}

const formatContractDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("uk-UA")
}

export default function ContractsPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const { cities } = useCities()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const canFetch = isAuthenticated && !authLoading
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersValue>({
    dateRange: {},
    cityId: "all",
  })
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFiltersValue>({
    dateRange: {},
    cityId: "all",
  })
  const [contractsDaily, setContractsDaily] = useState<ContractsDailyRow[]>([])
  const [attributionDaily, setAttributionDaily] = useState<AttributionDailyRow[]>([])
  const [attributedContracts, setAttributedContracts] = useState<ContractsAttributedRow[]>([])
  const [topCampaigns, setTopCampaigns] = useState<TopCampaignRow[]>([])
  const [paidCreativesContracts, setPaidCreativesContracts] = useState<PaidCreativeContractRow[]>([])
  const [metaContracts, setMetaContracts] = useState<MetaContractsRow[]>([])
  const [gadsContracts, setGadsContracts] = useState<GadsContractsRow[]>([])
  const [productAttribution, setProductAttribution] = useState<ProductAttributionRow[]>([])
  const [productAttributedDetail, setProductAttributedDetail] = useState<ProductAttributedDetailRow[]>([])
  const [leadsCohort, setLeadsCohort] = useState<LeadsCohortRow[]>([])
  const [kpiDecompositionRows, setKpiDecompositionRows] = useState<KpiDecompositionRow[]>([])
  const [leadJourneyRows, setLeadJourneyRows] = useState<LeadJourneyRow[]>([])
  const [leadCreativeRows, setLeadCreativeRows] = useState<LeadCreativeInteractionRow[]>([])
  const [productAttributionMissing, setProductAttributionMissing] = useState(false)
  const [productAttributedDetailMissing, setProductAttributedDetailMissing] = useState(false)
  const [leadsCohortMissing, setLeadsCohortMissing] = useState(false)
  const [kpiDecompositionMissing, setKpiDecompositionMissing] = useState(false)
  const [leadJourneyMissing, setLeadJourneyMissing] = useState(false)
  const [leadCreativeMissing, setLeadCreativeMissing] = useState(false)
  const [metaByAdMissing, setMetaByAdMissing] = useState(false)
  const [gadsByCampaignMissing, setGadsByCampaignMissing] = useState(false)
  const [paidCreativesMissing, setPaidCreativesMissing] = useState(false)
  const [gadsRange, setGadsRange] = useState<WidgetRangeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [formUnitRows, setFormUnitRows] = useState<FormUnitEconomicsRow[]>([])
  const [formUnitMissing, setFormUnitMissing] = useState(false)
  const [isLoadingFormUnit, setIsLoadingFormUnit] = useState(false)
  const [showAllTopCampaigns, setShowAllTopCampaigns] = useState(false)
  const [showAllAttributed, setShowAllAttributed] = useState(false)
  const [attributedMode, setAttributedMode] = useState<"paid" | "creative" | "all">("paid")
  const [showAllPaidCreatives, setShowAllPaidCreatives] = useState(false)
  const [showAllMetaContracts, setShowAllMetaContracts] = useState(false)
  const [showAllGadsContracts, setShowAllGadsContracts] = useState(false)
  const [showAllKpiDecomposition, setShowAllKpiDecomposition] = useState(false)
  const [showAllLeadJourney, setShowAllLeadJourney] = useState(false)
  const [showAllLeadCreatives, setShowAllLeadCreatives] = useState(false)
  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [defaultRange, setDefaultRange] = useState<{ from: Date; to: Date } | null>(null)
  const insightsDateFrom = appliedFilters.dateRange.from ? buildDateKey(appliedFilters.dateRange.from) : undefined
  const insightsDateTo = appliedFilters.dateRange.to ? buildDateKey(appliedFilters.dateRange.to) : undefined

  useEffect(() => {
    const nextFilters: AnalyticsFiltersValue = {
      dateRange: {
        from: parseDateParam(searchParams.get("date_from")),
        to: parseDateParam(searchParams.get("date_to")),
      },
      cityId: searchParams.get("id_city") ?? "all",
    }
    setDraftFilters(nextFilters)
    setAppliedFilters(nextFilters)
  }, [searchKey, searchParams])

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
        const range = await fetchWidgetRange("contracts.daily_city")
        if (!active) return
        const dateRange = buildLastWeekRange(range.max_date)
        if (!dateRange) {
          setDefaultsApplied(true)
          return
        }
        const nextFilters: AnalyticsFiltersValue = {
          dateRange,
          cityId: draftFilters.cityId,
        }
        setDefaultRange(dateRange)
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
  }, [defaultsApplied, draftFilters.cityId, searchParams, canFetch])

  useEffect(() => {
    if (!canFetch) return
    let active = true
    const loadGadsRange = async () => {
      try {
        const range = await fetchWidgetRange("contracts.gads_by_campaign_daily")
        if (active) setGadsRange(range ?? null)
      } catch {
        if (active) setGadsRange(null)
      }
    }
    loadGadsRange()
    return () => {
      active = false
    }
  }, [canFetch])

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
    })
  }

  const resetFilters = () => {
    const resetValue: AnalyticsFiltersValue = {
      dateRange: defaultRange ?? {},
      cityId: "all",
    }
    setDraftFilters(resetValue)
    setAppliedFilters(resetValue)
    updateQuery({
      date_from: resetValue.dateRange.from ? buildDateKey(resetValue.dateRange.from) : null,
      date_to: resetValue.dateRange.to ? buildDateKey(resetValue.dateRange.to) : null,
      id_city: null,
    })
  }

  const applyGadsLastRange = () => {
    if (!gadsRange?.max_date) return
    const nextRange = buildLastWeekRange(gadsRange.max_date)
    if (!nextRange) return
    const nextFilters: AnalyticsFiltersValue = {
      dateRange: nextRange,
      cityId: draftFilters.cityId,
    }
    setDraftFilters(nextFilters)
    setAppliedFilters(nextFilters)
    updateQuery({
      date_from: nextFilters.dateRange.from ? buildDateKey(nextFilters.dateRange.from) : null,
      date_to: nextFilters.dateRange.to ? buildDateKey(nextFilters.dateRange.to) : null,
      id_city: nextFilters.cityId === "all" ? null : nextFilters.cityId,
    })
  }

  const clearData = useCallback(() => {
    setContractsDaily([])
    setAttributionDaily([])
    setAttributedContracts([])
    setTopCampaigns([])
    setPaidCreativesContracts([])
    setMetaContracts([])
    setGadsContracts([])
    setProductAttribution([])
    setProductAttributedDetail([])
    setLeadsCohort([])
    setKpiDecompositionRows([])
    setLeadJourneyRows([])
    setLeadCreativeRows([])
    setProductAttributionMissing(false)
    setProductAttributedDetailMissing(false)
    setLeadsCohortMissing(false)
    setKpiDecompositionMissing(false)
    setLeadJourneyMissing(false)
    setLeadCreativeMissing(false)
    setMetaByAdMissing(false)
    setGadsByCampaignMissing(false)
    setPaidCreativesMissing(false)
  }, [])

  useEffect(() => {
    if (!canFetch) return
    if (!appliedFilters.dateRange.from || !appliedFilters.dateRange.to) {
      if (!defaultsApplied) return
      setIsLoading(false)
      clearData()
      return
    }
    let active = true
    const load = async () => {
      setIsLoading(true)
      try {
        const globalFilters: Record<string, string | number | undefined> = {
          date_from: appliedFilters.dateRange.from ? buildDateKey(appliedFilters.dateRange.from) : undefined,
          date_to: appliedFilters.dateRange.to ? buildDateKey(appliedFilters.dateRange.to) : undefined,
          id_city: appliedFilters.cityId === "all" ? undefined : Number(appliedFilters.cityId),
        }
        const channelFilters = {}
        const paidFilters = {}

        const widgets = [
          { widget_key: "contracts.daily_city", filters: channelFilters, limit: 200 },
          { widget_key: "contracts.attribution_daily_city", filters: channelFilters, limit: 200 },
          { widget_key: "contracts.attributed", order_by: "-contract_date_key", limit: 200 },
          { widget_key: "contracts.product_attribution_daily_city", filters: paidFilters, order_by: "-revenue_sum", limit: 200 },
          { widget_key: "contracts.product_attributed_detail", filters: paidFilters, order_by: "-paid_sum", limit: 200 },
          { widget_key: "contracts.leads_cohort", filters: channelFilters, order_by: "-date_key", limit: 200 },
          { widget_key: "contracts.kpi_decomposition", filters: channelFilters, order_by: "-revenue_sum", limit: 200 },
          { widget_key: "contracts.leads_journey", filters: channelFilters, order_by: "-payments_sum", limit: 200 },
          { widget_key: "contracts.lead_creative_interactions", filters: channelFilters, order_by: "-touch_count", limit: 200 },
        ]

        widgets.push(
          { widget_key: "contracts.top_campaigns", filters: paidFilters, order_by: "-contracts_cnt", limit: 200 },
          { widget_key: "contracts.paid_creatives_top", filters: paidFilters, order_by: "-paid_sum", limit: 1000 },
          { widget_key: "contracts.meta_by_ad_daily", filters: paidFilters, order_by: "-contracts_cnt", limit: 200 },
          { widget_key: "contracts.gads_by_campaign_daily", filters: paidFilters, order_by: "-contracts_cnt", limit: 200 }
        )

        const batch = await fetchWidgetsBatch({
          global_filters: globalFilters,
          widgets,
        })

        const contractsDailyRes = batch.items["contracts.daily_city"]
        const attributionDailyRes = batch.items["contracts.attribution_daily_city"]
        const attributedRes = batch.items["contracts.attributed"]
        const productAttributionRes = batch.items["contracts.product_attribution_daily_city"]
        const productAttributedDetailRes = batch.items["contracts.product_attributed_detail"]
        const leadsCohortRes = batch.items["contracts.leads_cohort"]
        const kpiDecompositionRes = batch.items["contracts.kpi_decomposition"]
        const leadJourneyRes = batch.items["contracts.leads_journey"]
        const leadCreativeRes = batch.items["contracts.lead_creative_interactions"]
        const topCampaignsRes = batch.items["contracts.top_campaigns"]
        const paidCreativesRes = batch.items["contracts.paid_creatives_top"]
        const metaByAdRes = batch.items["contracts.meta_by_ad_daily"]
        const gadsByCampaignRes = batch.items["contracts.gads_by_campaign_daily"]

        if (!active) return
        const rawAttributed = (attributedRes?.items ?? []) as ContractsAttributedRow[]

        setContractsDaily((contractsDailyRes?.items ?? []) as unknown as ContractsDailyRow[])
        setAttributionDaily((attributionDailyRes?.items ?? []) as unknown as AttributionDailyRow[])
        setAttributedContracts(rawAttributed)
        setTopCampaigns((topCampaignsRes?.items ?? []) as TopCampaignRow[])
        setPaidCreativesContracts((paidCreativesRes?.items ?? []) as PaidCreativeContractRow[])
        setPaidCreativesMissing(Boolean(paidCreativesRes?.missing_view || paidCreativesRes?.missing_columns))
        setMetaContracts((metaByAdRes?.items ?? []) as MetaContractsRow[])
        setMetaByAdMissing(Boolean(metaByAdRes?.missing_view))
        setGadsContracts((gadsByCampaignRes?.items ?? []) as GadsContractsRow[])
        setGadsByCampaignMissing(Boolean(gadsByCampaignRes?.missing_view))
        setProductAttribution((productAttributionRes?.items ?? []) as ProductAttributionRow[])
        setProductAttributionMissing(Boolean(productAttributionRes?.missing_view))
        setProductAttributedDetail((productAttributedDetailRes?.items ?? []) as ProductAttributedDetailRow[])
        setProductAttributedDetailMissing(Boolean(productAttributedDetailRes?.missing_view))
        setLeadsCohort((leadsCohortRes?.items ?? []) as LeadsCohortRow[])
        setLeadsCohortMissing(Boolean(leadsCohortRes?.missing_view))
        setKpiDecompositionRows((kpiDecompositionRes?.items ?? []) as KpiDecompositionRow[])
        setKpiDecompositionMissing(Boolean(kpiDecompositionRes?.missing_view))
        setLeadJourneyRows((leadJourneyRes?.items ?? []) as LeadJourneyRow[])
        setLeadJourneyMissing(Boolean(leadJourneyRes?.missing_view))
        setLeadCreativeRows((leadCreativeRes?.items ?? []) as LeadCreativeInteractionRow[])
        setLeadCreativeMissing(Boolean(leadCreativeRes?.missing_view))
      } catch (error) {
        if (!active) return
        console.error("Failed to load contracts data:", error)
        clearData()
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [appliedFilters, canFetch, defaultsApplied, clearData])

  const data = useMemo(
    () => ({
      contracts_daily: contractsDaily,
      attribution_daily: attributionDaily,
      contracts_attributed: attributedContracts,
      top_campaigns: topCampaigns,
      paid_creatives_contracts: paidCreativesContracts,
      meta_contracts_by_ad: metaContracts,
      gads_contracts_by_campaign: gadsContracts,
    }),
    [attributionDaily, attributedContracts, contractsDaily, gadsContracts, metaContracts, topCampaigns, paidCreativesContracts]
  )

  const paidCreativesTop = useMemo(() => {
    const bucket = new Map<
      string,
      {
        key: string
        platform: string
        channel?: string | null
        campaignLabel: string
        adLabel?: string | null
        creativeId?: string | number | null
        creativeTitle?: string | null
        previewImageUrl?: string | null
        permalinkUrl?: string | null
        contractsCnt: number
        paidSum: number
        paymentsSum: number
        lastContractDateKey?: string | null
      }
    >()

    data.paid_creatives_contracts.forEach((row) => {
      const platform = (row.platform ?? row.channel ?? "unknown") as string
      const campaign = row.campaign_name ?? "Campaign"
      const ad = row.ad_name ?? null
      const creativeId = row.creative_id ?? null
      const key = `${platform}::${campaign}::${ad ?? ""}::${creativeId ?? ""}`

      const existing = bucket.get(key)
      const entry = existing ?? {
        key,
        platform,
        channel: row.channel,
        campaignLabel: campaign,
        adLabel: ad,
        creativeId,
        creativeTitle: row.creative_title ?? null,
        previewImageUrl: row.preview_image_url ?? null,
        permalinkUrl: row.permalink_url ?? null,
        contractsCnt: 0,
        paidSum: 0,
        paymentsSum: 0,
        lastContractDateKey: row.contract_date_key ?? null,
      }

      entry.contractsCnt += 1
      entry.paidSum += toNumber(row.paid_sum) ?? 0
      entry.paymentsSum += toNumber(row.payments_sum) ?? 0

      if (!entry.previewImageUrl && row.preview_image_url) entry.previewImageUrl = row.preview_image_url
      if (!entry.permalinkUrl && row.permalink_url) entry.permalinkUrl = row.permalink_url
      if (!entry.creativeTitle && row.creative_title) entry.creativeTitle = row.creative_title

      const nextDate = row.contract_date_key ?? null
      if (nextDate && (!entry.lastContractDateKey || nextDate > entry.lastContractDateKey)) {
        entry.lastContractDateKey = nextDate
      }

      bucket.set(key, entry)
    })

    return Array.from(bucket.values()).sort((a, b) => b.paidSum - a.paidSum)
  }, [data.paid_creatives_contracts])

  const paidCreativesCoverage = useMemo(() => {
    const total = data.paid_creatives_contracts.length
    const withPreview = data.paid_creatives_contracts.filter((r) => Boolean(r.preview_image_url)).length
    return { total, withPreview }
  }, [data.paid_creatives_contracts])

  const productSummary = useMemo(() => {
    const bucket = new Map<
      string,
      {
        product_name: string
        platform?: string | null
        contracts: number
        revenue: number
        payments: number
      }
    >()
    productAttribution.forEach((row) => {
      const name =
        row.product_name ??
        row.course_name ??
        (row.product_id != null ? `Product #${row.product_id}` : row.course_id != null ? `Course #${row.course_id}` : "Product")
      const platform = row.platform
      const key = `${name}::${platform ?? ""}`
      const entry = bucket.get(key) ?? { product_name: name, platform, contracts: 0, revenue: 0, payments: 0 }
      entry.contracts += toNumber(row.contracts_cnt) ?? 0
      entry.revenue += toNumber(row.revenue_sum) ?? 0
      entry.payments += toNumber(row.payments_sum) ?? 0
      bucket.set(key, entry)
    })
    return Array.from(bucket.values()).sort((a, b) => b.revenue - a.revenue)
  }, [productAttribution])

  const productDetailColumns = useMemo(
    () => [
      "contract_date_key",
      "city_name",
      "id_city",
      "product_name",
      "paid_sum",
      "contract_id",
      "creative_title",
      "preview_image_url",
      "creative_id",
    ],
    []
  )

  const productDetailLabels = useMemo(
    () => ({
      contract_date_key: "Date",
      city_name: "City",
      id_city: "City ID",
      product_name: "Product",
      paid_sum: "Paid sum",
      contract_id: "Contract ID",
      creative_title: "Creative",
      preview_image_url: "Preview",
      creative_id: "Creative ID",
    }),
    []
  )

	  const productDetailRenderers = useMemo(
	    () => ({
	      paid_sum: (value: unknown) => (typeof value === "number" ? formatCurrency(value) : formatCurrency(toNumber(value) ?? 0)),
	      preview_image_url: (value: unknown, row: Record<string, unknown>) => {
	        if (!value || typeof value !== "string") {
	          const platform =
	            typeof row?.attributed_platform === "string" ? row.attributed_platform.toLowerCase() : "unknown"
	          const label = ["offline", "other", "unknown", "organic", ""].includes(platform)
            ? "No creative available"
            : "Preview unavailable"
          return <span className="text-xs text-muted-foreground">{label}</span>
        }
        return (
          <div className="h-10 w-16 overflow-hidden rounded-md bg-muted/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Preview" className="h-full w-full object-cover" loading="lazy" />
          </div>
        )
      },
    }),
    []
  )

  const cohortSummary = useMemo(() => {
    return [...leadsCohort]
      .filter((row) => {
        const leads = toNumber(row.leads_cnt) ?? 0
        const c7 = toNumber(row.contracts_cnt_7d) ?? 0
        const c14 = toNumber(row.contracts_cnt_14d) ?? 0
        const c30 = toNumber(row.contracts_cnt_30d) ?? 0
        const revenue = toNumber(row.revenue_30d) ?? 0
        return leads > 0 || c7 > 0 || c14 > 0 || c30 > 0 || revenue > 0
      })
      .sort((a, b) => (a.date_key ?? "").localeCompare(b.date_key ?? ""))
  }, [leadsCohort])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!canFetch) return
      setIsLoadingFormUnit(true)
      try {
        const params: Record<string, string | number | undefined> = {
          limit: 50,
          offset: 0,
          order_by: "-contracts_sum",
        }
        if (appliedFilters.dateRange.from) {
          params.start_date = buildDateKey(appliedFilters.dateRange.from)
        }
        if (appliedFilters.dateRange.to) {
          params.end_date = buildDateKey(appliedFilters.dateRange.to)
        }
        if (appliedFilters.cityId !== "all") {
          params.id_city = Number(appliedFilters.cityId)
        }
        const response = await fetchWidget("crm.form_unit_economics_daily", {
          ...params,
          order_by: "-revenue_sum",
        })
        if (!active) return
        setFormUnitMissing(false)
        setFormUnitRows((response.items ?? []) as FormUnitEconomicsRow[])
      } catch (error) {
        if (!active) return
        console.error("Failed to load form unit economics:", error)
        setFormUnitMissing(true)
        setFormUnitRows([])
      } finally {
        if (active) setIsLoadingFormUnit(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [appliedFilters, canFetch])

  const hasData =
    data.contracts_daily.length > 0 || data.contracts_attributed.length > 0 || data.attribution_daily.length > 0

  const trendData = useMemo(() => {
    if (!data) return []
    const bucket = new Map<string, { date: string; contracts: number }>()
    data.contracts_daily.forEach((row) => {
      const date = row.date_key
      if (!date) return
      const entry = bucket.get(date) ?? { date, contracts: 0 }
      entry.contracts += toNumber(row.contracts_cnt) ?? 0
      bucket.set(date, entry)
    })
    return Array.from(bucket.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  const channelSummary = useMemo(() => {
    if (!data) return []
    const bucket = new Map<string, number>()
    data.attribution_daily.forEach((row) => {
      const key = row.channel ?? "other"
      bucket.set(key, (bucket.get(key) ?? 0) + (toNumber(row.contracts_cnt) ?? 0))
    })
    return Array.from(bucket.entries()).map(([channel, contracts]) => ({ channel, contracts }))
  }, [data])

  const coverageTotals = useMemo(() => {
    const total = attributionDaily.reduce((acc, row) => acc + (toNumber(row.contracts_cnt) ?? 0), 0)
    const paid = attributionDaily.reduce((acc, row) => {
      const channel = row.channel ?? ""
      if (!channel.toLowerCase().includes("paid")) return acc
      return acc + (toNumber(row.contracts_cnt) ?? 0)
    }, 0)
    return { total, paid }
  }, [attributionDaily])

  const coverageTrend = useMemo(() => {
    const bucket = new Map<string, { date: string; total: number; paid: number }>()
    attributionDaily.forEach((row) => {
      const date = row.date_key
      if (!date) return
      const entry = bucket.get(date) ?? { date, total: 0, paid: 0 }
      const value = toNumber(row.contracts_cnt) ?? 0
      entry.total += value
      if ((row.channel ?? "").toLowerCase().includes("paid")) {
        entry.paid += value
      }
      bucket.set(date, entry)
    })
    return Array.from(bucket.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        date: item.date,
        ratio: item.total > 0 ? item.paid / item.total : null,
      }))
  }, [attributionDaily])

  const contractsSparkline = useMemo(
    () => trendData.map((row) => ({ value: row.contracts })),
    [trendData]
  )

  const coverageTotal = coverageTotals.total
  const coveragePaid = coverageTotals.paid
  const coverageRatio = coverageTotal > 0 ? coveragePaid / coverageTotal : null
  const coverageBadge = getCoverageBadge(coverageRatio)

  const cityLookup = useMemo(() => new Map(cities.map((city) => [city.id_city, city.city_name])), [cities])

  const totalTopCampaignContracts = useMemo(() => {
    return data.top_campaigns.reduce((acc, row) => acc + (toNumber(row.contracts_cnt) ?? 0), 0)
  }, [data.top_campaigns])

  const totalMetaContracts = useMemo(() => {
    return metaContracts.reduce((acc, row) => acc + (toNumber(row.contracts_cnt) ?? 0), 0)
  }, [metaContracts])

  const totalGadsContracts = useMemo(() => {
    return gadsContracts.reduce((acc, row) => acc + (toNumber(row.contracts_cnt) ?? 0), 0)
  }, [gadsContracts])

  const resolveCityName = (name?: string | null, id?: number | null) => {
    if (name) return name
    if (id != null && cityLookup.has(id)) {
      return cityLookup.get(id) ?? `City ${id}`
    }
    return id != null ? `City ${id}` : null
  }

  const productDetailByContract = useMemo(() => {
    const map = new Map<string, ProductAttributedDetailRow>()
    productAttributedDetail.forEach((row) => {
      if (row.contract_id == null) return
      const key = String(row.contract_id)
      const existing = map.get(key)
      if (!existing) {
        map.set(key, row)
        return
      }
      const existingPaid = toNumber(existing.paid_sum) ?? 0
      const nextPaid = toNumber(row.paid_sum) ?? 0
      const existingPreview = Boolean(existing.preview_image_url)
      const nextPreview = Boolean(row.preview_image_url)
      if ((!existingPreview && nextPreview) || nextPaid > existingPaid) {
        map.set(key, row)
      }
    })
    return map
  }, [productAttributedDetail])

  const attributedContractsDisplay = useMemo(() => {
    return data.contracts_attributed
      .map((row) => {
        const contractKey = row.contract_id != null ? String(row.contract_id) : null
        const productDetail = contractKey ? productDetailByContract.get(contractKey) : undefined
        const contractDateRaw = row.contract_date_key ?? row.contract_date ?? productDetail?.contract_date_key ?? null
        const contractDateTs = parseDateValue(contractDateRaw)
        const cityLabel =
          row.city_name ??
          (row.id_city != null ? (cityLookup.get(row.id_city) ?? `City ${row.id_city}`) : null)
        const creativeTitle =
          row.creative_title ??
          productDetail?.creative_title ??
          row.display_title ??
          row.meta_ad_name ??
          row.gads_ad_group_name ??
          null
        const creativeId = row.creative_id ?? productDetail?.creative_id ?? null
        const previewImageUrl = row.preview_image_url ?? productDetail?.preview_image_url ?? null
        const campaignLabel =
          row.campaign_name ??
          row.meta_campaign_name ??
          row.gads_campaign_name ??
          row.display_title ??
          "Campaign"
        const adLabel =
          row.ad_name ??
          row.meta_ad_name ??
          row.gads_ad_group_name ??
          null
        const productLabel = row.product_name ?? productDetail?.product_name ?? row.course_name ?? row.product ?? null
        return {
          key: `${row.contract_id ?? "contract"}-${contractDateRaw ?? "date"}`,
          contractId: row.contract_id,
          contractDateRaw,
          contractDateLabel: formatContractDate(contractDateRaw),
          contractDateTs,
          cityLabel,
          attributedPlatform: row.attributed_platform ?? null,
          campaignLabel,
          adLabel,
          creativeTitle,
          creativeId,
          previewImageUrl,
          permalinkUrl: row.permalink_url ?? null,
          productLabel,
          totalCost: toNumber(row.total_cost) ?? 0,
          paymentsSum: toNumber(row.payments_sum) ?? 0,
          offlineSourceTypeLabel: row.offline_source_type_label ?? null,
          offlineOwnerName: row.offline_owner_name ?? null,
          gadsCampaignHint: row.gads_campaign_label_hint ?? null,
        }
      })
      .sort((a, b) => {
        if ((b.contractDateTs ?? 0) !== (a.contractDateTs ?? 0)) {
          return (b.contractDateTs ?? 0) - (a.contractDateTs ?? 0)
        }
        return b.totalCost - a.totalCost
      })
  }, [cityLookup, data.contracts_attributed, productDetailByContract])

  const attributedCreativeCoverage = useMemo(() => {
    const total = attributedContractsDisplay.length
    const withCreative = attributedContractsDisplay.filter((row) => row.creativeId != null || Boolean(row.creativeTitle)).length
    const withPreview = attributedContractsDisplay.filter((row) => Boolean(row.previewImageUrl)).length
    return { total, withCreative, withPreview }
  }, [attributedContractsDisplay])

  const attributedPaidCoverage = useMemo(() => {
    const paid = attributedContractsDisplay.filter((row) => {
      const key = normalizeKey(row.attributedPlatform ?? "")
      return key === "meta" || key === "paidmeta" || key === "gads" || key === "paidgads" || key === "pmax" || key === "paidpmax"
    }).length
    return { paid }
  }, [attributedContractsDisplay])

  const attributedContractsFiltered = useMemo(() => {
    if (attributedMode === "all") return attributedContractsDisplay
    if (attributedMode === "creative") {
      return attributedContractsDisplay.filter((row) => row.creativeId != null || Boolean(row.previewImageUrl))
    }
    // paid
    return attributedContractsDisplay.filter((row) => {
      const key = normalizeKey(row.attributedPlatform ?? "")
      return key === "meta" || key === "paidmeta" || key === "gads" || key === "paidgads" || key === "pmax" || key === "paidpmax"
    })
  }, [attributedContractsDisplay, attributedMode])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contracts & Attribution"
        description="Контракти, виручка та якість атрибуції за каналами."
      />

      <AnalyticsFilters
        value={draftFilters}
        onDateChange={(value) => setDraftFilters((prev) => ({ ...prev, dateRange: value }))}
        onCityChange={(value) => setDraftFilters((prev) => ({ ...prev, cityId: value }))}
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
            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Coverage</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <div className={`text-2xl font-semibold ${coverageRatio == null ? "text-muted-foreground" : ""}`}>
                    {coverageRatio == null ? "No data" : formatPercent(coverageRatio)}
                  </div>
                  {coverageTotal > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={coverageBadge.variant} title="Share of contracts with paid signal">
                        {coverageBadge.label}
                      </Badge>
                      <span>
                        Paid signal: {formatNumber(coveragePaid)} / {formatNumber(coverageTotal)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="w-24 shrink-0">
                  <KpiSparkline data={coverageTrend.map((row) => ({ value: row.ratio }))} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Контракти</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div className="text-2xl font-semibold">{formatNumber(coverageTotal)}</div>
                <div className="w-24 shrink-0">
                  <KpiSparkline data={contractsSparkline} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Attribution Channels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {channelSummary.length === 0 ? (
                  <WidgetStatus
                    title="Нет каналов"
                    description="Атрибуция по каналам пока отсутствует."
                    tone="muted"
                  />
                ) : (
                  channelSummary.map((row) => (
                    <div key={row.channel ?? "unknown"} className="flex items-center justify-between text-sm">
                      {renderPlatformBadge(row.channel ?? "unknown")}
                      <Badge variant="outline">{formatNumber(row.contracts)}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <InsightsPanel
            widgetKey="crm.contract_attribution_daily_city"
            dateFrom={insightsDateFrom}
            dateTo={insightsDateTo}
            idCity={appliedFilters.cityId}
            enabled={canFetch}
          />

          <Card className="bg-card/40 border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Contracts trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <SafeResponsiveContainer>
                  <ComposedChart data={trendData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="contractsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...chartGridProps} vertical={false} />
                    <XAxis dataKey="date" {...chartAxisProps} />
                    <YAxis {...chartAxisProps} />
                    <Tooltip
                      formatter={(value) => {
                        if (value === null || value === undefined) return ["—", "Contracts"]
                        const numeric = typeof value === "number" ? value : Number(value)
                        return [formatNumber(numeric), "Contracts"]
                      }}
                      contentStyle={chartTooltipStyle}
                      itemStyle={chartTooltipItemStyle}
                    />
                    <Area type="monotone" dataKey="contracts" stroke={CHART_COLORS.primary} fill="url(#contractsFill)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </SafeResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3">
                <CardTitle>Top campaigns</CardTitle>
                {data.top_campaigns.length > 8 && (
                  <Button size="sm" variant="outline" onClick={() => setShowAllTopCampaigns((prev) => !prev)}>
                    {showAllTopCampaigns ? "Collapse" : "Show all"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...(showAllTopCampaigns ? data.top_campaigns : data.top_campaigns.slice(0, 8))]
                    .sort((a, b) => (toNumber(b.contracts_cnt) ?? 0) - (toNumber(a.contracts_cnt) ?? 0))
                    .map((row, index) => {
                      const campaignTitle =
                        row.campaign_name ?? (row.campaign_id ? `Campaign #${row.campaign_id}` : "Campaign")
                      const avgCheck =
                        row.contracts_cnt && row.contracts_cnt > 0
                          ? (toNumber(row.revenue_total_cost) ?? 0) / row.contracts_cnt
                          : null
                      const revenueTotal = toNumber(row.revenue_total_cost) ?? 0
                      const paidSum = toNumber(row.payments_sum)
                      const contractsCnt = toNumber(row.contracts_cnt) ?? 0
                      const share = totalTopCampaignContracts > 0 ? contractsCnt / totalTopCampaignContracts : null
                      return (
                        <div
                          key={`${row.campaign_id ?? row.campaign_name}-${index}`}
                          className="rounded-2xl border border-border/60 bg-card/40 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{campaignTitle}</div>
                              <div className="mt-1">{renderPlatformBadge(row.platform)}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Контракти</div>
                              <div className="font-semibold">{formatNumber(contractsCnt)}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Дохід</div>
                              <div className="font-semibold">{formatCurrency(revenueTotal)}</div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {avgCheck != null && (
                              <Badge variant="outline" className="text-[11px]">
                                Avg check {formatCurrency(avgCheck)}
                              </Badge>
                            )}
                            {paidSum != null && paidSum > 0 && (
                              <Badge variant="outline" className="text-[11px]">
                                Paid {formatCurrency(paidSum)}
                              </Badge>
                            )}
                            {share != null && (
                              <Badge variant="outline" className="text-[11px]">
                                Share {formatPercent(share, { digits: 1 })}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  {data.top_campaigns.length === 0 && (
                    <WidgetStatus
                      title="Нет данных по кампаниям"
                      description="За выбранный период кампании не найдены."
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3">
                <CardTitle>Paid creatives (contracts)</CardTitle>
                {paidCreativesTop.length > 8 && (
                  <Button size="sm" variant="outline" onClick={() => setShowAllPaidCreatives((prev) => !prev)}>
                    {showAllPaidCreatives ? "Collapse" : "Show all"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {paidCreativesMissing ? (
                  <WidgetStatus
                    title="Нет витрины"
                    description="SEM витрина contracts.paid_creatives_top отсутствует или не обновляется."
                  />
                ) : paidCreativesTop.length === 0 ? (
                  <WidgetStatus
                    title="Нет paid-креативов"
                    description="За выбранный период нет paid-контрактов с привязанным креативом/превью."
                  />
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">Paid contracts {formatNumber(paidCreativesCoverage.total)}</Badge>
                      <Badge variant="outline">With preview {formatNumber(paidCreativesCoverage.withPreview)}</Badge>
                      <Badge variant="outline">Unique creatives {formatNumber(paidCreativesTop.length)}</Badge>
                    </div>
                    <div className="space-y-2">
                      {(showAllPaidCreatives ? paidCreativesTop : paidCreativesTop.slice(0, 8)).map((row) => {
                        const creativeLabel =
                          row.creativeTitle ??
                          (row.creativeId != null ? `Creative #${row.creativeId}` : "Creative")
                        const avgPaid = row.contractsCnt > 0 ? row.paidSum / row.contractsCnt : null
                        return (
                          <div key={row.key} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="h-16 w-24 overflow-hidden rounded-md border border-border/60 bg-muted/40">
                                  {row.previewImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={row.previewImageUrl}
                                      alt={creativeLabel}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                                      No preview
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold truncate">{creativeLabel}</span>
                                    {row.lastContractDateKey && <Badge variant="outline">{row.lastContractDateKey}</Badge>}
                                    {renderPlatformBadge(row.platform)}
                                  </div>
                                  <div className="mt-1 truncate text-sm font-medium">{row.campaignLabel}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    {row.adLabel && <span>Ad: {row.adLabel}</span>}
                                    {row.creativeId != null && <span>Creative #{row.creativeId}</span>}
                                  </div>
                                  {row.permalinkUrl && (
                                    <div className="mt-2">
                                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                                        <a href={row.permalinkUrl} target="_blank" rel="noopener noreferrer">
                                          Open creative
                                        </a>
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-right text-sm lg:min-w-[240px]">
                                <div>
                                  <div className="text-xs text-muted-foreground">Контракти</div>
                                  <div className="font-semibold">{formatNumber(row.contractsCnt)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Paid sum</div>
                                  <div className="font-semibold">{formatCurrency(row.paidSum)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Оплати</div>
                                  <div className="font-semibold">{formatCurrency(row.paymentsSum)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Avg paid</div>
                                  <div className="font-semibold">{avgPaid ? formatCurrency(avgPaid) : "—"}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3">
                <CardTitle>Attributed contracts</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={attributedMode === "paid" ? "secondary" : "outline"}
                    onClick={() => setAttributedMode("paid")}
                  >
                    Only paid
                  </Button>
                  <Button
                    size="sm"
                    variant={attributedMode === "creative" ? "secondary" : "outline"}
                    onClick={() => setAttributedMode("creative")}
                  >
                    Only with creative
                  </Button>
                  <Button
                    size="sm"
                    variant={attributedMode === "all" ? "secondary" : "outline"}
                    onClick={() => setAttributedMode("all")}
                  >
                    Show all
                  </Button>
                  {attributedContractsFiltered.length > 8 && (
                    <Button size="sm" variant="outline" onClick={() => setShowAllAttributed((prev) => !prev)}>
                      {showAllAttributed ? "Collapse" : "Expand"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {attributedContractsDisplay.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Rows {formatNumber(attributedCreativeCoverage.total)}</Badge>
                    <Badge variant="outline">Paid {formatNumber(attributedPaidCoverage.paid)}</Badge>
                    <Badge variant="outline">With creative {formatNumber(attributedCreativeCoverage.withCreative)}</Badge>
                    <Badge variant="outline">With preview {formatNumber(attributedCreativeCoverage.withPreview)}</Badge>
                  </div>
                )}
                <div className="space-y-2">
                  {(showAllAttributed ? attributedContractsFiltered : attributedContractsFiltered.slice(0, 8))
                    .map((row, index) => {
                      const normalizedPlatform = normalizeKey(row.attributedPlatform ?? "")
                      const isOffline =
                        normalizedPlatform === "offline" || normalizedPlatform === "unknown" || normalizedPlatform === "other"
                      const contractLabel = row.contractId ? `Contract #${row.contractId}` : "Contract"
                      return (
                        <div
                          key={`${row.key}-${index}`}
                          className="rounded-2xl border border-border/60 bg-card/40 p-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="h-16 w-24 overflow-hidden rounded-md border border-border/60 bg-muted/40">
                                {row.previewImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={row.previewImageUrl} alt={row.creativeTitle ?? contractLabel} className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                                    No preview
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold">{contractLabel}</span>
                                  {row.contractDateLabel && <Badge variant="outline">{row.contractDateLabel}</Badge>}
                                  {renderPlatformBadge(row.attributedPlatform)}
                                </div>
                                <div className="mt-1 truncate text-sm font-medium" title={row.gadsCampaignHint ?? undefined}>
                                  {row.campaignLabel}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {row.adLabel && <span>Ad: {row.adLabel}</span>}
                                  {row.creativeTitle && <span>Creative: {row.creativeTitle}</span>}
                                  {row.cityLabel && <span>{row.cityLabel}</span>}
                                  {row.productLabel && <span>{row.productLabel}</span>}
                                  {isOffline && row.offlineSourceTypeLabel && <span>{row.offlineSourceTypeLabel}</span>}
                                  {isOffline && row.offlineOwnerName && <span>{row.offlineOwnerName}</span>}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {row.creativeId != null && (
                                    <Badge variant="secondary" className="text-[11px]">
                                      Creative #{row.creativeId}
                                    </Badge>
                                  )}
                                  {row.permalinkUrl && (
                                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                                      <a href={row.permalinkUrl} target="_blank" rel="noopener noreferrer">
                                        Open creative
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-right text-sm lg:min-w-[220px]">
                              <div>
                                <div className="text-xs text-muted-foreground">Дохід</div>
                                <div className="font-semibold">{formatCurrency(row.totalCost)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Оплати</div>
                                <div className="font-semibold">{formatCurrency(row.paymentsSum)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  {attributedContractsFiltered.length === 0 && (
                    <WidgetStatus
                      title="Нет атрибуции"
                      description="Для выбранного фильтра нет строк. Попробуйте переключить режим (paid/creative/all) или расширить период."
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle>Product attribution</CardTitle>
              </CardHeader>
              <CardContent>
                {productAttributionMissing ? (
                  <WidgetStatus
                    title="Нет витрины"
                    description="SEM витрина contracts.product_attribution_daily_city отсутствует или не обновляется."
                  />
                ) : productSummary.length === 0 ? (
                  <WidgetStatus title="Нет данных" description="За выбранный период нет контрактов по продуктам." />
                ) : (
                  <div className="space-y-2">
                    {productSummary.slice(0, 10).map((row, index) => {
                      const avgCheck = row.contracts > 0 ? row.revenue / row.contracts : null
                      const showAvgCheck = avgCheck != null && avgCheck > 0
                      return (
                        <div
                          key={`${row.product_name}-${row.platform ?? "all"}-${index}`}
                          className="rounded-2xl border border-border/60 bg-card/40 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{row.product_name}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {row.platform ? renderPlatformBadge(row.platform) : null}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Контракты</div>
                              <div className="font-semibold">{formatNumber(row.contracts)}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Дохід</div>
                              <div className="font-semibold">{formatCurrency(row.revenue)}</div>
                            </div>
                            {showAvgCheck && (
                              <div className="text-right text-sm">
                                <div className="text-xs text-muted-foreground">Avg check</div>
                                <div className="font-semibold">{formatCurrency(avgCheck)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle>Lead → Contract cohort (7/14/30d)</CardTitle>
              </CardHeader>
              <CardContent>
                {leadsCohortMissing ? (
                  <WidgetStatus
                    title="Нет витрины"
                    description="SEM витрина contracts.leads_cohort отсутствует или не обновляется."
                  />
                ) : cohortSummary.length === 0 ? (
                  <WidgetStatus title="Нет данных" description="За выбранный период нет лидов или контрактов." />
                ) : (
                  <div className="space-y-2">
                    {cohortSummary.slice(-10).map((row, index) => {
                      const leads = toNumber(row.leads_cnt) ?? 0
                      const c7 = toNumber(row.contracts_cnt_7d) ?? 0
                      const c14 = toNumber(row.contracts_cnt_14d) ?? 0
                      const c30 = toNumber(row.contracts_cnt_30d) ?? 0
                      const r30 = toNumber(row.revenue_30d) ?? 0
                      const hasRevenue = r30 > 0
                      return (
                        <div
                          key={`${row.date_key ?? "date"}-${row.platform ?? "all"}-${index}`}
                          className="rounded-2xl border border-border/60 bg-card/40 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{row.date_key}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {row.platform ? renderPlatformBadge(row.platform) : null}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Leads</div>
                              <div className="font-semibold">{formatNumber(leads)}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">7d CR</div>
                              <div className="font-semibold">
                                {leads ? formatPercent(c7 / leads, { digits: 1 }) : "n/a"}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">14d CR</div>
                              <div className="font-semibold">
                                {leads ? formatPercent(c14 / leads, { digits: 1 }) : "n/a"}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">30d CR</div>
                              <div className="font-semibold">
                                {leads ? formatPercent(c30 / leads, { digits: 1 }) : "n/a"}
                              </div>
                            </div>
                            {hasRevenue && (
                              <div className="text-right text-sm">
                                <div className="text-xs text-muted-foreground">Revenue 30d</div>
                                <div className="font-semibold">{formatCurrency(r30)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/40 border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Product attribution detail</CardTitle>
            </CardHeader>
            <CardContent>
              {productAttributedDetailMissing ? (
                <WidgetStatus
                  title="Нет витрины"
                  description="SEM витрина contracts.product_attributed_detail отсутствует или не обновляется."
                />
              ) : (
                <WidgetTable
                  rows={productAttributedDetail}
                  emptyLabel="Нет детальных строк по продуктам."
                  columnsOrder={productDetailColumns}
                  columnLabels={productDetailLabels}
                  columnRenderers={productDetailRenderers}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3">
                <CardTitle>KPI decomposition</CardTitle>
                {kpiDecompositionRows.length > 12 && (
                  <Button size="sm" variant="outline" onClick={() => setShowAllKpiDecomposition((prev) => !prev)}>
                    {showAllKpiDecomposition ? "Collapse" : "Show all"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {kpiDecompositionMissing ? (
                  <WidgetStatus
                    title="Нет витрины"
                    description="SEM витрина contracts.kpi_decomposition отсутствует или не обновляется."
                  />
                ) : kpiDecompositionRows.length === 0 ? (
                  <WidgetStatus title="Нет данных" description="За выбранный период нет разложений KPI." />
                ) : (
                  <div className="space-y-2">
                    {(showAllKpiDecomposition ? kpiDecompositionRows : kpiDecompositionRows.slice(0, 12)).map((row, index) => {
                      const label = row.dimension_value ?? row.dimension_type ?? "Segment"
                      const typeLabel = row.dimension_type ? row.dimension_type.replace(/_/g, " ") : null
                      return (
                        <div
                          key={`${row.dimension_type ?? "dim"}-${row.dimension_value ?? "val"}-${index}`}
                          className="rounded-2xl border border-border/60 bg-card/40 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{label}</div>
                              {typeLabel && (
                                <div className="mt-1 text-xs text-muted-foreground">{typeLabel}</div>
                              )}
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Revenue</div>
                              <div className="font-semibold">{formatCurrency(toNumber(row.revenue_sum) ?? 0)}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Contracts</div>
                              <div className="font-semibold">{formatNumber(toNumber(row.contracts_cnt) ?? 0)}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">CPL</div>
                              <div className="font-semibold">
                                {row.cpl == null ? "n/a" : formatCurrency(row.cpl)}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">CAC</div>
                              <div className="font-semibold">
                                {row.cac == null ? "n/a" : formatCurrency(row.cac)}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">ROAS</div>
                              <div className="font-semibold">
                                {row.roas == null ? "n/a" : formatNumber(row.roas)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3">
                <CardTitle>Lead journey</CardTitle>
                {leadJourneyRows.length > 12 && (
                  <Button size="sm" variant="outline" onClick={() => setShowAllLeadJourney((prev) => !prev)}>
                    {showAllLeadJourney ? "Collapse" : "Show all"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {leadJourneyMissing ? (
                  <WidgetStatus
                    title="Нет витрины"
                    description="SEM витрина contracts.leads_journey отсутствует или не обновляется."
                  />
                ) : leadJourneyRows.length === 0 ? (
                  <WidgetStatus title="Нет данных" description="За выбранный период нет лидов." />
                ) : (
                  <div className="space-y-2">
                    {(showAllLeadJourney ? leadJourneyRows : leadJourneyRows.slice(0, 12)).map((row, index) => {
                      const leadLabel = row.lead_id != null ? `Lead #${row.lead_id}` : "Lead"
                      const productLabel = row.product_name ?? row.lead_course_name ?? row.first_form_name
                      const revenue = toNumber(row.revenue_sum) ?? 0
                      const payments = toNumber(row.payments_sum) ?? 0
                      return (
                        <div
                          key={`${row.lead_id ?? "lead"}-${index}`}
                          className="rounded-2xl border border-border/60 bg-card/40 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{productLabel ?? leadLabel}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{leadLabel}</span>
                                {row.temperature && <Badge variant="outline">{row.temperature}</Badge>}
                                {row.lead_status && <Badge variant="secondary">{row.lead_status}</Badge>}
                                {row.platform && renderPlatformBadge(row.platform)}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Revenue</div>
                              <div className="font-semibold">{formatCurrency(revenue)}</div>
                            </div>
                            {payments > 0 && (
                              <div className="text-right text-sm">
                                <div className="text-xs text-muted-foreground">Payments</div>
                                <div className="font-semibold">{formatCurrency(payments)}</div>
                              </div>
                            )}
                            {row.lead_score != null && (
                              <div className="text-right text-sm">
                                <div className="text-xs text-muted-foreground">Lead score</div>
                                <div className="font-semibold">{formatNumber(row.lead_score)}</div>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {row.first_contact_at && <span>First: {row.first_contact_at}</span>}
                            {row.contract_id && <span>Contract #{row.contract_id}</span>}
                            {row.source && <span>Source: {row.source}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/40 border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3">
              <CardTitle>Lead interactions by creative</CardTitle>
              {leadCreativeRows.length > 12 && (
                <Button size="sm" variant="outline" onClick={() => setShowAllLeadCreatives((prev) => !prev)}>
                  {showAllLeadCreatives ? "Collapse" : "Show all"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {leadCreativeMissing ? (
                <WidgetStatus
                  title="Нет витрины"
                  description="SEM витрина contracts.lead_creative_interactions отсутствует или не обновляется."
                />
              ) : leadCreativeRows.length === 0 ? (
                <WidgetStatus title="Нет данных" description="За выбранный период нет взаимодействий." />
              ) : (
                <div className="space-y-2">
                  {(showAllLeadCreatives ? leadCreativeRows : leadCreativeRows.slice(0, 12)).map((row, index) => {
                    const leadLabel = row.lead_id != null ? `Lead #${row.lead_id}` : "Lead"
                    const creativeLabel = row.creative_title ?? (row.creative_id != null ? `Creative #${row.creative_id}` : "Creative")
                    return (
                      <div
                        key={`${row.lead_id ?? "lead"}-${row.creative_id ?? "creative"}-${index}`}
                        className="rounded-2xl border border-border/60 bg-card/40 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{creativeLabel}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{leadLabel}</span>
                              {row.platform && renderPlatformBadge(row.platform)}
                              {row.attributed_flag != null && (
                                <Badge variant={row.attributed_flag ? "success" : "outline"}>
                                  {row.attributed_flag ? "Attributed" : "Not attributed"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-xs text-muted-foreground">Touches</div>
                            <div className="font-semibold">{formatNumber(toNumber(row.touch_count) ?? 0)}</div>
                          </div>
                          {row.time_to_contract_days != null && (
                            <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Time to contract</div>
                              <div className="font-semibold">{formatNumber(row.time_to_contract_days)} d</div>
                            </div>
                          )}
                        </div>
                        {row.last_touch_ts && (
                          <div className="mt-2 text-xs text-muted-foreground">Last touch: {row.last_touch_ts}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {isLoadingFormUnit ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : formUnitRows.length > 0 ? (
            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle>Form unit economics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {formUnitRows
                    .sort(
                      (a, b) =>
                        (toNumber(b.contracts_sum) ?? toNumber(b.revenue_sum) ?? 0) -
                        (toNumber(a.contracts_sum) ?? toNumber(a.revenue_sum) ?? 0)
                    )
                    .slice(0, 12)
                    .map((row, index) => {
                      const formTitle = row.form_name ?? (row.form_id != null ? `Form #${row.form_id}` : "Form")
                      const revenueValue = toNumber(row.contracts_sum) ?? toNumber(row.revenue_sum) ?? 0
                      const plannedPay = toNumber(row.planned_first_pay) ?? toNumber(row.payments_sum) ?? 0
                      return (
                        <div
                          key={`${row.form_id ?? row.form_name}-${index}`}
                          className="rounded-2xl border border-border/60 bg-card/40 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{formTitle}</div>
                              {row.product_name && (
                                <div className="mt-1 text-xs text-muted-foreground">{row.product_name}</div>
                              )}
                              {row.currency_code && (
                                <div className="mt-1 text-[11px] uppercase text-muted-foreground">
                                  {row.currency_code}
                                </div>
                              )}
                            </div>
                          <div className="text-right text-sm">
                            <div className="text-xs text-muted-foreground">Leads</div>
                            <div className="font-semibold">{formatNumber(toNumber(row.leads_cnt) ?? 0)}</div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-xs text-muted-foreground">Contracts</div>
                            <div className="font-semibold">{formatNumber(toNumber(row.contracts_cnt) ?? 0)}</div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-xs text-muted-foreground">Revenue</div>
                            <div className="font-semibold">{formatCurrency(revenueValue)}</div>
                          </div>
                            {plannedPay > 0 && (
                              <div className="text-right text-sm">
                                <div className="text-xs text-muted-foreground">Planned 1st pay</div>
                                <div className="font-semibold">{formatCurrency(plannedPay)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          ) : formUnitMissing ? (
            <AnalyticsEmptyState
              title="Немає форм"
              description="Перевірте SEM витрину crm_form_unit_economics_daily."
              context="contracts"
              size="sm"
            />
          ) : (
            <AnalyticsEmptyState
              title="Немає форм"
              description="Після підключення CRM зʼявиться економіка форм."
              context="contracts"
              size="sm"
            />
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3">
                <CardTitle>Meta Ads (daily)</CardTitle>
                {metaContracts.length > 8 && (
                  <Button size="sm" variant="outline" onClick={() => setShowAllMetaContracts((prev) => !prev)}>
                    {showAllMetaContracts ? "Collapse" : "Show all"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {metaContracts.length === 0 ? (
                  <WidgetStatus
                    title={metaByAdMissing ? "Витрина Meta недоступна" : "Нет данных Meta"}
                    description={
                      metaByAdMissing
                        ? "SEM витрина contracts.meta_by_ad_daily отсутствует или не обновляется."
                        : "Meta контракты за выбранный период не найдены."
                    }
                    tone={metaByAdMissing ? "warning" : "muted"}
                  />
                ) : (
                  <div className="space-y-2">
                    {[...(showAllMetaContracts ? metaContracts : metaContracts.slice(0, 8))]
                      .sort((a, b) => (toNumber(b.contracts_cnt) ?? 0) - (toNumber(a.contracts_cnt) ?? 0))
                      .map((row, index) => {
                        const title = row.ad_name ?? row.campaign_name ?? "Meta ad"
                        const cityLabel = resolveCityName(row.city_name, row.id_city)
                        return (
                          <div
                            key={`${row.ad_name ?? "meta"}-${index}`}
                            className="rounded-2xl border border-border/60 bg-card/40 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{title}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {cityLabel && <span>{cityLabel}</span>}
                                  {row.adset_name && <span>{row.adset_name}</span>}
                                  {renderPlatformBadge("meta")}
                                </div>
                              </div>
                              <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Контракти</div>
                              <div className="font-semibold">{formatNumber(toNumber(row.contracts_cnt) ?? 0)}</div>
                            </div>
                          </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {totalMetaContracts > 0 && (
                                <Badge variant="outline" className="text-[11px]">
                                  Share{" "}
                                  {formatPercent(
                                    (toNumber(row.contracts_cnt) ?? 0) / totalMetaContracts,
                                    { digits: 1 }
                                  )}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border/60 shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3">
                <CardTitle>Google Ads Campaigns (daily)</CardTitle>
                {gadsContracts.length > 8 && (
                  <Button size="sm" variant="outline" onClick={() => setShowAllGadsContracts((prev) => !prev)}>
                    {showAllGadsContracts ? "Collapse" : "Show all"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {gadsContracts.length === 0 ? (
                  <div className="space-y-3">
                    <WidgetStatus
                      title={gadsByCampaignMissing ? "Витрина Google Ads недоступна" : "Нет данных Google Ads"}
                      description={
                        gadsByCampaignMissing
                          ? "SEM витрина contracts.gads_by_campaign_daily отсутствует или не обновляется."
                          : gadsRange?.max_date
                            ? `Google Ads контракты за выбранный период не найдены. Последняя дата с данными: ${gadsRange.max_date}.`
                            : "Google Ads контракты за выбранный период не найдены."
                      }
                      tone={gadsByCampaignMissing ? "warning" : "muted"}
                    />
                    {!gadsByCampaignMissing && gadsRange?.max_date && (
                      <Button size="sm" variant="outline" onClick={applyGadsLastRange}>
                        Expand to last available data
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...(showAllGadsContracts ? gadsContracts : gadsContracts.slice(0, 8))]
                      .sort((a, b) => (toNumber(b.contracts_cnt) ?? 0) - (toNumber(a.contracts_cnt) ?? 0))
                      .map((row, index) => {
                        const title = row.campaign_name ?? "Google Ads campaign"
                        const cityLabel = resolveCityName(row.city_name, row.id_city)
                        return (
                          <div
                            key={`${row.campaign_name ?? "gads"}-${index}`}
                            className="rounded-2xl border border-border/60 bg-card/40 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{title}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {cityLabel && <span>{cityLabel}</span>}
                                  {row.advertising_channel_type && <span>{row.advertising_channel_type}</span>}
                                  {renderPlatformBadge("gads")}
                                </div>
                              </div>
                              <div className="text-right text-sm">
                              <div className="text-xs text-muted-foreground">Контракти</div>
                              <div className="font-semibold">{formatNumber(toNumber(row.contracts_cnt) ?? 0)}</div>
                            </div>
                          </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {totalGadsContracts > 0 && (
                                <Badge variant="outline" className="text-[11px]">
                                  Share{" "}
                                  {formatPercent(
                                    (toNumber(row.contracts_cnt) ?? 0) / totalGadsContracts,
                                    { digits: 1 }
                                  )}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <AnalyticsEmptyState
          title="Немає даних по контрактах"
          description="Потрібне оновлення SEM витрин або підключення каналів."
          context="contracts"
          size="sm"
        />
      )}

      <Separator />
    </div>
  )
}
