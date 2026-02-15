"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, BarChart3, Layers, LineChart, PieChart, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/layout/PageHeader"

interface AttributionLayoutProps {
  children: React.ReactNode
}

const NAV_ITEMS = [
  {
    name: "Overview",
    href: "/attribution/overview",
    icon: PieChart,
    description: "KPI, тренды и микс каналов",
  },
  {
    name: "Content",
    href: "/attribution/content",
    icon: Layers,
    description: "Контент и посадочные страницы",
  },
  {
    name: "Interactions",
    href: "/attribution/interactions",
    icon: LineChart,
    description: "События и вовлеченность",
  },
  {
    name: "Ads",
    href: "/attribution/ads",
    icon: BarChart3,
    description: "Кампании и креативы",
  },
  {
    name: "Revenue",
    href: "/attribution/revenue",
    icon: Target,
    description: "Атрибуция и выручка",
  },
  {
    name: "CRM Funnel & SLA",
    href: "/attribution/crm-funnel-sla",
    icon: Activity,
    description: "Качество лидов и SLA",
  },
]

export default function AttributionLayout({ children }: AttributionLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attribution"
        description="Единый модуль для связки рекламных расходов и результата бизнеса."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group relative rounded-2xl border p-3 transition-all",
                isActive
                  ? "border-primary/30 bg-primary/10 shadow-sm"
                  : "border-border bg-card/80 hover:border-primary/20 hover:bg-card"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border",
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted/60 text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className={cn("text-sm font-semibold truncate", isActive ? "text-primary" : "text-foreground")}>
                    {item.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="pb-12">{children}</div>
    </div>
  )
}
