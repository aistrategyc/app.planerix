export const CHART_COLORS = {
  primary: "var(--chart-1)",
  secondary: "var(--chart-2)",
  tertiary: "var(--chart-3)",
  quaternary: "var(--chart-4)",
  quinary: "var(--chart-5)",
  muted: "hsl(var(--muted-foreground))",
  grid: "hsl(var(--border))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
}

export const chartAxisProps = {
  tickLine: false,
  axisLine: false,
  stroke: CHART_COLORS.grid,
  tick: {
    fill: CHART_COLORS.muted,
    fontSize: 12,
  },
}

export const chartGridProps = {
  strokeDasharray: "3 3",
  stroke: CHART_COLORS.grid,
}

export const chartTooltipStyle = {
  backgroundColor: CHART_COLORS.background,
  border: `1px solid ${CHART_COLORS.grid}`,
  borderRadius: "12px",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
  fontSize: "12px",
}

export const chartTooltipItemStyle = {
  color: CHART_COLORS.foreground,
}
