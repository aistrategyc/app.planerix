"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline"

interface PlatformRow {
  platform: string
  spend: number | null
  impressions: number | null
  clicks: number | null
  conversions: number | null
  ctr: number | null
  cpc: number | null
  cpa: number | null
}

interface AdsByPlatformTableProps {
  data: PlatformRow[]
  isLoading?: boolean
}

export function AdsByPlatformTable({ data, isLoading }: AdsByPlatformTableProps) {
  const [sortField, setSortField] = useState<keyof PlatformRow | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const handleSort = (field: keyof PlatformRow) => {
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
    <div className="overflow-x-auto">
      <Table aria-label="Таблиця платформ">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[100px] cursor-pointer" onClick={() => handleSort("platform")}>
              Платформа
              {sortField === "platform" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("spend")}>
              Витрати
              {sortField === "spend" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("impressions")}>
              Покази
              {sortField === "impressions" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("clicks")}>
              Кліки
              {sortField === "clicks" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("conversions")}>
              Конверсії
              {sortField === "conversions" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("ctr")}>
              CTR
              {sortField === "ctr" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("cpc")}>
              CPC
              {sortField === "cpc" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("cpa")}>
              CPA
              {sortField === "cpa" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(8)].map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Немає даних для відображення
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, index) => (
              <TableRow key={`${row.platform}-${index}`}>
                <TableCell>{row.platform}</TableCell>
                <TableCell className="text-right">
                  {row.spend != null ? row.spend.toLocaleString("uk-UA", { style: "currency", currency: "UAH" }) : "–"}
                </TableCell>
                <TableCell className="text-right">{row.impressions != null ? row.impressions.toLocaleString("uk-UA") : "–"}</TableCell>
                <TableCell className="text-right">{row.clicks != null ? row.clicks.toLocaleString("uk-UA") : "–"}</TableCell>
                <TableCell className="text-right">{row.conversions != null ? row.conversions.toLocaleString("uk-UA") : "–"}</TableCell>
                <TableCell className="text-right">{row.ctr != null ? (row.ctr * 100).toFixed(2) + "%" : "–"}</TableCell>
                <TableCell className="text-right">
                  {row.cpc != null ? row.cpc.toLocaleString("uk-UA", { style: "currency", currency: "UAH" }) : "–"}
                </TableCell>
                <TableCell className="text-right">
                  {row.cpa != null ? row.cpa.toLocaleString("uk-UA", { style: "currency", currency: "UAH" }) : "–"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}