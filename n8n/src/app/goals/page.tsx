"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { OKRsAPI, OKR } from "@/lib/api/okr"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PageHeader } from "@/components/layout/PageHeader"
import { Plus, Search, Filter, Target, Calendar, AlertCircle } from "lucide-react"

interface Goal {
  id: string
  title: string
  description?: string
  status: string
  progress: number
  timeframe: string
  target_date?: string
  created_at: string
}

const formatTimeframe = (startDate?: string | null, dueDate?: string | null): string => {
  if (!startDate || !dueDate) return "Custom"
  const start = new Date(startDate)
  const end = new Date(dueDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Custom"
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  if (diffDays <= 31) return "Monthly"
  if (diffDays <= 92) return "Quarterly"
  if (diffDays <= 366) return "Yearly"
  return "Custom"
}

const calcProgress = (okr: OKR): number => {
  if (okr.overall_progress !== undefined && okr.overall_progress !== null) {
    return Math.max(0, Math.min(100, Math.round(okr.overall_progress)))
  }
  if (!okr.key_results || okr.key_results.length === 0) return 0
  const total = okr.key_results.reduce((sum, kr) => {
    const target = kr.target_value || 0
    const current = kr.current_value || 0
    if (target <= 0) return sum
    return sum + Math.min(1, current / target)
  }, 0)
  return Math.round((total / okr.key_results.length) * 100)
}

const normalizeGoals = (items: OKR[]): Goal[] => items.map((okr) => ({
  id: okr.id,
  title: okr.title,
  description: okr.description,
  status: okr.status || "draft",
  progress: calcProgress(okr),
  timeframe: formatTimeframe(okr.start_date, okr.due_date),
  target_date: okr.due_date || undefined,
  created_at: okr.created_at,
}))

export default function GoalsPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [snapshotInfo, setSnapshotInfo] = useState<Record<string, { latestAt?: string; avgProgress?: number }>>({})
  const [refreshingSnapshots, setRefreshingSnapshots] = useState(false)

  useEffect(() => {
    let isActive = true

    const loadGoals = async () => {
      try {
        setLoading(true)
        const items = await OKRsAPI.list()
        if (isActive) {
          setGoals(normalizeGoals(items))
          setError(null)
        }
        if (isActive) {
          const snapshotEntries = await Promise.all(
            items.map(async (okr) => {
              try {
                const snapshots = await OKRsAPI.listObjectiveSnapshots(okr.id, { latest_only: true, page_size: 50 })
                if (!snapshots.length) return [okr.id, {}] as const
                const latestAt = snapshots.reduce((max, snap) => {
                  if (!max) return snap.snapshot_at
                  return new Date(snap.snapshot_at) > new Date(max) ? snap.snapshot_at : max
                }, "" as string)
                const avgProgress = snapshots.reduce((sum, snap) => sum + (snap.progress_percentage || 0), 0) / snapshots.length
                return [okr.id, { latestAt, avgProgress }] as const
              } catch {
                return [okr.id, {}] as const
              }
            })
          )
          setSnapshotInfo(Object.fromEntries(snapshotEntries))
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : "Failed to fetch goals")
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    loadGoals()

    return () => {
      isActive = false
    }
  }, [])

  const handleRefreshSnapshots = async () => {
    setRefreshingSnapshots(true)
    try {
      await OKRsAPI.refreshSnapshots({ min_interval_hours: 1 })
      const items = await OKRsAPI.list()
      setGoals(normalizeGoals(items))
      const snapshotEntries = await Promise.all(
        items.map(async (okr) => {
          try {
            const snapshots = await OKRsAPI.listObjectiveSnapshots(okr.id, { latest_only: true, page_size: 50 })
            if (!snapshots.length) return [okr.id, {}] as const
            const latestAt = snapshots.reduce((max, snap) => {
              if (!max) return snap.snapshot_at
              return new Date(snap.snapshot_at) > new Date(max) ? snap.snapshot_at : max
            }, "" as string)
            const avgProgress = snapshots.reduce((sum, snap) => sum + (snap.progress_percentage || 0), 0) / snapshots.length
            return [okr.id, { latestAt, avgProgress }] as const
          } catch {
            return [okr.id, {}] as const
          }
        })
      )
      setSnapshotInfo(Object.fromEntries(snapshotEntries))
    } finally {
      setRefreshingSnapshots(false)
    }
  }

  const filteredGoals = goals.filter((goal) => {
    const matchesSearch = goal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      goal.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || goal.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-emerald-100/70 text-emerald-800"
      case "completed":
        return "bg-primary/10 text-primary"
      case "archived":
        return "bg-amber-100/70 text-amber-800"
      case "draft":
        return "bg-muted/60 text-muted-foreground"
      default:
        return "bg-muted/60 text-muted-foreground"
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading goals...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Goals & OKRs"
        description="Track your objectives and key results"
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefreshSnapshots} disabled={refreshingSnapshots}>
              {refreshingSnapshots ? "Updating..." : "Refresh snapshots"}
            </Button>
            <Button onClick={() => router.push("/goals/new")}>
              <Plus className="mr-2 h-4 w-4" />
              New Goal
            </Button>
          </div>
        )}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search goals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredGoals.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No goals found</h3>
            <p className="text-muted-foreground text-center mb-6">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Get started by creating your first goal"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button onClick={() => router.push('/goals/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Goal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredGoals.map((goal) => (
            <Card key={goal.id} className="glass-card hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">{goal.title}</CardTitle>
                  <Badge className={getStatusColor(goal.status)}>{goal.status}</Badge>
                </div>
                {goal.description && (
                  <CardDescription className="line-clamp-2">
                    {goal.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="mr-1 h-3 w-3" />
                    {goal.timeframe}
                  </div>
                  {goal.target_date && (
                    <div className="text-muted-foreground">
                      Due {new Date(goal.target_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {snapshotInfo[goal.id]?.latestAt && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Snapshot</span>
                    <span>
                      {new Date(snapshotInfo[goal.id].latestAt as string).toLocaleDateString()}
                      {typeof snapshotInfo[goal.id]?.avgProgress === "number" && (
                        <span className="ml-2 text-foreground">
                          {Math.round(snapshotInfo[goal.id].avgProgress as number)}%
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {goals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Goals</p>
                  <p className="text-2xl font-bold">{goals.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-4 w-4 rounded-full bg-emerald-500" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">
                    {goals.filter(g => g.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-4 w-4 rounded-full bg-primary" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">
                    {goals.filter(g => g.status === 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-4 w-4 rounded-full bg-amber-400" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">Avg Progress</p>
                  <p className="text-2xl font-bold">
                    {Math.round(goals.reduce((acc, g) => acc + g.progress, 0) / goals.length)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
