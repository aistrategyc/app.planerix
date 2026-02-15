"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DateRangePicker } from "@/components/ui/date_range_picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCities } from "@/app/analytics/hooks/use_cities"
import type { AttributionFiltersValue, CompareMode } from "@/app/attribution/types"
import { cn } from "@/lib/utils"

interface AttributionFilterBarProps {
  value: AttributionFiltersValue
  onChange: (next: Partial<AttributionFiltersValue>) => void
  onApply: () => void
  onReset: () => void
  isLoading?: boolean
  sticky?: boolean
  meta?: React.ReactNode
  className?: string
}

const compareOptions: { value: CompareMode; label: string }[] = [
  { value: "none", label: "No comparison" },
  { value: "prev_period", label: "Previous period" },
  { value: "prev_year", label: "Previous year" },
  { value: "custom", label: "Custom" },
]

export function AttributionFilterBar({
  value,
  onChange,
  onApply,
  onReset,
  isLoading,
  sticky = true,
  meta,
  className,
}: AttributionFilterBarProps) {
  const { cities } = useCities()
  const selectedCity = useMemo(
    () => cities.find((city) => String(city.id_city) === value.cityId),
    [cities, value.cityId]
  )

  const formatShortDate = (date?: Date) =>
    date ? date.toLocaleDateString("en-US", { day: "2-digit", month: "short" }) : ""

  const channelLabelMap: Record<string, string> = {
    paid_meta: "Paid Meta",
    paid_gads: "Paid Google Ads",
    offline: "Offline",
    organic: "Organic",
    unknown: "Unknown",
  }

  const deviceLabelMap: Record<string, string> = {
    desktop: "Desktop",
    mobile: "Mobile",
    tablet: "Tablet",
  }

  const conversionLabelMap: Record<string, string> = {
    platform_leads: "Platform leads",
    crm_requests: "CRM requests",
    contracts: "Contracts",
    paid: "Paid",
  }

  const activeFilters = [
    value.dateRange?.from && value.dateRange?.to
      ? `Период: ${formatShortDate(value.dateRange.from)} - ${formatShortDate(value.dateRange.to)}`
      : value.dateRange?.from
      ? `Дата: ${formatShortDate(value.dateRange.from)}`
      : null,
    value.compareMode !== "none"
      ? `Compare: ${
          compareOptions.find((opt) => opt.value === value.compareMode)?.label ?? value.compareMode
        }`
      : null,
    value.cityId !== "all" ? `City: ${selectedCity?.city_name ?? value.cityId}` : null,
    value.channel !== "all" ? `Channel: ${channelLabelMap[value.channel] ?? value.channel}` : null,
    value.device !== "all" ? `Device: ${deviceLabelMap[value.device] ?? value.device}` : null,
    value.conversionType !== "all"
      ? `Conversions: ${conversionLabelMap[value.conversionType] ?? value.conversionType}`
      : null,
  ].filter(Boolean) as string[]

  const handleCompareMode = (mode: CompareMode) => {
    if (mode === "custom") {
      onChange({ compareMode: mode })
      return
    }
    onChange({ compareMode: mode, compareRange: {} })
  }

  return (
    <div className={cn(sticky ? "lg:sticky lg:top-[92px] lg:z-20" : "", className)}>
      <Card className="border-muted/70 shadow-sm glass-panel">
        <CardContent className="flex flex-col gap-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
            <DateRangePicker value={value.dateRange} onChange={(dateRange) => onChange({ dateRange })} className="h-8 w-[210px]" />
            <Select value={value.compareMode} onValueChange={(val) => handleCompareMode(val as CompareMode)}>
              <SelectTrigger className="h-8 w-[190px]">
                <SelectValue placeholder="Compare" />
              </SelectTrigger>
              <SelectContent>
                {compareOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {value.compareMode === "custom" && (
              <DateRangePicker
                value={value.compareRange}
                onChange={(compareRange) => onChange({ compareRange })}
                className="h-8 w-[210px]"
              />
            )}
            <CitySelect
              value={value.cityId}
              label={selectedCity?.city_name}
              cities={cities}
              onValueChange={(cityId) => onChange({ cityId })}
            />
            <Select value={value.channel} onValueChange={(channel) => onChange({ channel })}>
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="paid_meta">Paid Meta</SelectItem>
                <SelectItem value="paid_gads">Paid Google Ads</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="organic">Organic</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            <Select value={value.device} onValueChange={(device) => onChange({ device })}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All devices</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="tablet">Tablet</SelectItem>
              </SelectContent>
            </Select>
            <Select value={value.conversionType} onValueChange={(conversionType) => onChange({ conversionType })}>
              <SelectTrigger className="h-8 w-[170px]">
                <SelectValue placeholder="Conversion type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="platform_leads">Platform leads</SelectItem>
                <SelectItem value="crm_requests">CRM requests</SelectItem>
                <SelectItem value="contracts">Contracts</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" size="sm" className="h-8" onClick={onApply} disabled={isLoading}>
              Apply
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={onReset} disabled={isLoading}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface CitySelectProps {
  value: string
  label?: string
  cities: ReturnType<typeof useCities>["cities"]
  onValueChange: (value: string) => void
}

function CitySelect({ value, label, cities, onValueChange }: CitySelectProps) {
  const [open, setOpen] = useState(false)

  const cityLabel = value === "all" ? "All cities" : label ?? "City"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-8 w-[180px] justify-between">
          <span className="truncate text-left">{cityLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search city" />
          <CommandEmpty>City not found</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            <CommandItem
              value="all"
              onSelect={() => {
                onValueChange("all")
                setOpen(false)
              }}
            >
              <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
              All cities
            </CommandItem>
            {cities.map((city) => (
              <CommandItem
                key={city.id_city}
                value={city.city_name}
                onSelect={() => {
                  onValueChange(String(city.id_city))
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === String(city.id_city) ? "opacity-100" : "opacity-0"
                  )}
                />
                {city.city_name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
