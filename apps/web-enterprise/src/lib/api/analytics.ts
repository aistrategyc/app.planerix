// apps/web-enterprise/src/lib/api/analytics.ts
// Complete ITstep Analytics API client based on real DWH data

import { api } from "./config"
import { fetchWidget, fetchWidgetRange, normalizeWidgetFilters, WidgetFilters, WidgetRow } from "./analytics-widgets"

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

const toWidgetFilters = (dateRange?: DateRange, extra: WidgetFilters = {}) => {
  const params: WidgetFilters = { ...extra }
  if (dateRange?.start_date) params.start_date = dateRange.start_date
  if (dateRange?.end_date) params.end_date = dateRange.end_date
  return normalizeWidgetFilters(params)
}

const pickText = (row: WidgetRow, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== "") {
      return String(value)
    }
  }
  return fallback
}

const pickNumber = (row: WidgetRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== "") {
      return toNumber(value)
    }
  }
  return 0
}

// ==================== TYPES ====================

export interface DateRange {
  start_date: string
  end_date: string
}

export interface MetricBase {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
  ctr: number
  cpc: number
  cpm: number
  cvr: number
  cpa: number
  roas: number
}

export interface DashboardOverview {
  date_range: DateRange
  total_spend: number
  total_revenue: number
  total_conversions: number
  total_leads: number
  roas: number
  conversion_rate: number
  active_campaigns: number
  active_creatives: number
  spend_trend: number
  revenue_trend: number
  roas_trend: number
}

export interface RealTimeMetrics {
  active_sessions: number
  new_leads_today: number
  revenue_today: number
  conversions_today: number
  top_performing_creative: string | null
  alerts: string[]
  last_updated: string
}

export interface CampaignPerformance {
  campaign_id: string
  campaign_name: string
  platform: string
  total_metrics: MetricBase
  performance: {
    days_active: number
    first_seen: string | null
    last_active: string | null
    avg_cost_share: number
    avg_revenue_share: number
  }
}

export interface CreativePerformance {
  creative_id: string
  creative_name: string
  campaign_key?: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
  ctr: number
  cpc: number
  cpm: number
  roas: number
  cvr: number
  creative_url?: string
}

export interface CreativeBurnout {
  creative_id: string
  creative_name: string
  days_active: number
  initial_ctr: number
  current_ctr: number
  burnout_score: number
  status: 'fresh' | 'declining' | 'burned_out'
}

export interface FunnelStage {
  stage: string
  count: number
  conversion_rate: number
  drop_off_rate: number
}

export interface AnalyticsFilters {
  start_date: string
  end_date: string
  platforms?: string[]
  campaigns?: string[]
  products?: string[]
  branches?: number[]
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// ==================== ANALYTICS API CLASS ====================

export class AnalyticsAPI {
  /**
   * Generic method for analytics requests with improved error handling
   */
  static async fetchAnalytics<T = any>(endpoint: string, params?: any): Promise<T> {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await api.get(endpoint, {
        params,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.data
    } catch (error: any) {
      // Log full error for debugging but don't expose sensitive details
      console.error(`Analytics API Error [${endpoint}]:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        params: params,
        timestamp: new Date().toISOString()
      })

      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again')
      }

      if (error.response?.status === 404) {
        throw new Error(`Analytics endpoint not found: ${endpoint}`)
      }

      if (error.response?.status >= 500) {
        throw new Error('Server error - please try again later')
      }

      if (error.response?.status === 429) {
        throw new Error('Too many requests - please wait before trying again')
      }

      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch analytics data"
      throw new Error(errorMessage)
    }
  }

  // ==================== DASHBOARD ====================

  /**
   * Get main dashboard overview
   */
  static async getDashboardOverview(dateRange: DateRange): Promise<DashboardOverview> {
    const [topMetrics, campaigns, creatives] = await Promise.all([
      fetchWidget("campaigns.top_metrics", toWidgetFilters(dateRange)),
      fetchWidget("campaigns.table", toWidgetFilters(dateRange, { limit: 1000 })),
      fetchWidget("creatives.table", toWidgetFilters(dateRange, { limit: 1000 })),
    ])

    const totals = topMetrics.items.reduce(
      (acc, row) => {
        acc.spend += pickNumber(row, ["ads_spend_total", "spend", "meta_spend", "gads_spend"])
        acc.revenue += pickNumber(row, ["crm_paid_sum", "paid_sum", "revenue", "contracts_sum"])
        acc.conversions += pickNumber(row, ["crm_contracts", "contracts_cnt", "contracts"])
        acc.leads += pickNumber(row, ["crm_leads", "leads_cnt", "meta_leads"])
        return acc
      },
      { spend: 0, revenue: 0, conversions: 0, leads: 0 }
    )

    const campaignIds = new Set(
      campaigns.items.map((row) => pickText(row, ["campaign_id", "campaign_key", "campaign_name"])).filter(Boolean)
    )
    const creativeIds = new Set(
      creatives.items.map((row) => pickText(row, ["creative_id", "creative_name", "ad_id"])).filter(Boolean)
    )

    const sortedMetrics = [...topMetrics.items].sort((a, b) => {
      const aDate = pickText(a, ["date_key", "date", "as_of_date"])
      const bDate = pickText(b, ["date_key", "date", "as_of_date"])
      return aDate.localeCompare(bDate)
    })

    const firstMetric = sortedMetrics[0]
    const lastMetric = sortedMetrics[sortedMetrics.length - 1]
    const firstSpend = firstMetric ? pickNumber(firstMetric, ["ads_spend_total", "spend"]) : 0
    const lastSpend = lastMetric ? pickNumber(lastMetric, ["ads_spend_total", "spend"]) : 0
    const firstRevenue = firstMetric ? pickNumber(firstMetric, ["crm_paid_sum", "paid_sum", "revenue"]) : 0
    const lastRevenue = lastMetric ? pickNumber(lastMetric, ["crm_paid_sum", "paid_sum", "revenue"]) : 0
    const firstRoas = firstSpend > 0 ? firstRevenue / firstSpend : 0
    const lastRoas = lastSpend > 0 ? lastRevenue / lastSpend : 0

    const spendTrend = firstSpend > 0 ? ((lastSpend - firstSpend) / firstSpend) * 100 : 0
    const revenueTrend = firstRevenue > 0 ? ((lastRevenue - firstRevenue) / firstRevenue) * 100 : 0
    const roasTrend = firstRoas > 0 ? ((lastRoas - firstRoas) / firstRoas) * 100 : 0

    const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0
    const conversionRate = totals.leads > 0 ? (totals.conversions / totals.leads) * 100 : 0

    return {
      date_range: {
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
      },
      total_spend: totals.spend,
      total_revenue: totals.revenue,
      total_conversions: totals.conversions,
      total_leads: totals.leads,
      roas,
      conversion_rate: conversionRate,
      active_campaigns: campaignIds.size,
      active_creatives: creativeIds.size,
      spend_trend: spendTrend,
      revenue_trend: revenueTrend,
      roas_trend: roasTrend,
    }
  }

  /**
   * Get real-time metrics
   */
  static async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const topMetrics = await fetchWidget("campaigns.top_metrics", { limit: 50 })
    const sorted = [...topMetrics.items].sort((a, b) => {
      const aDate = pickText(a, ["date_key", "date", "as_of_date"])
      const bDate = pickText(b, ["date_key", "date", "as_of_date"])
      return aDate.localeCompare(bDate)
    })
    const latest = sorted[sorted.length - 1] ?? {}

    const topCreativeResponse = await fetchWidget("creatives.table", { limit: 1, order_by: "-roas" })
    const topCreativeRow = topCreativeResponse.items[0]
    const topCreative = topCreativeRow
      ? pickText(topCreativeRow, ["creative_name", "creative_title", "ad_name", "creative_id"])
      : null

    return {
      active_sessions: 0,
      new_leads_today: pickNumber(latest, ["crm_leads", "leads_cnt", "meta_leads"]),
      revenue_today: pickNumber(latest, ["crm_paid_sum", "paid_sum", "revenue"]),
      conversions_today: pickNumber(latest, ["crm_contracts", "contracts_cnt", "conversions"]),
      top_performing_creative: topCreative || null,
      alerts: [],
      last_updated: new Date().toISOString(),
    }
  }

  /**
   * Get KPI metrics
   */
  static async getKPIs(dateRange: DateRange): Promise<any> {
    const response = await fetchWidget("crm.kpi_cards", toWidgetFilters(dateRange))
    return response.items
  }

  /**
   * Get platform performance
   */
  static async getPlatformPerformance(dateRange: DateRange): Promise<any[]> {
    const response = await fetchWidget("campaigns.table", toWidgetFilters(dateRange))
    const grouped = new Map<string, any>()
    response.items.forEach((row) => {
      const platform = pickText(row, ["platform", "channel"], "unknown")
      const entry = grouped.get(platform) ?? {
        platform,
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        revenue: 0,
      }
      entry.impressions += pickNumber(row, ["impressions"])
      entry.clicks += pickNumber(row, ["clicks"])
      entry.spend += pickNumber(row, ["spend"])
      entry.conversions += pickNumber(row, ["contracts", "conversions", "leads"])
      entry.revenue += pickNumber(row, ["revenue", "contracts_sum", "paid_sum"])
      grouped.set(platform, entry)
    })
    return Array.from(grouped.values())
  }

  // ==================== SALES ====================

  /**
   * Get sales revenue trend
   */
  static async getRevenueTrend(dateRange: DateRange): Promise<any> {
    const response = await fetchWidget("crm.funnel", toWidgetFilters(dateRange))
    const data = response.items.map((row) => ({
      date: pickText(row, ["date_key", "date"]),
      contracts: pickNumber(row, ["contracts_cnt", "contracts", "crm_contracts"]),
      revenue: pickNumber(row, ["paid_sum", "payments_sum", "revenue"]),
      first_sum: pickNumber(row, ["contracts_sum", "revenue_total_cost"]),
    }))
    return { data }
  }

  /**
   * Get sales by products
   */
  static async getSalesByProducts(dateRange: DateRange): Promise<any> {
    const response = await fetchWidget("campaigns.table", toWidgetFilters(dateRange))
    const grouped = new Map<string, any>()
    response.items.forEach((row) => {
      const product = pickText(row, ["product", "first_course_name", "campaign_name"], "Unknown")
      const entry = grouped.get(product) ?? {
        product,
        spend: 0,
        contracts: 0,
        revenue: 0,
        roas: 0,
      }
      entry.spend += pickNumber(row, ["spend"])
      entry.contracts += pickNumber(row, ["contracts", "contracts_cnt", "conversions"])
      entry.revenue += pickNumber(row, ["revenue", "contracts_sum", "paid_sum"])
      grouped.set(product, entry)
    })
    const rows = Array.from(grouped.values()).map((entry) => ({
      ...entry,
      roas: entry.spend > 0 ? entry.revenue / entry.spend : 0,
    }))
    return { data: rows }
  }

  /**
   * Get conversion funnel
   */
  static async getConversionFunnel(dateRange: DateRange): Promise<any> {
    const response = await fetchWidget("crm.funnel", toWidgetFilters(dateRange))
    const totals = response.items.reduce(
      (acc, row) => {
        acc.requests += pickNumber(row, ["requests_cnt", "requests"])
        acc.leads += pickNumber(row, ["leads_cnt", "leads", "crm_leads"])
        acc.contracts += pickNumber(row, ["contracts_cnt", "contracts", "crm_contracts"])
        acc.payments += pickNumber(row, ["payments_cnt", "payments_sum", "paid_sum"])
        return acc
      },
      { requests: 0, leads: 0, contracts: 0, payments: 0 }
    )
    return {
      stages: [
        { stage: "requests", count: totals.requests, conversion_rate: 100, drop_off_rate: 0 },
        { stage: "leads", count: totals.leads, conversion_rate: totals.requests ? (totals.leads / totals.requests) * 100 : 0, drop_off_rate: 0 },
        { stage: "contracts", count: totals.contracts, conversion_rate: totals.leads ? (totals.contracts / totals.leads) * 100 : 0, drop_off_rate: 0 },
        { stage: "payments", count: totals.payments, conversion_rate: totals.contracts ? (totals.payments / totals.contracts) * 100 : 0, drop_off_rate: 0 },
      ],
    }
  }

  // ==================== CAMPAIGNS ====================

  /**
   * Get campaign performance
   */
  static async getCampaignPerformance(filters: AnalyticsFilters): Promise<{
    status: string
    data: CampaignPerformance[]
    total_count: number
  }> {
    const response = await fetchWidget(
      "campaigns.table",
      toWidgetFilters(
        { start_date: filters.start_date, end_date: filters.end_date },
        {
          platform: filters.platforms?.[0],
          limit: filters.page_size,
          offset: filters.page && filters.page_size ? (filters.page - 1) * filters.page_size : undefined,
          order_by: filters.sort_by ? `${filters.sort_order === "desc" ? "-" : ""}${filters.sort_by}` : undefined,
        }
      )
    )
    const rows = response.items
    const data = rows.map((row) => {
      const impressions = pickNumber(row, ["impressions"])
      const clicks = pickNumber(row, ["clicks"])
      const spend = pickNumber(row, ["spend"])
      const conversions = pickNumber(row, ["contracts", "conversions", "leads"])
      const revenue = pickNumber(row, ["revenue", "contracts_sum", "paid_sum"])
      return {
        campaign_id: pickText(row, ["campaign_id", "campaign_key"]),
        campaign_name: pickText(row, ["campaign_name", "campaign"]),
        platform: pickText(row, ["platform", "channel"]),
        total_metrics: {
          impressions,
          clicks,
          spend,
          conversions,
          revenue,
          ctr: impressions ? (clicks / impressions) * 100 : 0,
          cpc: clicks ? spend / clicks : 0,
          cpm: impressions ? (spend / impressions) * 1000 : 0,
          cvr: clicks ? (conversions / clicks) * 100 : 0,
          cpa: conversions ? spend / conversions : 0,
          roas: spend ? revenue / spend : 0,
        },
        performance: {
          days_active: 0,
          first_seen: pickText(row, ["date_key", "date"]) || null,
          last_active: pickText(row, ["date_key", "date"]) || null,
          avg_cost_share: 0,
          avg_revenue_share: 0,
        },
      }
    })
    return {
      status: "success",
      data,
      total_count: data.length,
    }
  }

  /**
   * Get daily trend for specific campaign
   */
  static async getCampaignDailyTrend(campaignId: string, dateRange: DateRange): Promise<any> {
    const response = await fetchWidget(
      "campaigns.table",
      toWidgetFilters(dateRange, { entity_id: campaignId, limit: 200 })
    )
    return { data: response.items }
  }

  /**
   * Get campaigns grouped by products
   */
  static async getCampaignsByProducts(dateRange: DateRange): Promise<any> {
    const response = await fetchWidget("campaigns.table", toWidgetFilters(dateRange))
    const grouped = new Map<string, any>()
    response.items.forEach((row) => {
      const product = pickText(row, ["product", "first_course_name", "campaign_name"], "Unknown")
      const entry = grouped.get(product) ?? {
        product,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      }
      entry.spend += pickNumber(row, ["spend"])
      entry.impressions += pickNumber(row, ["impressions"])
      entry.clicks += pickNumber(row, ["clicks"])
      entry.conversions += pickNumber(row, ["contracts", "conversions", "leads"])
      grouped.set(product, entry)
    })
    return { data: Array.from(grouped.values()) }
  }

  /**
   * Get rolling performance metrics
   */
  static async getRollingPerformance(days: number = 7): Promise<any> {
    const range = await fetchWidgetRange("campaigns.table")
    const maxDate = range.max_date
    if (!maxDate) {
      return { data: [] }
    }
    const endDate = new Date(maxDate)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (days - 1))
    const response = await fetchWidget(
      "campaigns.table",
      toWidgetFilters({
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
      })
    )
    return { data: response.items }
  }

  /**
   * Get campaigns summary
   */
  static async getCampaignsSummary(dateRange: DateRange): Promise<any> {
    const response = await fetchWidget("campaigns.top_metrics", toWidgetFilters(dateRange))
    return { data: response.items }
  }

  /**
   * Get creatives for specific campaign
   */
  static async getCampaignCreatives(campaignId: string, dateRange: DateRange): Promise<any> {
    const response = await fetchWidget(
      "creatives.table",
      toWidgetFilters(dateRange, { entity_id: campaignId, limit: 200 })
    )
    return { data: response.items }
  }

  // ==================== CREATIVES ====================

  /**
   * Get creative performance
   */
  static async getCreativePerformance(filters: AnalyticsFilters): Promise<{
    status: string
    data: CreativePerformance[]
    total_count: number
  }> {
    const response = await fetchWidget(
      "creatives.table",
      toWidgetFilters(
        { start_date: filters.start_date, end_date: filters.end_date },
        {
          limit: filters.page_size,
          offset: filters.page && filters.page_size ? (filters.page - 1) * filters.page_size : undefined,
          order_by: filters.sort_by ? `${filters.sort_order === "desc" ? "-" : ""}${filters.sort_by}` : undefined,
        }
      )
    )
    const data = response.items.map((row) => ({
      creative_id: pickText(row, ["creative_id", "ad_id"]),
      creative_name: pickText(row, ["creative_name", "creative_title", "ad_name"]),
      campaign_key: pickText(row, ["campaign_key", "campaign_id", "campaign_name"]) || undefined,
      impressions: pickNumber(row, ["impressions", "impressions_7d"]),
      clicks: pickNumber(row, ["clicks", "clicks_7d"]),
      spend: pickNumber(row, ["spend", "spend_7d"]),
      conversions: pickNumber(row, ["conversions", "leads", "contracts"]),
      revenue: pickNumber(row, ["revenue", "contracts_sum", "paid_sum"]),
      ctr: pickNumber(row, ["ctr", "ctr_7d"]),
      cpc: pickNumber(row, ["cpc", "cpc_7d"]),
      cpm: pickNumber(row, ["cpm"]),
      roas: pickNumber(row, ["roas", "roas_7d"]),
      cvr: pickNumber(row, ["cvr"]),
      creative_url: pickText(row, ["permalink_url", "link_url", "creative_url"]) || undefined,
    }))
    return {
      status: "success",
      data,
      total_count: data.length,
    }
  }

  /**
   * Get creative burnout analysis
   */
  static async getCreativeBurnoutAnalysis(
    daysBack: number = 30,
    minDaysActive: number = 7
  ): Promise<{
    status: string
    data: CreativeBurnout[]
    alerts: string[]
  }> {
    const response = await fetchWidget("ads.meta_creative_fatigue_7d", { limit: 200 })
    const data = response.items.map((row) => ({
      creative_id: pickText(row, ["creative_id"]),
      creative_name: pickText(row, ["creative_name", "ad_name"]),
      days_active: pickNumber(row, ["baseline_days"]),
      initial_ctr: pickNumber(row, ["ctr_prev7d"]),
      current_ctr: pickNumber(row, ["ctr_7d"]),
      burnout_score: pickNumber(row, ["fatigue_score"]),
      status: pickNumber(row, ["fatigue_score"]) >= 70 ? "burned_out" : pickNumber(row, ["fatigue_score"]) >= 40 ? "declining" : "fresh",
    }))
    return {
      status: "success",
      data,
      alerts: data.filter((row) => row.burnout_score >= 70).map((row) => `${row.creative_name} needs refresh`),
    }
  }

  /**
   * Get top performing creatives
   */
  static async getTopPerformingCreatives(
    dateRange: DateRange,
    metric: 'roas' | 'revenue' | 'conversions' | 'ctr' | 'spend' = 'roas',
    limit: number = 10
  ): Promise<any> {
    const orderBy = metric ? `-${metric}` : undefined
    const response = await fetchWidget("creatives.table", toWidgetFilters(dateRange, { limit, order_by: orderBy }))
    return { data: response.items }
  }

  /**
   * Get creative themes analysis
   */
  static async getCreativeThemesAnalysis(dateRange: DateRange): Promise<any> {
    const response = await fetchWidget("creatives.type_cards", toWidgetFilters(dateRange))
    return { data: response.items }
  }

  /**
   * Get detailed creative information
   */
  static async getCreativeDetails(creativeId: string, dateRange: DateRange): Promise<any> {
    const response = await fetchWidget(
      "ads.ads_ad_profile_daily",
      toWidgetFilters(dateRange, { entity_id: creativeId, limit: 50 })
    )
    return { data: response.items }
  }

  // ==================== MARKETING ANALYTICS ====================

  /**
   * Get executive overview
   */
  static async getExecutiveOverview(dateRange?: DateRange, platform?: string): Promise<any> {
    const [metrics, revenueSplit] = await Promise.all([
      fetchWidget("campaigns.top_metrics", toWidgetFilters(dateRange, { platform })),
      fetchWidget("sources.revenue_split", toWidgetFilters(dateRange, { platform })),
    ])
    return {
      top_metrics: metrics.items,
      revenue_split: revenueSplit.items,
    }
  }

  /**
   * Get channels and sources analysis
   */
  static async getChannelsSources(dateRange?: DateRange, platform?: string): Promise<any> {
    const params: any = {}
    if (dateRange?.start_date) params.start_date = dateRange.start_date
    if (dateRange?.end_date) params.end_date = dateRange.end_date
    if (platform) params.platform = platform

    const [channelMix, revenueSplit] = await Promise.all([
      this.fetchAnalytics("/analytics/widgets/ads.channel_mix_daily", normalizeWidgetFilters(params, "ads.channel_mix_daily")),
      this.fetchAnalytics("/analytics/widgets/sources.revenue_split", normalizeWidgetFilters(params, "sources.revenue_split")),
    ])

    const channelRows = channelMix?.items ?? []
    const revenueRows = revenueSplit?.items ?? []

    const platform_costs = channelRows
      .filter((row: any) => row.date_key)
      .map((row: any) => ({
        date: row.date_key ?? row.date,
        platform: row.channel ?? row.platform ?? "unknown",
        cost: Number(row.spend ?? row.spend_all ?? 0),
      }))

    const weeklyBucket = new Map<string, any>()
    channelRows.forEach((row: any) => {
      const channel = row.channel ?? row.platform ?? "unknown"
      const entry = weeklyBucket.get(channel) ?? {
        platform: channel,
        source: channel,
        cost: 0,
        leads: 0,
        contracts: 0,
        revenue: 0,
        roas: 0,
        cpl: 0,
      }
      entry.cost += Number(row.spend ?? 0)
      entry.leads += Number(row.leads_cnt ?? 0)
      entry.contracts += Number(row.contracts_cnt ?? 0)
      weeklyBucket.set(channel, entry)
    })

    const weekly_data = Array.from(weeklyBucket.values()).map((entry) => ({
      ...entry,
      roas: entry.cost > 0 ? entry.revenue / entry.cost : 0,
      cpl: entry.leads > 0 ? entry.cost / entry.leads : 0,
    }))

    const other_sources = revenueRows.map((row: any) => ({
      date: row.date_key ?? row.date ?? null,
      source: row.source ?? row.channel ?? row.platform ?? null,
      leads: Number(row.leads_cnt ?? row.leads ?? 0),
      contracts: Number(row.contracts_cnt ?? row.contracts ?? 0),
      revenue: Number(row.revenue ?? row.revenue_total_cost ?? 0),
    }))

    return {
      platform_costs,
      other_sources,
      weekly_data,
    }
  }

  /**
   * Get marketing campaigns data
   */
  static async getMarketingCampaigns(dateRange?: DateRange, platform?: string, campaignKey?: string): Promise<any> {
    const params: any = {}
    if (dateRange?.start_date) params.start_date = dateRange.start_date
    if (dateRange?.end_date) params.end_date = dateRange.end_date
    if (platform) params.platform = platform

    const response = await this.fetchAnalytics(
      "/analytics/widgets/campaigns.table",
      normalizeWidgetFilters(params, "campaigns.table")
    )
    const rows: any[] = response?.items ?? []
    const filteredRows = campaignKey
      ? rows.filter((row) =>
          String(row.campaign_name ?? row.campaign_id ?? "").toLowerCase().includes(campaignKey.toLowerCase())
        )
      : rows

    const campaigns = filteredRows.map((row) => {
      const ctrValue = row.ctr ?? row.ctr_pct ?? 0
      const ctrPct = ctrValue > 1 ? Number(ctrValue) : Number(ctrValue) * 100
      return {
        date: row.date_key ?? row.date ?? null,
        platform: row.platform ?? "unknown",
        campaign_key: row.campaign_name ?? row.campaign_id ?? "unknown",
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        cost: Number(row.spend ?? row.cost ?? 0),
        ctr_pct: ctrPct,
        cpc: Number(row.cpc ?? 0),
        cpm: Number(row.cpm ?? 0),
      }
    })

    const rollup = new Map<string, any>()
    campaigns.forEach((row) => {
      const key = `${row.platform}:${row.campaign_key}`
      const entry = rollup.get(key) ?? {
        platform: row.platform,
        campaign_key: row.campaign_key,
        impressions_7d: 0,
        clicks_7d: 0,
        cost_7d: 0,
        avg_ctr_7d: 0,
        avg_cpc_7d: 0,
        avg_cpm_7d: 0,
        first_seen: row.date,
        last_active_date: row.date,
      }
      entry.impressions_7d += row.impressions
      entry.clicks_7d += row.clicks
      entry.cost_7d += row.cost
      if (row.date) {
        entry.first_seen = entry.first_seen ? (entry.first_seen < row.date ? entry.first_seen : row.date) : row.date
        entry.last_active_date = entry.last_active_date
          ? (entry.last_active_date > row.date ? entry.last_active_date : row.date)
          : row.date
      }
      rollup.set(key, entry)
    })

    const rolling_7d = Array.from(rollup.values()).map((entry) => ({
      platform: entry.platform,
      campaign_key: entry.campaign_key,
      impressions_7d: entry.impressions_7d,
      clicks_7d: entry.clicks_7d,
      cost_7d: entry.cost_7d,
      avg_ctr_7d: entry.impressions_7d > 0 ? (entry.clicks_7d / entry.impressions_7d) * 100 : 0,
      avg_cpc_7d: entry.clicks_7d > 0 ? entry.cost_7d / entry.clicks_7d : 0,
      avg_cpm_7d: entry.impressions_7d > 0 ? (entry.cost_7d / entry.impressions_7d) * 1000 : 0,
    }))

    const latest_activity = Array.from(rollup.values()).map((entry) => ({
      platform: entry.platform,
      campaign_key: entry.campaign_key,
      first_seen: entry.first_seen ?? null,
      last_active_date: entry.last_active_date ?? null,
    }))

    return {
      campaigns,
      latest_activity,
      rolling_7d,
    }
  }

  /**
   * Get marketing creatives data
   */
  static async getMarketingCreatives(params: {
    dateRange?: DateRange
    platform?: string
    searchText?: string
  }): Promise<any> {
    const response = await fetchWidget(
      "creatives.table",
      toWidgetFilters(params.dateRange, {
        platform: params.platform,
        limit: 200,
      })
    )
    const rows = params.searchText
      ? response.items.filter((row) =>
          pickText(row, ["creative_name", "creative_title", "ad_name"]).toLowerCase().includes(params.searchText!.toLowerCase())
        )
      : response.items
    return { data: rows }
  }

  /**
   * Get CRM outcomes and 360 data
   */
  static async getCRMOutcomes(dateRange?: DateRange, platform?: string, source?: string): Promise<any> {
    const [kpis, leads] = await Promise.all([
      fetchWidget("crm.kpi_cards", toWidgetFilters(dateRange, { platform, source })),
      fetchWidget("crm.leads_table", toWidgetFilters(dateRange, { platform, source, limit: 200 })),
    ])
    return {
      kpis: kpis.items,
      leads: leads.items,
    }
  }

  /**
   * Get attribution funnel analysis
   */
  static async getAttributionFunnel(dateRange?: DateRange, platform?: string, productKey?: string): Promise<any> {
    return {
      data: [],
      note: "Attribution funnel widgets are pending registry mapping.",
    }
  }

  /**
   * Get product performance analysis
   */
  static async getProductPerformance(dateRange?: DateRange, platform?: string): Promise<any> {
    const response = await fetchWidget("campaigns.table", toWidgetFilters(dateRange, { platform }))
    const grouped = new Map<string, any>()
    response.items.forEach((row) => {
      const product = pickText(row, ["product", "first_course_name", "campaign_name"], "Unknown")
      const entry = grouped.get(product) ?? {
        product,
        spend: 0,
        leads: 0,
        contracts: 0,
        revenue: 0,
      }
      entry.spend += pickNumber(row, ["spend"])
      entry.leads += pickNumber(row, ["leads", "leads_cnt"])
      entry.contracts += pickNumber(row, ["contracts", "contracts_cnt"])
      entry.revenue += pickNumber(row, ["revenue", "contracts_sum", "paid_sum"])
      grouped.set(product, entry)
    })
    return { data: Array.from(grouped.values()) }
  }

  /**
   * Get geography analysis
   */
  static async getGeographyAnalysis(dateRange?: DateRange, platform?: string): Promise<any> {
    const response = await fetchWidget("campaigns.table", toWidgetFilters(dateRange, { platform }))
    const grouped = new Map<string, any>()
    response.items.forEach((row) => {
      const city = pickText(row, ["city_name", "branch", "id_city"], "Unknown")
      const entry = grouped.get(city) ?? {
        city,
        spend: 0,
        contracts: 0,
        revenue: 0,
      }
      entry.spend += pickNumber(row, ["spend"])
      entry.contracts += pickNumber(row, ["contracts", "contracts_cnt"])
      entry.revenue += pickNumber(row, ["revenue", "contracts_sum", "paid_sum"])
      grouped.set(city, entry)
    })
    return { data: Array.from(grouped.values()) }
  }

  /**
   * Get data quality metrics
   */
  static async getDataQuality(dateRange?: DateRange): Promise<any> {
    const params: any = {}
    if (dateRange?.start_date) params.date_from = dateRange.start_date
    if (dateRange?.end_date) params.date_to = dateRange.end_date

    const [freshness, agentReady] = await Promise.all([
      this.fetchAnalytics("/analytics/data-quality/freshness", params),
      this.fetchAnalytics("/analytics/data-quality/agent-ready", params),
    ])
    return {
      freshness: freshness?.items ?? [],
      agent_ready: agentReady?.items ?? [],
    }
  }

  /**
   * Get available date range
   */
  static async getAvailableDateRange(widgetKey: string = "crm.kpi_cards"): Promise<any> {
    return fetchWidgetRange(widgetKey)
  }

  // ==================== LEGACY SUPPORT ====================

  /**
   * Get sales analytics (legacy)
   */
  static async getSalesAnalytics(): Promise<any> {
    return this.fetchAnalytics("/analytics/sales/test")
  }

  /**
   * Get debug information
   */
  static async getDebugInfo(): Promise<any> {
    return this.fetchAnalytics("/analytics/sales/debug")
  }

  /**
   * Получить аналитику членства в организации
   */
  static async getMembershipStats(orgId: string): Promise<any> {
    return this.fetchAnalytics(`/orgs/${orgId}/memberships/stats`)
  }

  /**
   * Получить AI инсайты по продажам
   */
  static async getSalesInsights(): Promise<any> {
    return this.fetchAnalytics("/insights/sales")
  }
}

// Backward compatibility
export const fetchAnalytics = AnalyticsAPI.fetchAnalytics
export default AnalyticsAPI
