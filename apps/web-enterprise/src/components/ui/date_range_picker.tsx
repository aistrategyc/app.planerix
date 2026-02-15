"use client"

import * as React from "react"
import {
  format,
  isEqual,
  isValid,
  startOfToday,
  subDays,
  subMonths,
  subYears,
  isAfter,
} from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"

export interface DateRange {
  from?: Date
  to?: Date
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (value: DateRange) => void
  className?: string
  maxDate?: Date
}

const today = startOfToday()
const yesterday = subDays(today, 1)

function isSameRange(a?: DateRange, b?: DateRange) {
  return a?.from && a?.to && b?.from && b?.to
    ? isEqual(a.from, b.from) && isEqual(a.to, b.to)
    : false
}

export function DateRangePicker({ value, onChange, className, maxDate }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [tempRange, setTempRange] = React.useState<DateRange>(value)
  const [months, setMonths] = React.useState(2)

  React.useEffect(() => {
    setTempRange(value)
  }, [value.from?.getTime(), value.to?.getTime()])

  React.useEffect(() => {
    const updateMonths = () => {
      if (typeof window === "undefined") return
      setMonths(window.innerWidth < 640 ? 1 : 2)
    }
    updateMonths()
    window.addEventListener("resize", updateMonths)
    return () => window.removeEventListener("resize", updateMonths)
  }, [])

  const anchorDate = React.useMemo(() => {
    if (maxDate && isValid(maxDate)) return maxDate
    if (value.to && isValid(value.to)) return value.to
    return yesterday
  }, [maxDate, value.to])

  const presets: { label: string; range: DateRange }[] = React.useMemo(
    () => [
      { label: "Вчера", range: { from: anchorDate, to: anchorDate } },
      { label: "7 дней", range: { from: subDays(anchorDate, 6), to: anchorDate } },
      { label: "30 дней", range: { from: subDays(anchorDate, 29), to: anchorDate } },
      { label: "90 дней", range: { from: subDays(anchorDate, 89), to: anchorDate } },
      { label: "Месяц", range: { from: subMonths(anchorDate, 1), to: anchorDate } },
      { label: "Квартал", range: { from: subMonths(anchorDate, 3), to: anchorDate } },
      { label: "Год", range: { from: subYears(anchorDate, 1), to: anchorDate } },
    ],
    [anchorDate]
  )

  const upperBound = maxDate && isValid(maxDate) ? maxDate : undefined
  const popoverAlign = months === 1 ? "start" : "center"

  const label =
    value.from && value.to && isValid(value.from) && isValid(value.to)
      ? `${format(value.from, "dd.MM.yyyy")} – ${format(value.to, "dd.MM.yyyy")}`
      : "Выбрать период"

  const activePreset = presets.find((p) => isSameRange(p.range, value))

  const normalizeRange = (range?: DateRange) => {
    if (!range?.from || !range?.to) return range || {}
    let from = range.from
    let to = range.to
    if (isAfter(from, to)) {
      ;[from, to] = [to, from]
    }
    if (upperBound && isAfter(to, upperBound)) {
      to = upperBound
    }
    if (upperBound && isAfter(from, upperBound)) {
      from = upperBound
    }
    return { from, to }
  }

  const handleCalendarChange = (range?: DateRange) => {
    setTempRange(normalizeRange(range))
  }

  const applyRange = () => {
    if (!tempRange.from || !tempRange.to) return
    if (!isValid(tempRange.from) || !isValid(tempRange.to)) return
    const finalRange = normalizeRange(tempRange)
    onChange(finalRange)
    setOpen(false)
  }

  const cancelSelection = () => {
    setTempRange(value)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={["w-[260px] justify-start text-left font-normal", className].filter(Boolean).join(" ")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(620px,calc(100vw-24px))] max-h-[80vh] overflow-auto p-4 space-y-4"
        align={popoverAlign}
        side="bottom"
        sideOffset={10}
        collisionPadding={12}
        avoidCollisions
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant={activePreset?.label === preset.label ? "default" : "ghost"}
              className="justify-start"
              onClick={() => {
                setTempRange(preset.range)
                onChange(preset.range)
                setOpen(false)
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          value={tempRange}
          onChange={handleCalendarChange as (value: Date | { from?: Date; to?: Date }) => void}
          numberOfMonths={months}
          className="rounded-md border"
          maxDate={upperBound}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={cancelSelection}>
            Закрити
          </Button>
          <Button size="sm" onClick={applyRange} disabled={!tempRange.from || !tempRange.to}>
            Застосувати
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
