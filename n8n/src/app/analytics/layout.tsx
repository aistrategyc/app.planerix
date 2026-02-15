"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, BarChart3, FileText, Palette, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/layout/PageHeader"

interface AnalyticsLayoutProps {
  children: React.ReactNode
}

export default function AnalyticsLayout({ children }: AnalyticsLayoutProps) {
  const pathname = usePathname()

  const navigation = [
    {
      name: "CRM & Client",
      href: "/analytics/crm",
      icon: Activity,
      description: "CRM аналитика, ліди та воронка",
    },
    {
      name: "Ads",
      href: "/analytics/ads",
      icon: BarChart3,
      description: "Meta + Google Ads за метриками",
    },
    {
      name: "Marketing",
      href: "/analytics/campaigns-sources",
      icon: TrendingUp,
      description: "Канали, кампанії, дохід",
    },
    {
      name: "Contracts",
      href: "/analytics/contracts",
      icon: FileText,
      description: "Контракти та атрибуція",
    },
    {
      name: "Creatives",
      href: "/analytics/creatives",
      icon: Palette,
      description: "Типи креативів та ефективність",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Аналитика"
        description="Консолидированные витрины и AI инсайты по ключевым направлениям."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {navigation.map((item) => {
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

      <div className="pb-12">
        {children}
      </div>
    </div>
  )
}
