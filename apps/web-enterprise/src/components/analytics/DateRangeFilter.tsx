"use client"

import { Button } from "@/components/ui/button"
import { CalendarIcon } from "lucide-react"

export interface DateRangeValue {
  from: Date
  to: Date
}

interface DateRangeFilterProps {
  value: DateRangeValue
  onChange: (range: DateRangeValue) => void
  className?: string
}

const PRESET_RANGES = [
  {
    label: "7 дней",
    getValue: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 6)
      return { from, to }
    }
  },
  {
    label: "30 дней",
    getValue: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 29)
      return { from, to }
    }
  },
  {
    label: "90 дней",
    getValue: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 89)
      return { from, to }
    }
  }
]

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const handlePresetClick = (preset: typeof PRESET_RANGES[0]) => {
    const range = preset.getValue()
    onChange(range)
  }

  const formatDateRange = (range: DateRangeValue) => {
    const fromStr = range.from.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    const toStr = range.to.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })

    if (range.from.getTime() === range.to.getTime()) {
      return fromStr
    }

    return `${fromStr} - ${toStr}`
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
        <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />
        {formatDateRange(value)}
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESET_RANGES.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            className="text-xs h-7 px-3"
            onClick={() => handlePresetClick(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
