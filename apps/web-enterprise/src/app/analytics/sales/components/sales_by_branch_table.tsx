import { useMemo, useState } from "react"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { MetricCard } from "./metric_card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface BranchRow {
  branch_sk: number
  branch_name: string
  contract_count: number
  total_revenue: number
  total_first_sum: number
}

interface SalesByBranchTableProps {
  data: BranchRow[]
  /** Сколько строк показывать (остальные попадут в "Прочие") */
  limit?: number
}

export function SalesByBranchTable({ data, limit = 10 }: SalesByBranchTableProps) {
  const [showAll, setShowAll] = useState(false)

  const aggregated = useMemo(() => {
    const totalRevenue = data.reduce((acc, r) => acc + (r.total_revenue ?? 0), 0)
    const totalContracts = data.reduce((acc, r) => acc + (r.contract_count ?? 0), 0)
    const totalFirstSum = data.reduce((acc, r) => acc + (r.total_first_sum ?? 0), 0)
    const totalBranches = data.length
    const avgRevenuePerContract = totalContracts > 0 ? Math.round(totalRevenue / totalContracts) : 0
    const avgRevenuePerBranch = totalBranches > 0 ? Math.round(totalRevenue / totalBranches) : 0
    const conversionRate =
      totalRevenue > 0 ? ((totalFirstSum / totalRevenue) * 100).toFixed(1) : "0.0"
    return {
      totalRevenue,
      totalContracts,
      totalFirstSum,
      totalBranches,
      avgRevenuePerContract,
      avgRevenuePerBranch,
      conversionRate,
    }
  }, [data])

  const { tableRows, othersRow, shownCount } = useMemo(() => {
    const sorted = [...data].sort(
      (a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0)
    )

    if (showAll || sorted.length <= limit) {
      return { tableRows: sorted, othersRow: null as BranchRow | null, shownCount: sorted.length }
    }

    const top = sorted.slice(0, limit)
    const tail = sorted.slice(limit)

    const others: BranchRow | null =
      tail.length > 0
        ? {
            branch_sk: -1,
            branch_name: "Прочие",
            contract_count: tail.reduce((acc, r) => acc + (r.contract_count ?? 0), 0),
            total_revenue: tail.reduce((acc, r) => acc + (r.total_revenue ?? 0), 0),
            total_first_sum: tail.reduce((acc, r) => acc + (r.total_first_sum ?? 0), 0),
          }
        : null

    return { tableRows: top, othersRow: others, shownCount: top.length + (others ? 1 : 0) }
  }, [data, limit, showAll])

  const revenueShare = (value: number) =>
    aggregated.totalRevenue > 0 ? Number(((value / aggregated.totalRevenue) * 100).toFixed(1)) : 0

  return (
    <div className="space-y-4">
      {/* KPI карточки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Середня конверсія"
          value={`${aggregated.conversionRate}%`}
          subtitle="(перший платіж / виручка)"
        />
        <MetricCard
          title="Загальна виручка"
          value={`${aggregated.totalRevenue.toLocaleString("uk-UA")} ₴`}
        />
        <MetricCard
          title="Усього контрактів"
          value={`${aggregated.totalContracts.toLocaleString("uk-UA")}`}
        />
        <MetricCard
          title="Середній чек"
          value={`${aggregated.avgRevenuePerContract.toLocaleString("uk-UA")} ₴`}
          subtitle={`Виручка на філію: ${aggregated.avgRevenuePerBranch.toLocaleString("uk-UA")} ₴`}
        />
      </div>

      {/* Таблица */}
      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[520px] overflow-auto">
          <Table className="text-sm">
            <TableHeader className="sticky top-0 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-10">
              <TableRow>
                <TableHead className="w-[40%]">Філія</TableHead>
                <TableHead className="text-right">Контракти</TableHead>
                <TableHead className="text-right">Виручка</TableHead>
                <TableHead className="text-right">Перший платіж</TableHead>
                <TableHead className="text-right">Доля</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.length > 0 ? (
                tableRows.map((row) => {
                  const share = revenueShare(row.total_revenue)
                  return (
                    <TableRow key={row.branch_sk} className="hover:bg-muted/40 transition-colors even:bg-muted/20">
                      <TableCell className="pr-4">
                        <span className="truncate">{row.branch_name || "–"}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.contract_count.toLocaleString("uk-UA")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_revenue?.toLocaleString("uk-UA")} ₴
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_first_sum?.toLocaleString("uk-UA")} ₴
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-col items-end gap-1">
                          <span className="tabular-nums">{share}%</span>
                          <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full bg-blue-600")}
                              style={{ width: `${Math.min(share, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground italic py-8">
                    Немає даних за філіями за вибраний період.
                  </TableCell>
                </TableRow>
              )}

              {/* Прочие — при сокращённом списке */}
              {!showAll && othersRow && (
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">Прочие</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {othersRow.contract_count.toLocaleString("uk-UA")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {othersRow.total_revenue.toLocaleString("uk-UA")} ₴
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {othersRow.total_first_sum.toLocaleString("uk-UA")} ₴
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-col items-end gap-1">
                      <span className="tabular-nums">{revenueShare(othersRow.total_revenue)}%</span>
                      <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${Math.min(revenueShare(othersRow.total_revenue), 100)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {/* Итого */}
              {tableRows.length > 0 && (
                <TableRow className="font-medium border-t">
                  <TableCell>Всього</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {aggregated.totalContracts.toLocaleString("uk-UA")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {aggregated.totalRevenue.toLocaleString("uk-UA")} ₴
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {aggregated.totalFirstSum.toLocaleString("uk-UA")} ₴
                  </TableCell>
                  <TableCell className="text-right tabular-nums">100%</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Панель под таблицей */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
          <div className="text-xs text-muted-foreground">
            Показано:{" "}
            <span className="font-medium">{shownCount}</span> із{" "}
            <span className="font-medium">{data.length}</span> філій
          </div>
          {data.length > limit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll((v) => !v)}
              className="gap-2"
            >
              {showAll ? (
                <>
                  Згорнути <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Показати всі <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}