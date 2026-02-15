import type { CompareMode } from "@/app/attribution/types"

export const buildDateKey = (value: Date) => value.toISOString().slice(0, 10)

export const parseDateParam = (value: string | null) => {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed
}

export const parseCompareMode = (value: string | null): CompareMode => {
  if (value === "prev_period") return "prev_period"
  if (value === "prev_year") return "prev_year"
  if (value === "custom") return "custom"
  return "none"
}
