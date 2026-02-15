/**
 * Dynamic Date Range Hook
 * Automatically fetches the latest available date range from the database
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DateRange } from '@/lib/api/analytics'
import { fetchWidgetRange } from '@/lib/api/analytics-widgets'

export interface DateRangeValue {
  from: Date
  to: Date
}

interface DatabaseDateRange {
  max_date: string | null
  min_date: string | null
  suggested_start_date: string | null
  suggested_end_date: string | null
  month_start_date: string | null
  has_recent_data: boolean
}

/**
 * Hook to fetch dynamic date range from database
 */
export function useDynamicDateRange(defaultDaysBack: number = 7, widgetKey: string = "crm.kpi_cards") {
  // Fetch actual date range from database
  const { data: dbDateRange, isLoading, error } = useQuery({
    queryKey: ['analytics', 'date-range', widgetKey],
    queryFn: async (): Promise<DatabaseDateRange> => {
      const range = await fetchWidgetRange(widgetKey)
      const maxDate = range.max_date ?? null
      const minDate = range.min_date ?? null
      if (!maxDate) {
        return {
          max_date: null,
          min_date: minDate,
          suggested_start_date: null,
          suggested_end_date: null,
          month_start_date: null,
          has_recent_data: false,
        }
      }
      const maxDateObj = new Date(maxDate)
      const suggestedEnd = maxDateObj
      const suggestedStart = new Date(maxDateObj)
      suggestedStart.setDate(suggestedStart.getDate() - defaultDaysBack + 1)
      if (minDate) {
        const earliest = new Date(minDate)
        if (suggestedStart < earliest) {
          suggestedStart.setTime(earliest.getTime())
        }
      }
      const monthStart = new Date(maxDateObj.getFullYear(), maxDateObj.getMonth(), 1)
      return {
        max_date: maxDate,
        min_date: minDate,
        suggested_start_date: suggestedStart.toISOString().slice(0, 10),
        suggested_end_date: suggestedEnd.toISOString().slice(0, 10),
        month_start_date: monthStart.toISOString().slice(0, 10),
        has_recent_data: true,
      }
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: 3,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  })

  const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
    // Fallback to hardcoded range while loading
    const to = new Date('2025-09-25')
    const from = new Date('2025-08-31')
    return { from, to }
  })

  // Update date range when database data is available
  useEffect(() => {
    if (dbDateRange && !error && dbDateRange.suggested_end_date && dbDateRange.suggested_start_date) {
      // Use suggested dates from widget range (covers last week of available data)
      const to = new Date(dbDateRange.suggested_end_date)
      const from = new Date(dbDateRange.suggested_start_date)

      // Validate dates
      if (!isNaN(to.getTime()) && !isNaN(from.getTime())) {
        setDateRange({ from, to })
      } else {
        console.warn('Invalid date range from database, using fallback')
      }
    }
  }, [dbDateRange, error])

  // Convert to API format
  const apiDateRange: DateRange = {
    start_date: dateRange.from.toISOString().split('T')[0],
    end_date: dateRange.to.toISOString().split('T')[0]
  }

  const updateDateRange = useCallback((newRange: DateRangeValue) => {
    setDateRange(newRange)
  }, [])

  const setPresetRange = useCallback((days: number) => {
    if (dbDateRange?.max_date) {
      // Use database max date as reference (most recent available data)
      const to = new Date(dbDateRange.max_date)
      const from = new Date(to)
      from.setDate(from.getDate() - days + 1)

      // Don't go before the earliest available data
      if (dbDateRange.min_date) {
        const earliestDate = new Date(dbDateRange.min_date)
        if (from < earliestDate) {
          from.setTime(earliestDate.getTime())
        }
      }

      setDateRange({ from, to })
    } else {
      // Fallback to hardcoded range
      const to = new Date('2025-09-25')
      const from = new Date(to)
      from.setDate(from.getDate() - days + 1)
      const earliestDate = new Date('2025-08-31')
      if (from < earliestDate) {
        from.setTime(earliestDate.getTime())
      }
      setDateRange({ from, to })
    }
  }, [dbDateRange])

  const refreshDateRange = useCallback(async () => {
    // Force refetch the date range
    return fetchWidgetRange(widgetKey)
      .then((range) => {
        if (!range.max_date) return
        const to = new Date(range.max_date)
        const from = new Date(range.max_date)
        from.setDate(from.getDate() - defaultDaysBack + 1)
        if (range.min_date) {
          const earliestDate = new Date(range.min_date)
          if (from < earliestDate) {
            from.setTime(earliestDate.getTime())
          }
        }
        if (!isNaN(to.getTime()) && !isNaN(from.getTime())) {
          setDateRange({ from, to })
          return { from, to }
        }
      })
      .catch(console.error)
  }, [defaultDaysBack, widgetKey])

  return {
    dateRange,
    apiDateRange,
    updateDateRange,
    setPresetRange,
    refreshDateRange,
    isLoading,
    error,
    databaseInfo: dbDateRange,
    isUsingDatabaseDates: Boolean(dbDateRange && !error)
  }
}
