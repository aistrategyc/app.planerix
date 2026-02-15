import type { ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { WidgetRow } from "@/lib/api/analytics-widgets"
import { formatNumber } from "@/app/analytics/utils/formatters"

const formatCellValue = (value: WidgetRow[keyof WidgetRow]) => {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return formatNumber(value)
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

interface WidgetTableProps {
  rows: WidgetRow[]
  emptyLabel?: string
  onRowClick?: (row: WidgetRow) => void
  highlightKey?: string
  columnLabels?: Record<string, string>
  columnRenderers?: Record<string, (value: WidgetRow[keyof WidgetRow], row: WidgetRow) => ReactNode>
  columnsOrder?: string[]
  compact?: boolean
}

export function WidgetTable({
  rows,
  emptyLabel = "Нет данных",
  onRowClick,
  highlightKey,
  columnLabels,
  columnRenderers,
  columnsOrder,
  compact = false,
}: WidgetTableProps) {
  const columns = columnsOrder?.length
    ? columnsOrder
    : rows.length
      ? Object.keys(rows[0])
      : Object.keys(columnLabels ?? {})

  return (
    <Table wrapperClassName={compact ? "table-compact" : undefined}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{columnLabels?.[column] ?? column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {!rows.length && (
          <TableRow>
            <TableCell colSpan={columns.length || 1} className="py-6 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
        {rows.map((row, index) => {
          const highlightValue = highlightKey ? row[highlightKey] : undefined
          return (
            <TableRow
              key={`${index}-${String(highlightValue ?? "row")}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {columns.map((column) => {
                const value = row[column]
                const renderer = columnRenderers?.[column]
                return <TableCell key={column}>{renderer ? renderer(value, row) : formatCellValue(value)}</TableCell>
              })}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
