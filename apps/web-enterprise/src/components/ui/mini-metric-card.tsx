interface MiniMetricCardProps {
  title: string
  subtitle?: string
  metrics: { label: string; value: string; color?: string }[]
  badge?: string
  icon?: React.ReactNode
}

export function MiniMetricCard({ title, subtitle, metrics, badge, icon }: MiniMetricCardProps) {
  return (
    <div className="rounded-[22px] border border-border/60 bg-card/40 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] space-y-2">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <span className="text-foreground">{title}</span>
        </div>
        {badge && <span className="bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 text-white text-xs px-2 py-0.5 rounded-full">{badge}</span>}
      </div>

      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}

      <div className="text-sm mt-1 space-y-0.5">
        {metrics.map((m, idx) => (
          <div key={idx} className="flex justify-between">
            <span className="text-muted-foreground">{m.label}:</span>
            <span className={m.color ? `font-semibold text-${m.color}` : "font-semibold"}>
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
