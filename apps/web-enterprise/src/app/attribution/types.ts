import type { DateRange } from "@/components/ui/date_range_picker"

export type CompareMode = "none" | "prev_period" | "prev_year" | "custom"

export type AttributionFiltersValue = {
  dateRange: DateRange
  compareMode: CompareMode
  compareRange: DateRange
  cityId: string
  channel: string
  device: string
  conversionType: string
}
