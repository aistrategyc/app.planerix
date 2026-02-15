/**
 * API client for Ads Manager and Marketing Campaigns
 *
 * Provides type-safe interfaces for fetching real advertising and campaign data
 * from the ITstep analytics database via the backend API.
 *
 * @deprecated This file is currently unused by the UI. Prefer `/api/analytics/widgets/*`-based screens.
 */

import { api } from './config'

// ============================================================================
// Ads Manager Types
// ============================================================================

export interface AdMetrics {
  impressions: number
  clicks: number
  spend: number
  ctr: number
  cpc: number
  conversions?: number
  cpa?: number
  roas?: number
}

export interface Ad {
  ad_id: string
  ad_name: string
  campaign_id: string
  campaign_name?: string
  platform: 'google' | 'meta'
  type: 'search' | 'display' | 'video' | 'shopping' | 'social'
  status: 'active' | 'paused' | 'draft' | 'expired'
  metrics: AdMetrics
  date_start: string
  date_stop: string
}

export interface AdStatsResponse {
  total_ads: number
  total_campaigns: number
  total_impressions: number
  total_clicks: number
  total_spend: number
  avg_ctr: number
  avg_cpc: number
}

// ============================================================================
// Marketing Campaigns Types
// ============================================================================

export interface CampaignMetrics {
  impressions: number
  clicks: number
  spend: number
  leads: number
  cpl: number  // Cost per lead
  ctr: number
  conversions?: number
  roas?: number
}

export interface Campaign {
  campaign_id: string
  campaign_name: string
  platform: 'google' | 'meta'
  type: 'email' | 'social' | 'ppc' | 'content' | 'seo' | 'influencer'
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
  days_active: number
  metrics: CampaignMetrics
  budget?: number
  target_audience?: string
}

export interface CampaignStatsResponse {
  total_campaigns: number
  active_campaigns: number
  total_spend: number
  total_leads: number
  avg_cpl: number
  avg_ctr: number
}

// ============================================================================
// Ads Manager API
// ============================================================================

export const AdsAPI = {
  /**
   * Get list of advertisements from ITstep analytics database
   */
  async getAds(params: {
    date_from?: string
    date_to?: string
    platform?: string
    limit?: number
  } = {}): Promise<Ad[]> {
    const response = await api.get('/ads-manager', { params })
    return response.data
  },

  /**
   * Get aggregated statistics for all advertisements
   */
  async getStats(params: {
    date_from?: string
    date_to?: string
  } = {}): Promise<AdStatsResponse> {
    const response = await api.get('/ads-manager/stats', { params })
    return response.data
  }
}

// ============================================================================
// Marketing Campaigns API
// ============================================================================

export const CampaignsAPI = {
  /**
   * Get list of marketing campaigns from ITstep analytics database
   */
  async getCampaigns(params: {
    date_from?: string
    date_to?: string
    platform?: string
    limit?: number
  } = {}): Promise<Campaign[]> {
    const response = await api.get('/marketing-campaigns', { params })
    return response.data
  },

  /**
   * Get aggregated statistics for all campaigns
   */
  async getStats(params: {
    date_from?: string
    date_to?: string
  } = {}): Promise<CampaignStatsResponse> {
    const response = await api.get('/marketing-campaigns/stats', { params })
    return response.data
  }
}

// ============================================================================
// New Ads Analytics API (v6 with Creative Visualization)
// ============================================================================

export interface AdsOverview {
  total_spend: number
  total_impressions: number
  total_clicks: number
  crm_leads: number
  platform_leads: number
  contracts: number
  revenue: number
  roas: number | null
  cpl: number | null
  ctr: number | null
  conversion_rate: number | null
  match_rate: number | null
}

export interface CampaignPerformance {
  platform: string
  campaign_id: string
  campaign_name: string | null
  campaign_status: string | null
  spend: number
  impressions: number
  clicks: number
  crm_leads: number
  platform_leads: number | null
  contracts: number
  revenue: number
  roas: number | null
  cpl: number | null
  ctr: number | null
  conversion_rate: number | null
  match_rate: number | null
  ad_count: number | null
}

export interface AdCreative {
  ad_creative_id: string | null
  media_image_src: string | null
  thumbnail_url: string | null
  video_id: string | null
  permalink_url: string | null
  title: string | null
  body: string | null
  description: string | null
  cta_type: string | null
  link_url: string | null
}

export interface AdPerformance {
  ad_id: string
  ad_name: string | null
  ad_status: string | null
  adset_id: string | null
  adset_name: string | null
  campaign_id: string
  campaign_name: string | null
  spend: number
  impressions: number
  clicks: number
  crm_leads: number
  platform_leads: number | null
  contracts: number
  revenue: number
  roas: number | null
  cpl: number | null
  ctr: number | null
  conversion_rate: number | null
  match_rate: number | null
  creative: AdCreative | null
}

export interface CreativeLibraryItem {
  ad_id: string
  ad_name: string | null
  campaign_name: string | null
  campaign_id: string
  media_image_src: string | null
  thumbnail_url: string | null
  title: string | null
  crm_leads: number
  contracts: number
  revenue: number
  spend: number
  roas: number | null
  cpl: number | null
}

export const AdsAnalyticsAPI = {
  /**
   * Get ads overview (summary KPIs)
   */
  async getOverview(params: {
    date_from: string
    date_to: string
    platform?: string
  }): Promise<AdsOverview> {
    const response = await api.get('/ads/overview', { params })
    return response.data
  },

  /**
   * Get campaigns list with performance metrics
   */
  async getCampaigns(params: {
    date_from: string
    date_to: string
    platform?: string
    status?: string
    sort?: 'spend' | 'leads' | 'roas' | 'cpl'
    limit?: number
  }): Promise<{ data: CampaignPerformance[]; total: number }> {
    const response = await api.get('/ads/campaigns', { params })
    return response.data
  },

  /**
   * Get ads by campaign (with creatives)
   */
  async getAdsByCampaign(
    campaignId: string,
    params: {
      date_from: string
      date_to: string
      platform: string
    }
  ): Promise<{
    campaign: CampaignPerformance
    ads: AdPerformance[]
    total_ads: number
  }> {
    const response = await api.get(`/ads/campaigns/${campaignId}/ads`, { params })
    return response.data
  },

  /**
   * Get creative library
   */
  async getCreatives(params: {
    date_from: string
    date_to: string
    platform?: string
    campaign_id?: string
    has_image?: boolean
    sort?: 'best_roas' | 'most_leads' | 'lowest_cpl' | 'recent'
    limit?: number
    offset?: number
  }): Promise<{
    data: CreativeLibraryItem[]
    total: number
    has_more: boolean
  }> {
    const response = await api.get('/ads/creatives', { params })
    return response.data
  }
}

// ============================================================================
// Helper functions
// ============================================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(2)}%`
}

export function formatROAS(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(2)}x`
}
