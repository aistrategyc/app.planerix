import * as React from "react"
import { useMemo, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { MetricCard } from "./metric_card"

interface UtmRow {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  contract_count: number
  total_revenue: number
  total_first_sum: number
}

interface SalesByUtmTableProps {
  data: UtmRow[]
}

export function SalesByUtmTable({ data }: SalesByUtmTableProps) {
  const aggregated = useMemo(() => {
    const totalRevenue = data.reduce((a, r) => a + (r.total_revenue ?? 0), 0)
    const totalContracts = data.reduce((a, r) => a + (r.contract_count ?? 0), 0)
    const totalFirstSum = data.reduce((a, r) => a + (r.total_first_sum ?? 0), 0)
    const avgRevenuePerContract = totalContracts > 0 ? Math.round(totalRevenue / totalContracts) : 0
    const conversionRate = totalRevenue > 0 ? ((totalFirstSum / totalRevenue) * 100).toFixed(1) : "0.0"
    return { totalRevenue, totalContracts, totalFirstSum, avgRevenuePerContract, conversionRate }
  }, [data])

  const rows = useMemo(
    () =>
      data.map((r) => ({
        ...r,
        revenueShare:
          aggregated.totalRevenue > 0
            ? Number(((r.total_revenue / aggregated.totalRevenue) * 100).toFixed(1))
            : 0,
      })),
    [data, aggregated.totalRevenue]
  )

  // Пагинация (как раньше)
  const [pageSize, setPageSize] = useState("10")
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / Number(pageSize)))
  const start = (page - 1) * Number(pageSize)
  const end = start + Number(pageSize)
  const pageRows = rows.slice(start, end)

  return (
    <div className="space-y-4">
      {/* Мини-метрики */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Середня конверсія" value={`${aggregated.conversionRate}%`} subtitle="(перший платіж / виручка)" />
        <MetricCard title="Загальна виручка" value={`${aggregated.totalRevenue.toLocaleString("uk-UA")} ₴`} />
        <MetricCard title="Усього контрактів" value={aggregated.totalContracts.toLocaleString("uk-UA")} />
        <MetricCard title="Середній чек" value={`${aggregated.avgRevenuePerContract.toLocaleString("uk-UA")} ₴`} />
      </div>

      {/* Панель управления */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Показано{" "}
          <span className="font-medium text-foreground">
            {rows.length === 0 ? 0 : start + 1}–{Math.min(end, rows.length)}
          </span>{" "}
          із <span className="font-medium text-foreground">{rows.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={pageSize} onValueChange={(v) => { setPageSize(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 / стор.</SelectItem>
              <SelectItem value="10">10 / стор.</SelectItem>
              <SelectItem value="20">20 / стор.</SelectItem>
              <SelectItem value="50">50 / стор.</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Назад
            </Button>
            <div className="text-sm tabular-nums">{page} / {totalPages}</div>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Далі
            </Button>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
              <TableRow>
                <TableHead className="min-w-[160px]">Джерело</TableHead>
                <TableHead className="min-w-[200px]">Кампанія</TableHead>
                <TableHead className="text-right">Контракти</TableHead>
                <TableHead className="text-right">Виручка</TableHead>
                <TableHead className="text-right">Перший платіж</TableHead>
                <TableHead className="min-w-[160px]">Доля виручки</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length > 0 ? (
                pageRows.map((row, i) => (
                  <TableRow key={`${row.utm_source}-${row.utm_campaign}-${i}`} className="hover:bg-muted/50 transition-colors odd:bg-white even:bg-muted/30">
                    <TableCell className="align-top">
                      <div className="flex flex-col">
                        <span
                          className="max-w-[220px] truncate font-medium text-foreground"
                          title={row.utm_source || "—"}
                        >
                          {row.utm_source || "—"}
                        </span>
                        <span className="text-xs text-muted-foreground" title={row.utm_medium || "—"}>
                          {row.utm_medium || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="max-w-[320px] truncate inline-block" title={row.utm_campaign || "—"}>
                        {row.utm_campaign || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums align-top">
                      {row.contract_count?.toLocaleString("uk-UA")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums align-top">
                      {row.total_revenue?.toLocaleString("uk-UA")} ₴
                    </TableCell>
                    <TableCell className="text-right tabular-nums align-top">
                      {row.total_first_sum?.toLocaleString("uk-UA")} ₴
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <div className="text-right tabular-nums">{row.revenueShare.toFixed(1)}%</div>
                        <div className="h-1.5 w-full rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${Math.min(100, Math.max(0, row.revenueShare))}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground italic py-8">
                    Немає даних за UTM-мітками за вибраний період.
                  </TableCell>
                </TableRow>
              )}
              {rows.length > 0 && (
                <TableRow className="bg-white font-medium">
                  <TableCell colSpan={2}>Разом</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {aggregated.totalContracts.toLocaleString("uk-UA")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {aggregated.totalRevenue.toLocaleString("uk-UA")} ₴
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {aggregated.totalFirstSum.toLocaleString("uk-UA")} ₴
                  </TableCell>
                  <TableCell className="text-right tabular-nums">100.0%</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}