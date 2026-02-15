"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PlugZap, Mail } from "lucide-react"

import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { CompanyAPI, Company } from "@/lib/api/company"
import { IntegrationsAPI, DataSource } from "@/lib/api/integrations"
import { cn } from "@/lib/utils"

interface AnalyticsEmptyStateProps {
  title?: string
  description?: string
  context?: string
  className?: string
  size?: "sm" | "md" | "lg"
  connectLabel?: string
  requestLabel?: string
  showRequest?: boolean
  connectionGate?: boolean
  primaryAction?: {
    label: string
    onClick?: () => void
    href?: string
  }
}

export function AnalyticsEmptyState({
  title = "Пока нет данных",
  description = "Подключите источники данных, чтобы заполнить витрины и активировать AI-аналитику.",
  context = "analytics",
  className,
  size = "sm",
  connectLabel = "Подключить интеграции",
  requestLabel = "Запросить настройку данных",
  showRequest = true,
  connectionGate = false,
  primaryAction,
}: AnalyticsEmptyStateProps) {
  const router = useRouter()
  const [org, setOrg] = useState<Company | null>(null)
  const [hasConnection, setHasConnection] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    CompanyAPI.getCurrentCompany()
      .then((company) => {
        if (active) setOrg(company)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!connectionGate) {
      return
    }
    let active = true
    IntegrationsAPI.listDataSources()
      .then((sources: DataSource[]) => {
        if (!active) return
        const connected = sources.some((source) => source.status === "connected")
        setHasConnection(connected)
      })
      .catch(() => {
        if (!active) return
        setHasConnection(null)
      })
    return () => {
      active = false
    }
  }, [connectionGate])

  const orgName = org?.name || "organization"
  const integrationsHref = org?.id
    ? `/organization/${org.id}/settings#integrations`
    : "/organization"

  const handlePrimaryAction = () => {
    if (primaryAction?.onClick) {
      primaryAction.onClick()
      return
    }
    if (primaryAction?.href) {
      router.push(primaryAction.href)
      return
    }
    router.push(integrationsHref)
  }

  const handleRequest = () => {
    const subject = encodeURIComponent(`Planerix: подключение данных (${orgName})`)
    const body = encodeURIComponent(
      `Нужна помощь с подключением источников данных.\nОрганизация: ${orgName}\nКонтекст: ${context}\n`
    )
    window.location.href = `mailto:support@planerix.com?subject=${subject}&body=${body}`
  }

  if (connectionGate && hasConnection !== false) {
    return null
  }

  const sizeClass = size === "lg" ? "p-6" : size === "md" ? "p-4" : "p-3"

  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-border/60 bg-gradient-to-b from-white/80 via-white/60 to-slate-50/70 shadow-sm",
        sizeClass,
        className
      )}
    >
      <EmptyState
        icon={PlugZap}
        title={title}
        description={description}
        size={size}
        action={{
          label: primaryAction?.label ?? connectLabel,
          onClick: handlePrimaryAction,
        }}
      >
        {showRequest && (
          <div className="flex flex-col items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRequest}>
              <Mail className="w-4 h-4 mr-2" />
              {requestLabel}
            </Button>
            <p className="text-xs text-muted-foreground">
              Обычно подключение занимает 1-2 рабочих дня после доступа к кабинетам.
            </p>
          </div>
        )}
      </EmptyState>
    </div>
  )
}
