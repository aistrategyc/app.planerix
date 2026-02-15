import { useState, useCallback, useEffect } from 'react'
import { DateRange } from '@/lib/api/analytics'

export interface DateRangeValue {
  from: Date
  to: Date
}

export function useAnalyticsDateRange(defaultDays: number = 30) {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
    // Use actual data range from database (2025-08-31 to 2025-09-25)
    const to = new Date('2025-09-25')
    const from = new Date('2025-08-31')
    return { from, to }
  })

  // Convert to API format
  const apiDateRange: DateRange = {
    start_date: dateRange.from.toISOString().split('T')[0],
    end_date: dateRange.to.toISOString().split('T')[0]
  }

  const updateDateRange = useCallback((newRange: DateRangeValue) => {
    setDateRange(newRange)
  }, [])

  const setPresetRange = useCallback((days: number) => {
    // Use actual data range from database (2025-08-31 to 2025-09-25)
    const to = new Date('2025-09-25')
    const from = new Date('2025-08-31')
    // For preset ranges, calculate from the last date of real data
    if (days <= 25) { // If requested range is within our data
      const rangeFrom = new Date(to)
      rangeFrom.setDate(rangeFrom.getDate() - days + 1)
      // Make sure we don't go before our first data date
      if (rangeFrom >= from) {
        setDateRange({ from: rangeFrom, to })
        return
      }
    }
    // Default to full data range
    setDateRange({ from, to })
  }, [])

  return {
    dateRange,
    apiDateRange,
    updateDateRange,
    setPresetRange
  }
}