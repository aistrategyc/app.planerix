"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import AIChat from "@/components/ai/AIChat"
import { AgentSummary, fetchAgentRegistry, fetchInsights, InsightRow } from "@/lib/api/analytics-widgets"
import { acceptAIActionRequest, fetchAIActionRequests, rejectAIActionRequest, AIActionRequest } from "@/lib/api/ai"
import { AlertTriangle, Clock, Database, Megaphone, RefreshCw, Radar, Sparkles, Target, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

type AgentDefinition = {
  key: string
  title: string
  description: string
  icon: React.ReactNode
  tags: string[]
}

const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    key: "budget_pacing",
    title: "Budget & Pacing",
    description: "Контроль расхода бюджета и рисков по платным каналам.",
    icon: <TrendingUp className="h-5 w-5" />,
    tags: ["Budget", "Performance"],
  },
  {
    key: "creative_fatigue_ops",
    title: "Creative Fatigue & Ops",
    description: "Сигналы выгорания креативов и рекомендации по ротации.",
    icon: <Radar className="h-5 w-5" />,
    tags: ["Creatives", "Ops"],
  },
  {
    key: "crm_funnel_sla",
    title: "CRM Funnel & SLA",
    description: "Скорость обработки лидов и узкие места воронки.",
    icon: <Clock className="h-5 w-5" />,
    tags: ["CRM", "SLA"],
  },
  {
    key: "data_freshness_quality",
    title: "Data Freshness & Quality",
    description: "Контроль свежести данных и качество витрин.",
    icon: <Database className="h-5 w-5" />,
    tags: ["Quality"],
  },
  {
    key: "meta_spend_without_leads",
    title: "Meta Spend without Leads",
    description: "Алерты по тратам Meta без лидов/контрактов.",
    icon: <Megaphone className="h-5 w-5" />,
    tags: ["Meta", "Alerts"],
  },
  {
    key: "daily_exec_brief",
    title: "Daily Executive Brief",
    description: "Сводка ключевых сигналов за день.",
    icon: <Target className="h-5 w-5" />,
    tags: ["Summary"],
  },
  {
    key: "data_freshness",
    title: "Data Freshness",
    description: "Сигналы свежести ключевых таблиц.",
    icon: <AlertTriangle className="h-5 w-5" />,
    tags: ["Freshness"],
  },
]

const getSeverityClass = (severity?: string | null) => {
  switch (severity) {
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/30"
    case "warning":
      return "bg-amber-100/70 text-amber-800 border-amber-200/80"
    default:
      return "bg-emerald-100/70 text-emerald-800 border-emerald-200/80"
  }
}

const getSeverityLabel = (severity?: string | null) => {
  if (severity === "critical") return "Critical"
  if (severity === "warning") return "Warning"
  return "Info"
}

const getRecordFieldString = (record: unknown, key: string): string | null => {
  if (!record || typeof record !== "object") return null
  const value = (record as Record<string, unknown>)[key]
  if (value === null || value === undefined) return null
  return typeof value === "string" ? value : String(value)
}

function AIHomePageContentContent() {
  const [agentSummary, setAgentSummary] = useState<AgentSummary[]>([])
  const [activeAgentKey, setActiveAgentKey] = useState<string | null>(null)
  const [aiInsights, setAiInsights] = useState<InsightRow[]>([])
  const [actionRequests, setActionRequests] = useState<AIActionRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [isLoadingActions, setIsLoadingActions] = useState(false)

  const agents = useMemo(() => {
    const known = new Map(AGENT_DEFINITIONS.map((agent) => [agent.key, agent]))
    return agentSummary.map((summary) => ({
      summary,
      definition: known.get(summary.agent_key),
    }))
  }, [agentSummary])

  const activeAgent = useMemo(() => {
    if (!activeAgentKey) return null
    return agents.find((agent) => agent.summary.agent_key === activeAgentKey) ?? null
  }, [activeAgentKey, agents])

  const totalCritical = useMemo(
    () => agentSummary.reduce((sum, row) => sum + (row.critical_cnt || 0), 0),
    [agentSummary]
  )
  const totalWarning = useMemo(
    () => agentSummary.reduce((sum, row) => sum + (row.warning_cnt || 0), 0),
    [agentSummary]
  )
  const totalInfo = useMemo(
    () => agentSummary.reduce((sum, row) => sum + (row.info_cnt || 0), 0),
    [agentSummary]
  )
  const latestRun = useMemo(() => {
    const dates = agentSummary
      .map((row) => row.last_as_of_date)
      .filter(Boolean)
      .map((value) => new Date(value as string))
    if (!dates.length) return null
    return new Date(Math.max(...dates.map((date) => date.getTime())))
  }, [agentSummary])

  const refreshAgents = useCallback(async () => {
    setIsLoadingAgents(true)
    try {
      const data = await fetchAgentRegistry()
      const sorted = [...data].sort((a, b) => (b.critical_cnt || 0) - (a.critical_cnt || 0))
      setAgentSummary(sorted)
      if (!activeAgentKey && sorted.length) {
        setActiveAgentKey(sorted[0].agent_key)
      }
    } finally {
      setIsLoadingAgents(false)
    }
  }, [activeAgentKey])

  useEffect(() => {
    refreshAgents()
  }, [refreshAgents])

  const refreshActionRequests = useCallback(async () => {
    setIsLoadingActions(true)
    try {
      const data = await fetchAIActionRequests()
      setActionRequests(data.items)
    } finally {
      setIsLoadingActions(false)
    }
  }, [])

  useEffect(() => {
    refreshActionRequests()
  }, [refreshActionRequests])

  useEffect(() => {
    if (!activeAgentKey) return
    let isMounted = true
    const loadInsights = async () => {
      setLoading(true)
      try {
        const data = await fetchInsights(activeAgentKey, 20, activeAgentKey)
        if (isMounted) setAiInsights(data.items)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadInsights()
    return () => {
      isMounted = false
    }
  }, [activeAgentKey])

  const handleActionDecision = async (id: number, decision: "accept" | "reject") => {
    if (decision === "accept") {
      await acceptAIActionRequest(id)
    } else {
      await rejectAIActionRequest(id)
    }
    await refreshActionRequests()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Центр аналитики"
        description="Канонические агенты и чат с памятью по данным клиента. Используем виджеты SEM и AI-инсайты."
        actions={(
          <Button variant="outline" className="gap-2" onClick={refreshAgents}>
            <RefreshCw className="h-4 w-4" />
            Обновить
          </Button>
        )}
      />

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Последний прогон</div>
            <div className="text-lg font-semibold">
              {latestRun ? latestRun.toLocaleDateString() : "Нет данных"}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Критические сигналы</div>
            <div className="text-lg font-semibold text-red-600">{totalCritical}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Warning / Info</div>
            <div className="text-lg font-semibold">
              {totalWarning} / {totalInfo}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
        <div className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>AI агенты</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {isLoadingAgents && (
                <div className="text-sm text-muted-foreground">Загружаем список агентов…</div>
              )}
              {!isLoadingAgents && agents.length === 0 && (
                <div className="text-sm text-muted-foreground">Нет данных по агентам.</div>
              )}
              {agents.map(({ summary, definition }) => {
                const isActive = summary.agent_key === activeAgentKey
                const title = definition?.title ?? summary.agent_key
                const description = definition?.description ?? "Агент без описания."
                const icon = definition?.icon ?? <Sparkles className="h-5 w-5" />
                const tags = definition?.tags ?? ["Agent"]
                return (
                  <button
                    key={summary.agent_key}
                    onClick={() => setActiveAgentKey(summary.agent_key)}
                    className={`text-left border rounded-2xl p-4 transition ${
                      isActive ? "border-primary/40 bg-primary/10" : "border-border/60 bg-card/40 hover:border-primary/20 hover:bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {icon}
                        {title}
                      </div>
                      <Badge className={getSeverityClass(summary.critical_cnt ? "critical" : summary.warning_cnt ? "warning" : "info")}>
                        {summary.critical_cnt ? "Critical" : summary.warning_cnt ? "Warning" : "Info"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3 text-[11px] text-muted-foreground">
                      last run: {summary.last_as_of_date ?? "—"} · runs: {summary.runs}
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>AI инсайты: {activeAgent?.definition?.title ?? activeAgentKey ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Загружаем инсайты…</div>
              ) : (
                <div className="space-y-3">
                  {aiInsights.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Нет AI инсайтов.</div>
                  ) : (
                    aiInsights.map((insight) => (
                      <div key={String(insight.id)} className="border rounded-2xl p-4 bg-card/40 border-border/60">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold">{String(insight.title ?? "Без названия")}</div>
                          <Badge className={getSeverityClass(String(insight.severity))}>
                            {getSeverityLabel(String(insight.severity))}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            const city =
                              getRecordFieldString(insight.metrics_json, "city_name") ??
                              getRecordFieldString(insight.evidence_ref, "city_name")
                            return city ? `Місто: ${city}` : "Місто: —"
                          })()}{" "}
                          · {insight.valid_from ? String(insight.valid_from) : "дата неизвестна"}
                        </div>
                        <p className="text-sm mt-2 text-muted-foreground">
                          {String(insight.summary ?? "Нет описания.")}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>AI авто‑задачи (pending)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingActions && <div className="text-sm text-muted-foreground">Загрузка задач…</div>}
              {!isLoadingActions && actionRequests.length === 0 && (
                <div className="text-sm text-muted-foreground">Нет задач, требующих подтверждения.</div>
              )}
              {actionRequests.map((item) => (
                <div key={item.id} className="border rounded-2xl p-4 bg-card/40 border-border/60">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{item.title ?? "Запрос действия"}</div>
                    <Badge className={getSeverityClass(item.severity)}>{getSeverityLabel(item.severity)}</Badge>
                  </div>
                  {item.description ? (
                    <p className="text-xs text-muted-foreground mt-2">{item.description}</p>
                  ) : null}
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" onClick={() => handleActionDecision(item.id, "accept")}>
                      Принять
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleActionDecision(item.id, "reject")}>
                      Отклонить
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit glass-card">
          <CardHeader>
            <CardTitle>AI чат</CardTitle>
          </CardHeader>
          <CardContent>
            <AIChat />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AIHomePageContent() {
  return (
    <ProtectedRoute requireAuth={true}>
      <AIHomePageContentContent />
    </ProtectedRoute>
  )
}
