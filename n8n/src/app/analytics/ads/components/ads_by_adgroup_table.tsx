"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline"

interface AdGroup {
  ad_group_id: string
  ad_group_name: string
  spend: number | null
  clicks: number | null
  conversions: number | null
  ctr: number | null
  cpc: number | null
  cpa: number | null
  platform?: string
}

interface AdsByAdGroupTableProps {
  data: AdGroup[]
  isLoading?: boolean
}

export function AdsByAdGroupTable({ data, isLoading }: AdsByAdGroupTableProps) {
  const [sortField, setSortField] = useState<keyof AdGroup | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const handleSort = (field: keyof AdGroup) => {
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
    return sortDirection === "asc" ? (aValue < bValue ? -1 : 1) : aValue > bValue ? -1 : 1
  })

  return (
    <div className="overflow-x-auto">
      <Table aria-label="Таблиця груп оголошень">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px] cursor-pointer" onClick={() => handleSort("ad_group_name")}>
              Група оголошень
              {sortField === "ad_group_name" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("spend")}>
              Витрати
              {sortField === "spend" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("clicks")}>
              Кліки
              {sortField === "clicks" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
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
            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("conversions")}>
              Конверсії
              {sortField === "conversions" && <ArrowsUpDownIcon className="inline h-4 w-4 ml-1" />}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(7)].map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Немає даних для відображення
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((g, index) => (
              <TableRow key={`${g.ad_group_id}-${index}`}>
                <TableCell>{g.ad_group_name}</TableCell>
                <TableCell className="text-right">
                  {g.spend != null ? g.spend.toLocaleString("uk-UA", { style: "currency", currency: "UAH" }) : "–"}
                </TableCell>
                <TableCell className="text-right">
                  {g.clicks != null ? g.clicks.toLocaleString("uk-UA") : "–"}
                </TableCell>
                <TableCell className="text-right">
                  {g.ctr != null ? (g.ctr * 100).toFixed(2) + "%" : "–"}
                </TableCell>
                <TableCell className="text-right">
                  {g.cpc != null ? g.cpc.toLocaleString("uk-UA", { style: "currency", currency: "UAH" }) : "–"}
                </TableCell>
                <TableCell className="text-right">
                  {g.cpa != null ? g.cpa.toLocaleString("uk-UA", { style: "currency", currency: "UAH" }) : "–"}
                </TableCell>
                <TableCell className="text-right">
                  {g.conversions != null ? g.conversions.toLocaleString("uk-UA") : "–"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}