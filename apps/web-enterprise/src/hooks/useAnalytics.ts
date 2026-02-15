/**
 * Analytics Hooks - React hooks for ITstep Analytics Dashboard
 * Provides typed hooks for all analytics endpoints with caching and error handling
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnalyticsAPI, DateRange, DashboardOverview, RealTimeMetrics, CampaignPerformance, CreativePerformance, CreativeBurnout, AnalyticsFilters } from '@/lib/api/analytics'

// Request management constants
const DEFAULT_RETRY_DELAY = 1000 // 1 second
const MAX_RETRIES = 3
const STALE_TIME_SHORT = 2 * 60 * 1000 // 2 minutes
const STALE_TIME_MEDIUM = 5 * 60 * 1000 // 5 minutes
const STALE_TIME_LONG = 10 * 60 * 1000 // 10 minutes
const REFETCH_INTERVAL_REALTIME = 60 * 1000 // 1 minute instead of 30 seconds

// Exponential backoff retry function
const exponentialBackoff = (attempt: number) => {
  return Math.min(DEFAULT_RETRY_DELAY * Math.pow(2, attempt), 10000) // Max 10 seconds
}

// ==================== QUERY KEYS ====================

export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: (dateRange: DateRange) => [...analyticsKeys.all, 'dashboard', dateRange] as const,
  realtime: () => [...analyticsKeys.all, 'realtime'] as const,
  kpis: (dateRange: DateRange) => [...analyticsKeys.all, 'kpis', dateRange] as const,
  platforms: (dateRange: DateRange) => [...analyticsKeys.all, 'platforms', dateRange] as const,

  // Sales
  revenueTrend: (dateRange: DateRange) => [...analyticsKeys.all, 'sales', 'revenue-trend', dateRange] as const,
  salesByProducts: (dateRange: DateRange) => [...analyticsKeys.all, 'sales', 'by-products', dateRange] as const,
  conversionFunnel: (dateRange: DateRange) => [...analyticsKeys.all, 'sales', 'funnel', dateRange] as const,

  // Campaigns
  campaigns: (filters: AnalyticsFilters) => [...analyticsKeys.all, 'campaigns', filters] as const,
  campaignTrend: (campaignId: string, dateRange: DateRange) => [...analyticsKeys.all, 'campaigns', campaignId, 'trend', dateRange] as const,
  campaignsByProducts: (dateRange: DateRange) => [...analyticsKeys.all, 'campaigns', 'by-products', dateRange] as const,
  rollingPerformance: (days: number) => [...analyticsKeys.all, 'campaigns', 'rolling', days] as const,
  campaignsSummary: (dateRange: DateRange) => [...analyticsKeys.all, 'campaigns', 'summary', dateRange] as const,

  // Creatives
  creatives: (filters: AnalyticsFilters) => [...analyticsKeys.all, 'creatives', filters] as const,
  creativeBurnout: (daysBack: number, minDays: number) => [...analyticsKeys.all, 'creatives', 'burnout', daysBack, minDays] as const,
  topCreatives: (dateRange: DateRange, metric: string, limit: number) => [...analyticsKeys.all, 'creatives', 'top', dateRange, metric, limit] as const,
  creativeThemes: (dateRange: DateRange) => [...analyticsKeys.all, 'creatives', 'themes', dateRange] as const,
  creativeDetails: (creativeId: string, dateRange: DateRange) => [...analyticsKeys.all, 'creatives', creativeId, dateRange] as const,
}

// ==================== CUSTOM HOOKS ====================

/**
 * Hook for dashboard overview data with retry logic
 */
export function useDashboardOverview(dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.dashboard(dateRange),
    queryFn: () => AnalyticsAPI.getDashboardOverview(dateRange),
    staleTime: STALE_TIME_MEDIUM,
    gcTime: STALE_TIME_LONG,
    retry: MAX_RETRIES,
    retryDelay: exponentialBackoff,
    enabled: Boolean(dateRange.start_date && dateRange.end_date),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
}

/**
 * Hook for real-time metrics (updates every minute with retry logic)
 */
export function useRealTimeMetrics() {
  return useQuery({
    queryKey: analyticsKeys.realtime(),
    queryFn: () => AnalyticsAPI.getRealTimeMetrics(),
    refetchInterval: REFETCH_INTERVAL_REALTIME,
    staleTime: STALE_TIME_SHORT,
    gcTime: STALE_TIME_MEDIUM,
    retry: 2, // Less retries for frequent updates
    retryDelay: exponentialBackoff,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    // Pause refetch when page is not visible
    refetchIntervalInBackground: false,
  })
}

/**
 * Hook for KPI metrics with retry logic
 */
export function useKPIs(dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.kpis(dateRange),
    queryFn: () => AnalyticsAPI.getKPIs(dateRange),
    staleTime: STALE_TIME_MEDIUM,
    gcTime: STALE_TIME_LONG,
    retry: MAX_RETRIES,
    retryDelay: exponentialBackoff,
    enabled: Boolean(dateRange.start_date && dateRange.end_date),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
}

/**
 * Hook for platform performance with retry logic
 */
export function usePlatformPerformance(dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.platforms(dateRange),
    queryFn: () => AnalyticsAPI.getPlatformPerformance(dateRange),
    staleTime: STALE_TIME_LONG,
    gcTime: STALE_TIME_LONG * 2,
    retry: MAX_RETRIES,
    retryDelay: exponentialBackoff,
    enabled: Boolean(dateRange.start_date && dateRange.end_date),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
}

// ==================== SALES HOOKS ====================

/**
 * Hook for revenue trend data with retry logic
 */
export function useRevenueTrend(dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.revenueTrend(dateRange),
    queryFn: () => AnalyticsAPI.getRevenueTrend(dateRange),
    staleTime: STALE_TIME_LONG,
    gcTime: STALE_TIME_LONG * 2,
    retry: MAX_RETRIES,
    retryDelay: exponentialBackoff,
    enabled: Boolean(dateRange.start_date && dateRange.end_date),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
}

/**
 * Hook for sales by products with retry logic
 */
export function useSalesByProducts(dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.salesByProducts(dateRange),
    queryFn: () => AnalyticsAPI.getSalesByProducts(dateRange),
    staleTime: STALE_TIME_LONG,
    gcTime: STALE_TIME_LONG * 2,
    retry: MAX_RETRIES,
    retryDelay: exponentialBackoff,
    enabled: Boolean(dateRange.start_date && dateRange.end_date),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
}

/**
 * Hook for conversion funnel with retry logic
 */
export function useConversionFunnel(dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.conversionFunnel(dateRange),
    queryFn: () => AnalyticsAPI.getConversionFunnel(dateRange),
    staleTime: STALE_TIME_LONG,
    gcTime: STALE_TIME_LONG * 2,
    retry: MAX_RETRIES,
    retryDelay: exponentialBackoff,
    enabled: Boolean(dateRange.start_date && dateRange.end_date),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
}

// ==================== CAMPAIGNS HOOKS ====================

/**
 * Hook for campaign performance with filters and retry logic
 */
export function useCampaignPerformance(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: analyticsKeys.campaigns(filters),
    queryFn: () => AnalyticsAPI.getCampaignPerformance(filters),
    staleTime: STALE_TIME_LONG,
    gcTime: STALE_TIME_LONG * 2,
    retry: MAX_RETRIES,
    retryDelay: exponentialBackoff,
    enabled: Boolean(filters.start_date && filters.end_date),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
}

/**
 * Hook for campaign daily trend
 */
export function useCampaignDailyTrend(campaignId: string, dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.campaignTrend(campaignId, dateRange),
    queryFn: () => AnalyticsAPI.getCampaignDailyTrend(campaignId, dateRange),
    staleTime: 15 * 60 * 1000,
    enabled: Boolean(campaignId && dateRange.start_date && dateRange.end_date),
  })
}

/**
 * Hook for campaigns by products
 */
export function useCampaignsByProducts(dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.campaignsByProducts(dateRange),
    queryFn: () => AnalyticsAPI.getCampaignsByProducts(dateRange),
    staleTime: 20 * 60 * 1000,
    enabled: Boolean(dateRange.start_date && dateRange.end_date),
  })
}

/**
 * Hook for rolling performance
 */
export function useRollingPerformance(days: number = 7) {
  return useQuery({
    queryKey: analyticsKeys.rollingPerformance(days),
    queryFn: () => AnalyticsAPI.getRollingPerformance(days),
    staleTime: 30 * 60 * 1000,
    enabled: days > 0,
  })
}

// ==================== CREATIVES HOOKS ====================

/**
 * Hook for creative performance with retry logic
 */
export function useCreativePerformance(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: analyticsKeys.creatives(filters),
    queryFn: () => AnalyticsAPI.getCreativePerformance(filters),
    staleTime: STALE_TIME_LONG,
    gcTime: STALE_TIME_LONG * 2,
    retry: MAX_RETRIES,
    retryDelay: exponentialBackoff,
    enabled: Boolean(filters.start_date && filters.end_date),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })
}

/**
 * Hook for creative burnout analysis
 */
export function useCreativeBurnout(daysBack: number = 30, minDaysActive: number = 7) {
  return useQuery({
    queryKey: analyticsKeys.creativeBurnout(daysBack, minDaysActive),
    queryFn: () => AnalyticsAPI.getCreativeBurnoutAnalysis(daysBack, minDaysActive),
    staleTime: 20 * 60 * 1000,
  })
}

/**
 * Hook for top performing creatives
 */
export function useTopPerformingCreatives(
  dateRange: DateRange,
  metric: 'roas' | 'revenue' | 'conversions' | 'ctr' | 'spend' = 'roas',
  limit: number = 10
) {
  return useQuery({
    queryKey: analyticsKeys.topCreatives(dateRange, metric, limit),
    queryFn: () => AnalyticsAPI.getTopPerformingCreatives(dateRange, metric, limit),
    staleTime: 15 * 60 * 1000,
    enabled: Boolean(dateRange.start_date && dateRange.end_date),
  })
}

/**
 * Hook for creative themes analysis
 */
export function useCreativeThemes(dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.creativeThemes(dateRange),
    queryFn: () => AnalyticsAPI.getCreativeThemesAnalysis(dateRange),
    staleTime: 30 * 60 * 1000,
    enabled: Boolean(dateRange.start_date && dateRange.end_date),
  })
}

/**
 * Hook for creative details
 */
export function useCreativeDetails(creativeId: string, dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.creativeDetails(creativeId, dateRange),
    queryFn: () => AnalyticsAPI.getCreativeDetails(creativeId, dateRange),
    staleTime: 15 * 60 * 1000,
    enabled: Boolean(creativeId && dateRange.start_date && dateRange.end_date),
  })
}

// ==================== UTILITY HOOKS ====================

/**
 * Hook for managing date range state
 */
export function useDateRange(defaultDays: number = 30) {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    // Use actual data range from database (2025-08-31 to 2025-09-25)
    const endDate = new Date('2025-09-25')
    const startDate = new Date('2025-08-31')

    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    }
  })

  const updateDateRange = useCallback((start: string, end: string) => {
    setDateRange({ start_date: start, end_date: end })
  }, [])

  const setPresetRange = useCallback((days: number) => {
    // Use actual data range from database (2025-08-31 to 2025-09-25)
    const endDate = new Date('2025-09-25')
    const startDate = new Date('2025-08-31')

    setDateRange({
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    })
  }, [])

  return {
    dateRange,
    updateDateRange,
    setPresetRange,
  }
}

/**
 * Hook for analytics filters state management
 */
export function useAnalyticsFilters(defaultDateRange: DateRange) {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    ...defaultDateRange,
    page: 1,
    page_size: 50,
    sort_by: 'spend',
    sort_order: 'desc',
  })

  const updateFilters = useCallback((newFilters: Partial<AnalyticsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({
      ...defaultDateRange,
      page: 1,
      page_size: 50,
      sort_by: 'spend',
      sort_order: 'desc',
    })
  }, [defaultDateRange])

  return {
    filters,
    updateFilters,
    resetFilters,
  }
}

/**
 * Hook for invalidating analytics cache
 */
export function useInvalidateAnalytics() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.all })
  }, [queryClient])

  const invalidateRealtime = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.realtime() })
  }, [queryClient])

  const invalidateDashboard = useCallback((dateRange: DateRange) => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.dashboard(dateRange) })
  }, [queryClient])

  return {
    invalidateAll,
    invalidateRealtime,
    invalidateDashboard,
  }
}
