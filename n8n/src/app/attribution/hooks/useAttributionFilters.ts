"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { AttributionFiltersValue, CompareMode } from "@/app/attribution/types"
import { buildDateKey, parseCompareMode, parseDateParam } from "@/app/attribution/utils/filters"

const DEFAULT_FILTERS: AttributionFiltersValue = {
  dateRange: {},
  compareMode: "none",
  compareRange: {},
  cityId: "all",
  channel: "all",
  device: "all",
  conversionType: "all",
}

const buildFiltersFromSearch = (searchParams: URLSearchParams): AttributionFiltersValue => {
  const rawConversion = searchParams.get("conversion_type") ?? "all"
  const normalizedConversion =
    rawConversion === "lead"
      ? "platform_leads"
      : rawConversion === "contract"
        ? "contracts"
        : rawConversion

  const compareMode = parseCompareMode(searchParams.get("compare"))
  const compareRange =
    compareMode === "custom"
      ? {
          from: parseDateParam(searchParams.get("compare_from")),
          to: parseDateParam(searchParams.get("compare_to")),
        }
      : {}

  return {
    dateRange: {
      from: parseDateParam(searchParams.get("date_from")),
      to: parseDateParam(searchParams.get("date_to")),
    },
    compareMode,
    compareRange,
    cityId: searchParams.get("id_city") ?? "all",
    channel: searchParams.get("channel") ?? "all",
    device: searchParams.get("device") ?? "all",
    conversionType: normalizedConversion,
  }
}

type FilterUpdates = Record<string, string | null | undefined>

export const useAttributionFilters = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()

  const [draftFilters, setDraftFilters] = useState<AttributionFiltersValue>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<AttributionFiltersValue>(DEFAULT_FILTERS)

  useEffect(() => {
    const nextFilters = buildFiltersFromSearch(searchParams)
    setDraftFilters(nextFilters)
    setAppliedFilters(nextFilters)
  }, [searchKey])

  const updateQuery = useCallback((updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchKey)
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }, [pathname, router, searchKey])

  const applyFilters = (extraUpdates: FilterUpdates = {}) => {
    setAppliedFilters(draftFilters)
    const compareUpdates =
      draftFilters.compareMode === "custom"
        ? {
            compare: "custom",
            compare_from: draftFilters.compareRange.from ? buildDateKey(draftFilters.compareRange.from) : null,
            compare_to: draftFilters.compareRange.to ? buildDateKey(draftFilters.compareRange.to) : null,
          }
        : {
            compare: draftFilters.compareMode === "none" ? null : draftFilters.compareMode,
            compare_from: null,
            compare_to: null,
          }

    updateQuery({
      date_from: draftFilters.dateRange.from ? buildDateKey(draftFilters.dateRange.from) : null,
      date_to: draftFilters.dateRange.to ? buildDateKey(draftFilters.dateRange.to) : null,
      id_city: draftFilters.cityId === "all" ? null : draftFilters.cityId,
      channel: draftFilters.channel === "all" ? null : draftFilters.channel,
      device: draftFilters.device === "all" ? null : draftFilters.device,
      conversion_type: draftFilters.conversionType === "all" ? null : draftFilters.conversionType,
      ...compareUpdates,
      ...extraUpdates,
    })
  }

  const resetFilters = (extraUpdates: FilterUpdates = {}) => {
    setDraftFilters(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
    updateQuery({
      date_from: null,
      date_to: null,
      compare: null,
      compare_from: null,
      compare_to: null,
      id_city: null,
      channel: null,
      device: null,
      conversion_type: null,
      ...extraUpdates,
    })
  }

  const compareMode: CompareMode = useMemo(() => appliedFilters.compareMode, [appliedFilters.compareMode])

  return {
    draftFilters,
    appliedFilters,
    setDraftFilters,
    setAppliedFilters,
    applyFilters,
    resetFilters,
    updateQuery,
    compareMode,
  }
}
