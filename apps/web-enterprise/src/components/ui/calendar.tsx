"use client"

import * as React from "react"
import { Calendar as BaseCalendar } from "react-date-range"
import "react-date-range/dist/styles.css"
import "react-date-range/dist/theme/default.css"

interface CalendarProps {
  mode?: "single" | "range"
  value?: Date | { from?: Date; to?: Date }
  onChange?: (value: Date | { from?: Date; to?: Date }) => void
  numberOfMonths?: number // ✅ добавлено
  className?: string
  minDate?: Date
  maxDate?: Date
  disabled?: (date: Date) => boolean
}

export function Calendar({
  mode = "single",
  value,
  onChange,
  numberOfMonths = 1,
  className,
  minDate,
  maxDate,
  disabled,
}: CalendarProps) {
  type DateRangeValue = { from?: Date; to?: Date }
  type RangeSelection = { startDate?: Date; endDate?: Date; key?: string }
  type RangePayload = RangeSelection & { selection?: RangeSelection }

  const isRangeValue = (input: CalendarProps["value"]): input is DateRangeValue =>
    !!input && !(input instanceof Date)

  const handleChange = (item: RangePayload | Date) => {
    if (mode === "range") {
      const range = (item as RangePayload).selection || (item as RangeSelection)
      const startDate = range?.startDate || range?.from
      const endDate = range?.endDate || range?.to
      if (startDate && endDate) {
        onChange?.({ from: startDate, to: endDate })
      }
    } else {
      onChange?.(item instanceof Date ? item : new Date())
    }
  }

  const getSelectedRange = () => {
    const rangeValue = isRangeValue(value) ? value : {}
    return {
      startDate: rangeValue.from || new Date(),
      endDate: rangeValue.to || rangeValue.from || new Date(),
      key: "selection",
    }
  }

  const resolvedMinDate = minDate ?? new Date(2000, 0, 1)
  const resolvedMaxDate = maxDate ?? new Date()

  return (
    <div className={`rounded-md border shadow-sm p-2 bg-white ${className ?? ""}`}>
      <BaseCalendar
        showDateDisplay={false}
        editableDateInputs={true}
        onChange={handleChange}
        moveRangeOnFirstSelection={false}
        months={numberOfMonths}
        direction="horizontal"
        rangeColors={["#3b82f6"]}
        minDate={resolvedMinDate}
        maxDate={resolvedMaxDate}
        disabledDates={
          disabled
            ? Array.from({ length: 365 * 20 }) // check up to 20 years back
                .map((_, i) => {
                  const d = new Date(resolvedMaxDate)
                  d.setDate(d.getDate() - i)
                  return disabled(d) ? d : undefined
                })
                .filter((d): d is Date => Boolean(d))
            : undefined
        }
        {...(mode === "range"
          ? {
              ranges: [
                {
                  ...getSelectedRange(),
                  color: "#3b82f6",
                },
              ],
            }
          : {
              date: value instanceof Date ? value : new Date(),
            })}
      />
    </div>
  )
}

// Export as CalendarComponent для обратной совместимости
export const CalendarComponent = Calendar
