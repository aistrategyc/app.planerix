"use client"

import { DateRangePicker } from "@/components/ui/date_range_picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useCities } from "@/app/analytics/hooks/use_cities"
import { SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export type AnalyticsFiltersValue = {
  dateRange: { from?: Date; to?: Date }
  cityId: string
  product?: string
  branch?: string
  source?: string
}

type AnalyticsFiltersProps = {
  value: AnalyticsFiltersValue
  onDateChange: (value: { from?: Date; to?: Date }) => void
  onCityChange?: (value: string) => void
  onProductChange?: (value: string) => void
  onBranchChange?: (value: string) => void
  onSourceChange?: (value: string) => void
  onApply: () => void
  onReset: () => void
  isLoading?: boolean
  showDateRange?: boolean
  showCity?: boolean
  allowAllCities?: boolean
  showProduct?: boolean
  showBranch?: boolean
  showSource?: boolean
  compact?: boolean
  extraControls?: React.ReactNode
  sticky?: boolean
  meta?: React.ReactNode
  className?: string
}

export function AnalyticsFilters({
  value,
  onDateChange,
  onCityChange,
  onProductChange,
  onBranchChange,
  onSourceChange,
  onApply,
  onReset,
  isLoading,
  showDateRange = true,
  showCity = true,
  allowAllCities = true,
  showProduct = false,
  showBranch = false,
  showSource = false,
  compact = false,
  extraControls,
  sticky = true,
  meta,
  className,
}: AnalyticsFiltersProps) {
  const { cities } = useCities()
  const safeProduct = value.product ?? ""
  const safeBranch = value.branch ?? ""
  const safeSource = value.source ?? ""
  const handleProduct = onProductChange ?? (() => {})
  const handleBranch = onBranchChange ?? (() => {})
  const handleSource = onSourceChange ?? (() => {})
  const handleCityChange = onCityChange ?? (() => {})
  const controlHeight = "h-[var(--form-height)]"
  const dateWidth = compact ? "w-full sm:w-[210px]" : "w-[160px]"
  const cityWidth = compact ? "w-full sm:w-[160px]" : "w-[140px]"
  const inputWidth = compact ? "w-full sm:w-[180px]" : "w-[150px]"
  const densityClass = compact ? "form-compact" : ""

  const formatShortDate = (date?: Date) =>
    date ? date.toLocaleDateString("en-US", { day: "2-digit", month: "short" }) : ""

  const activeFilters = [
    value.dateRange?.from && value.dateRange?.to
      ? `Period: ${formatShortDate(value.dateRange.from)} - ${formatShortDate(value.dateRange.to)}`
      : value.dateRange?.from
      ? `Date: ${formatShortDate(value.dateRange.from)}`
      : null,
    value.cityId !== "all"
      ? `City: ${cities.find((c) => String(c.id_city) === value.cityId)?.city_name ?? value.cityId}`
      : null,
    safeProduct ? `Product: ${safeProduct}` : null,
    safeBranch ? `Branch: ${safeBranch}` : null,
    safeSource ? `Source: ${safeSource}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className={cn(sticky ? "lg:sticky lg:top-[92px] lg:z-20" : "", className)}>
      <Card className="border-muted/70 shadow-sm glass-panel">
        <CardContent className={cn("flex flex-col gap-3 py-3", densityClass)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.length === 0 ? (
                <span className="text-xs text-muted-foreground">No active filters</span>
              ) : (
                activeFilters.map((item) => (
                  <Badge key={item} variant="outline" className="text-[10px]">
                    {item}
                  </Badge>
                ))
              )}
              {meta}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showDateRange && (
              <DateRangePicker value={value.dateRange} onChange={onDateChange} className={`${controlHeight} ${dateWidth}`} />
            )}
            {showCity && (
              <Select value={value.cityId} onValueChange={handleCityChange}>
                <SelectTrigger className={`${controlHeight} ${cityWidth}`}>
                  <SelectValue placeholder="City" />
                </SelectTrigger>
                <SelectContent>
                  {allowAllCities && <SelectItem value="all">All cities</SelectItem>}
                  {cities.map((city) => (
                    <SelectItem key={city.id_city} value={String(city.id_city)}>
                      {city.city_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showProduct && (
              <Input
                value={safeProduct}
                onChange={(event) => handleProduct(event.target.value)}
                placeholder="Product"
                className={`${controlHeight} ${inputWidth}`}
              />
            )}
            {showBranch && (
              <Input
                value={safeBranch}
                onChange={(event) => handleBranch(event.target.value)}
                placeholder="Branch"
                className={`${controlHeight} ${inputWidth}`}
              />
            )}
            {showSource && (
              <Input
                value={safeSource}
                onChange={(event) => handleSource(event.target.value)}
                placeholder="Source"
                className={`${controlHeight} ${inputWidth}`}
              />
            )}
            {extraControls}
            <Button variant="secondary" size="sm" className={`${controlHeight} px-3`} onClick={onApply} disabled={isLoading}>
              Apply
            </Button>
            <Button variant="ghost" size="sm" className={`${controlHeight} px-3`} onClick={onReset} disabled={isLoading}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
