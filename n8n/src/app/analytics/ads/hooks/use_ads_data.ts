import { useEffect, useState } from "react"
import { api } from "@/lib/api/config"

interface SpendDailyRow {
  date_key: string
  id_city?: number | null
  channel?: string | null
  spend?: number | null
}

interface CampaignDailyRow {
  date_key: string
  id_city?: number | null
  platform?: string | null
  campaign_id: string
  campaign_name?: string | null
  impressions?: number | null
  clicks?: number | null
  spend?: number | null
  conversions?: number | null
  cpc?: number | null
  cpm?: number | null
  ctr?: number | null
}

interface AdsDailyRow {
  date_key: string
  id_city?: number | null
  platform?: string | null
  campaign_id?: string | null
  campaign_name?: string | null
  ad_id?: string | null
  ad_name?: string | null
  spend?: number | null
  clicks?: number | null
  conversions?: number | null
  ctr?: number | null
}

interface AdProfileRow extends AdsDailyRow {
  link_url?: string | null
  permalink_url?: string | null
  object_type?: string | null
  creative_title?: string | null
  creative_body?: string | null
}

interface AdsAnomalyRow {
  platform?: string | null
  id_city?: number | null
  ad_id?: string | null
  ad_name?: string | null
  spend_7d?: number | null
  spend_prev7d?: number | null
  clicks_7d?: number | null
  clicks_prev7d?: number | null
  conv_7d?: number | null
  conv_prev7d?: number | null
  spend_delta_pct?: number | null
  clicks_delta_pct?: number | null
  conv_delta_pct?: number | null
}

type AgentRow = Record<string, unknown>

interface AdsResponse {
  spend_daily: SpendDailyRow[]
  campaigns_daily: CampaignDailyRow[]
  ads_daily: AdsDailyRow[]
  ad_profile: AdProfileRow[]
  anomalies: AdsAnomalyRow[]
  top_meta_ads: AgentRow[]
  top_gads_campaigns: AgentRow[]
}

interface UseAdsDataResult extends AdsResponse {
  isLoading: boolean
}

const formatDate = (value?: Date) => (value ? value.toISOString().slice(0, 10) : undefined)

export function useAdsData(params: {
  dateRange: { from?: Date; to?: Date }
  cityId?: number | null
  platform?: string
  channel?: string
  adId?: string
  limit?: number
}): UseAdsDataResult {
  const { dateRange, cityId, platform, channel, adId, limit } = params
  const [data, setData] = useState<UseAdsDataResult>({
    isLoading: true,
    spend_daily: [],
    campaigns_daily: [],
    ads_daily: [],
    ad_profile: [],
    anomalies: [],
    top_meta_ads: [],
    top_gads_campaigns: [],
  })

  useEffect(() => {
    const fetchData = async () => {
      const from = formatDate(dateRange.from)
      const to = formatDate(dateRange.to)
      setData((prev) => ({ ...prev, isLoading: true }))

      try {
        const queryParams = {
          date_from: from,
          date_to: to,
          city_id: cityId ?? undefined,
          platform: platform || undefined,
          channel: channel || undefined,
          ad_id: adId || undefined,
          limit: limit ?? undefined,
        }
        const { data } = await api.get<AdsResponse>("/analytics/ads/", { params: queryParams })

        setData({
          isLoading: false,
          spend_daily: data?.spend_daily ?? [],
          campaigns_daily: data?.campaigns_daily ?? [],
          ads_daily: data?.ads_daily ?? [],
          ad_profile: data?.ad_profile ?? [],
          anomalies: data?.anomalies ?? [],
          top_meta_ads: data?.top_meta_ads ?? [],
          top_gads_campaigns: data?.top_gads_campaigns ?? [],
        })
      } catch (error) {
        console.error("❌ Failed to fetch ads data:", error)
        setData({
          isLoading: false,
          spend_daily: [],
          campaigns_daily: [],
          ads_daily: [],
          ad_profile: [],
          anomalies: [],
          top_meta_ads: [],
          top_gads_campaigns: [],
        })
      }
    }

    fetchData()
  }, [dateRange, cityId, platform, channel, adId, limit])

  return data
}
