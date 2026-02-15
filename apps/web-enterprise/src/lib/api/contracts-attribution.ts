/**
 * API client for Contracts Attribution Analysis
 *
 * Provides detailed analysis of contract sources, platforms, and conversion funnels
 */

import { api } from './config'

// ============================================================================
// Types
// ============================================================================

export interface AttributionTypeData {
  attribution_type: string
  total_leads: number
  contracts: number
  revenue: number
  avg_contract_value: number
  conversion_rate: number
  lead_share_pct: number
  contract_share_pct: number
}

export interface AttributionSummaryResponse {
  data: AttributionTypeData[]
  total_leads: number
  total_contracts: number
  total_revenue: number
  overall_conversion_rate: number
}

export interface ContractPlatformData {
  platform: string
  total_leads: number
  contracts: number
  revenue: number
  avg_contract_value: number
  conversion_rate: number
}

export interface ContractsByPlatformResponse {
  data: ContractPlatformData[]
}

export interface ContractSourceData {
  platform: string
  traffic_source: string
  campaign: string
  total_leads: number
  contracts: number
  revenue: number
  avg_contract_value: number
  conversion_rate: number
}

export interface ContractsBySourceResponse {
  data: ContractSourceData[]
}

export interface ContractTimelineData {
  dt: string // YYYY-MM-DD
  total_leads: number
  contracts: number
  revenue: number
  conversion_rate: number
}

export interface ContractsTimelineResponse {
  data: ContractTimelineData[]
}

export interface ContractsFilters {
  date_from: string
  date_to: string
  platform?: string
  limit?: number
  group_by?: 'day' | 'week' | 'month'
}

// ============================================================================
// API Client
// ============================================================================

export const ContractsAttributionAPI = {
  /**
   * Get contracts attribution summary
   * Shows which attribution types convert best
   */
  async getAttributionSummary(filters: {
    date_from: string
    date_to: string
  }): Promise<AttributionSummaryResponse> {
    const response = await api.get('/data-analytics/v8/contracts/attribution-summary', {
      params: filters,
    })
    return response.data
  },

  /**
   * Get contracts breakdown by platform
   * Compare effectiveness of different platforms
   */
  async getByPlatform(filters: {
    date_from: string
    date_to: string
  }): Promise<ContractsByPlatformResponse> {
    const response = await api.get('/data-analytics/v8/contracts/by-platform', {
      params: filters,
    })
    return response.data
  },

  /**
   * Get top traffic sources by contracts
   * Find best performing campaigns and sources
   */
  async getBySource(filters: ContractsFilters): Promise<ContractsBySourceResponse> {
    const response = await api.get('/data-analytics/v8/contracts/by-source', {
      params: {
        date_from: filters.date_from,
        date_to: filters.date_to,
        platform: filters.platform,
        limit: filters.limit || 50,
      },
    })
    return response.data
  },

  /**
   * Get contracts timeline (conversion funnel over time)
   * Analyze leads → contracts funnel trends
   */
  async getTimeline(filters: ContractsFilters): Promise<ContractsTimelineResponse> {
    const response = await api.get('/data-analytics/v8/contracts/timeline', {
      params: {
        date_from: filters.date_from,
        date_to: filters.date_to,
        group_by: filters.group_by || 'day',
        platform: filters.platform,
      },
    })
    return response.data
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return `${value.toFixed(2)}%`
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('uk-UA').format(num)
}

/**
 * Get color for conversion rate
 * Good: green, Medium: yellow, Bad: red
 */
export function getConversionRateColor(rate: number): string {
  if (rate >= 10) return 'text-green-600'
  if (rate >= 5) return 'text-yellow-600'
  if (rate >= 2) return 'text-orange-600'
  return 'text-red-600'
}

/**
 * Get status badge for platform
 */
export function getPlatformBadgeColor(platform: string): string {
  const colors: Record<string, string> = {
    google: 'bg-blue-100 text-blue-800',
    meta: 'bg-purple-100 text-purple-800',
    direct: 'bg-gray-100 text-gray-800',
    email: 'bg-green-100 text-green-800',
    other: 'bg-orange-100 text-orange-800',
  }
  return colors[platform.toLowerCase()] || 'bg-gray-100 text-gray-800'
}
