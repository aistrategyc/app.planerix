import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { WidgetRow } from "@/lib/api/analytics-widgets"

const formatCellValue = (value: WidgetRow[keyof WidgetRow]) => {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return new Intl.NumberFormat("ru-RU").format(value)
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

interface WidgetTableProps {
  rows: WidgetRow[]
  emptyLabel?: string
  onRowClick?: (row: WidgetRow) => void
  highlightKey?: string
}

export function WidgetTable({ rows, emptyLabel = "Нет данных", onRowClick, highlightKey }: WidgetTableProps) {
  if (!rows.length) {
    return <div className="text-sm text-muted-foreground py-6">{emptyLabel}</div>
  }

  const columns = Object.keys(rows[0])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const highlightValue = highlightKey ? row[highlightKey] : undefined
          return (
            <TableRow
              key={`${index}-${String(highlightValue ?? "row")}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {columns.map((column) => (
                <TableCell key={column}>{formatCellValue(row[column])}</TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
