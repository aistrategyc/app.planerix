"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline"

interface UtmRow {
  date: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  sessions: number
  conversions: number
  spend: number
  conv_rate: number
  cpa: number | null
  cps: number | null
  platform?: string
}

interface AdsByUtmTableProps {
  data: UtmRow[]
  isLoading?: boolean
}

export function AdsByUtmTable({ data, isLoading }: AdsByUtmTableProps) {
  const [sortField, setSortField] = useState<keyof UtmRow | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const handleSort = (field: keyof UtmRow) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0
    const aValue = a[sortField] ?? 0
    const bValue = b[sortField] ?? 0
    if (aValue === bValue) return 0
    return sortDirection === "asc" ? (aValue < bValue ? -1 : 1) : (aValue > bValue ? -1 : 1)
  })

  return (
    <div className="overflow-x-auto border rounded-xl mt-4">
      <Table aria-label="Таблиця джерел за UTM">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px] cursor-pointer" onClick={() => handleSort("date")}>
              Дата
              {sortField === "date" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="min-w-[100px] cursor-pointer" onClick={() => handleSort("utm_source")}>
              Джерело
              {sortField === "utm_source" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="min-w-[100px] cursor-pointer" onClick={() => handleSort("utm_medium")}>
              Канал
              {sortField === "utm_medium" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="min-w-[150px] cursor-pointer" onClick={() => handleSort("utm_campaign")}>
              Кампанія
              {sortField === "utm_campaign" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("sessions")}>
              Сесії
              {sortField === "sessions" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("conversions")}>
              Конверсії
              {sortField === "conversions" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("spend")}>
              Витрати
              {sortField === "spend" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("conv_rate")}>
              CR
              {sortField === "conv_rate" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("cpa")}>
              CPA
              {sortField === "cpa" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("cps")}>
              CPS
              {sortField === "cps" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(10)].map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                Немає даних для відображення
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((u, index) => (
              <TableRow key={`${u.date}-${u.utm_source}-${u.utm_campaign}-${index}`}>
                <TableCell>{u.date}</TableCell>
                <TableCell>{u.utm_source}</TableCell>
                <TableCell>{u.utm_medium}</TableCell>
                <TableCell>{u.utm_campaign}</TableCell>
                <TableCell className="text-right">{u.sessions.toLocaleString("uk-UA")}</TableCell>
                <TableCell className="text-right">{u.conversions.toLocaleString("uk-UA")}</TableCell>
                <TableCell className="text-right">{u.spend.toLocaleString("uk-UA", { style: "currency", currency: "UAH" })}</TableCell>
                <TableCell className="text-right">{(u.conv_rate * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-right">
                  {u.cpa != null ? u.cpa.toLocaleString("uk-UA", { style: "currency", currency: "UAH" }) : "–"}
                </TableCell>
                <TableCell className="text-right">
                  {u.cps != null ? u.cps.toLocaleString("uk-UA", { style: "currency", currency: "UAH" }) : "–"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}