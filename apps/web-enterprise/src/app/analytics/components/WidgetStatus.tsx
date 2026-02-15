"use client"

import { AlertTriangle, Database } from "lucide-react"
import { cn } from "@/lib/utils"

interface WidgetStatusProps {
  title: string
  description: string
  tone?: "warning" | "muted"
  className?: string
}

export function WidgetStatus({ title, description, tone = "muted", className }: WidgetStatusProps) {
  const Icon = tone === "warning" ? AlertTriangle : Database
  const toneClass = tone === "warning" ? "text-amber-600" : "text-muted-foreground"

  return (
    <div className={cn("rounded-lg border border-dashed bg-muted/30 p-3", className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4", toneClass)} />
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
    </div>
  )
}
