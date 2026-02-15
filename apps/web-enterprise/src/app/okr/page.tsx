"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { useOkrs } from "./hooks/useOkrs"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"

import { Plus, Target, AlertCircle, Calendar, BarChart3, Search, Edit3, Trash2, Award, Zap, Clock } from "lucide-react"

import { OKRsAPI, type OKR, type OKRCreate, type KeyResult, type KeyResultCreate, type KeyResultUpdate, type ObjectiveVisibility, type KeyResultDirection, type KeyResultProgressRule } from "@/lib/api/okr"
import { MetricsAPI, type MetricDefinition } from "@/lib/api/metrics"


export default function OKRPage() {
  return (
    <ProtectedRoute>
      <OKRPageContent />
    </ProtectedRoute>
  )
}

function OKRPageContent() {
  const { toast } = useToast()
  const { okrs, loading, error, loadOkrs, createOkr, updateOkr, deleteOkr } = useOkrs()

  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedObjective, setSelectedObjective] = useState<OKR | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null)
  const [showKeyResultDialog, setShowKeyResultDialog] = useState(false)
  const [editingKeyResult, setEditingKeyResult] = useState<KeyResult | null>(null)
  const [keyResultSubmitting, setKeyResultSubmitting] = useState(false)
  const hasActiveFilters = Boolean(searchQuery) || filterStatus !== "all"
  const [objectives, setObjectives] = useState<OKR[]>([])

  const [newObjective, setNewObjective] = useState<Partial<OKRCreate>>({
    title: "",
    description: "",
    status: "draft",
    start_date: "",
    due_date: "",
    visibility: "internal",
    scope_type: "",
    scope_ref: ""
  })
  const [objectiveTagsInput, setObjectiveTagsInput] = useState("")

  const [newKeyResult, setNewKeyResult] = useState<KeyResultCreate>({
    description: "",
    start_value: 0,
    target_value: 1,
    current_value: 0,
    unit: "",
    metric_key: "",
    direction: "increase",
    progress_rule: "linear"
  })
  const [filtersJsonInput, setFiltersJsonInput] = useState("")
  const [dataQualityInput, setDataQualityInput] = useState("")
  const [metricDefinitions, setMetricDefinitions] = useState<MetricDefinition[]>([])
  const [metricSearch, setMetricSearch] = useState("")
  const [metricLoading, setMetricLoading] = useState(false)

  // Load OKRs on component mount
  useEffect(() => {
    loadOkrs()
  }, [loadOkrs])

  useEffect(() => {
    let active = true
    const loadMetrics = async () => {
      if (!showKeyResultDialog || metricDefinitions.length > 0) return
      setMetricLoading(true)
      try {
        const items = await MetricsAPI.listDefinitions({ page: 1, page_size: 200 })
        if (active) setMetricDefinitions(items)
      } catch (err) {
        console.error("Failed to load metric definitions:", err)
      } finally {
        if (active) setMetricLoading(false)
      }
    }
    loadMetrics()
    return () => {
      active = false
    }
  }, [showKeyResultDialog, metricDefinitions.length])

  // Update local state when okrs change
  useEffect(() => {
    setObjectives(okrs)
    if (selectedObjective) {
      const updated = okrs.find((obj) => obj.id === selectedObjective.id) || null
      setSelectedObjective(updated)
    }
  }, [okrs, selectedObjective])

  const filteredObjectives = useMemo(() => {
    return objectives.filter(obj => {
      const matchesSearch = obj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          obj.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = filterStatus === "all" || obj.status === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [objectives, searchQuery, filterStatus])

  const filteredMetricDefinitions = useMemo(() => {
    const query = metricSearch.trim().toLowerCase()
    if (!query) return metricDefinitions
    return metricDefinitions.filter((metric) => {
      const name = metric.name.toLowerCase()
      const description = metric.description?.toLowerCase() || ""
      return name.includes(query) || description.includes(query)
    })
  }, [metricDefinitions, metricSearch])

  const getStatusColor = (status: OKR['status']) => {
    switch (status) {
      case 'draft': return 'bg-slate-100 text-slate-800'
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-slate-100 text-slate-600'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const getKRStatusColor = (progress?: number) => {
    if (progress === undefined || progress === null) return 'bg-slate-100 text-slate-800'
    if (progress >= 100) return 'bg-blue-100 text-blue-800'
    if (progress >= 70) return 'bg-green-100 text-green-800'
    if (progress >= 40) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getObjectiveProgress = (objective: OKR) => {
    if (typeof objective.overall_progress === "number") return Math.round(objective.overall_progress)
    if (!objective.key_results?.length) return 0
    const total = objective.key_results.reduce((sum, kr) => sum + (kr.progress_percentage ?? 0), 0)
    return Math.round(total / objective.key_results.length)
  }

  const formatDate = (value?: string | null) => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleDateString()
  }

  const handleSaveObjective = useCallback(async () => {
    if (!newObjective.title?.trim()) {
      toast({ title: "Error", description: "Objective title is required", variant: "destructive" })
      return
    }

    const tags = objectiveTagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)

    const createData: OKRCreate = {
      title: newObjective.title.trim(),
      description: newObjective.description?.trim() || undefined,
      status: newObjective.status,
      start_date: newObjective.start_date || undefined,
      due_date: newObjective.due_date || undefined,
      visibility: (newObjective.visibility as ObjectiveVisibility) || "internal",
      tags: tags.length ? tags : undefined,
      scope_type: newObjective.scope_type?.trim() || undefined,
      scope_ref: newObjective.scope_ref?.trim() || undefined
    }

    const success = editingObjectiveId
      ? await updateOkr(editingObjectiveId, createData)
      : await createOkr(createData)

    if (success) {
      setNewObjective({
        title: "",
        description: "",
        status: "draft",
        start_date: "",
        due_date: "",
        visibility: "internal",
        scope_type: "",
        scope_ref: ""
      })
      setObjectiveTagsInput("")
      setEditingObjectiveId(null)
      setShowCreateDialog(false)
      toast({
        title: "Success",
        description: editingObjectiveId ? "Objective updated successfully" : "Objective created successfully",
      })
    } else {
      toast({ title: "Error", description: error || "Failed to create objective", variant: "destructive" })
    }
  }, [newObjective, objectiveTagsInput, createOkr, updateOkr, editingObjectiveId, error, toast])

  const handleEditObjective = useCallback((objective: OKR) => {
    setEditingObjectiveId(objective.id)
    setNewObjective({
      title: objective.title,
      description: objective.description ?? "",
      status: objective.status,
      start_date: objective.start_date ?? "",
      due_date: objective.due_date ?? "",
      visibility: objective.visibility ?? "internal",
      scope_type: objective.scope_type ?? "",
      scope_ref: objective.scope_ref ?? "",
    })
    setObjectiveTagsInput((objective.tags || []).join(", "))
    setShowCreateDialog(true)
  }, [])

  const handleDeleteObjective = useCallback(async (objective: OKR) => {
    if (!confirm(`Delete objective "${objective.title}"?`)) return
    const ok = await deleteOkr(objective.id)
    if (ok) {
      setShowDetailDialog(false)
      setSelectedObjective(null)
      loadOkrs()
    }
  }, [deleteOkr, loadOkrs])

  const openCreateKeyResult = useCallback(() => {
    setEditingKeyResult(null)
    setNewKeyResult({
      description: "",
      start_value: 0,
      target_value: 1,
      current_value: 0,
      unit: "",
      metric_key: "",
      direction: "increase",
      progress_rule: "linear"
    })
    setFiltersJsonInput("")
    setDataQualityInput("")
    setMetricSearch("")
    setShowKeyResultDialog(true)
  }, [])

  const openEditKeyResult = useCallback((kr: KeyResult) => {
    setEditingKeyResult(kr)
    setNewKeyResult({
      description: kr.description,
      start_value: kr.start_value,
      target_value: kr.target_value,
      current_value: kr.current_value,
      unit: kr.unit ?? "",
      metric_key: kr.metric_key ?? "",
      metric_def_id: kr.metric_def_id ?? undefined,
      direction: (kr.direction ?? "increase") as KeyResultDirection,
      progress_rule: (kr.progress_rule ?? "linear") as KeyResultProgressRule
    })
    setFiltersJsonInput(kr.filters_json ? JSON.stringify(kr.filters_json, null, 2) : "")
    setDataQualityInput(kr.data_quality_requirements ? JSON.stringify(kr.data_quality_requirements, null, 2) : "")
    setMetricSearch("")
    setShowKeyResultDialog(true)
  }, [])

  const handleSaveKeyResult = useCallback(async () => {
    if (!selectedObjective) return
    if (!newKeyResult.description.trim()) {
      toast({ title: "Error", description: "Key result description is required", variant: "destructive" })
      return
    }
    if (!newKeyResult.target_value || newKeyResult.target_value <= 0) {
      toast({ title: "Error", description: "Target value must be greater than 0", variant: "destructive" })
      return
    }
    const parseJsonField = (raw: string, label: string) => {
      if (!raw.trim()) return undefined
      try {
        return JSON.parse(raw)
      } catch {
        toast({ title: "Invalid JSON", description: `${label} must be valid JSON`, variant: "destructive" })
        return null
      }
    }

    const filtersJson = parseJsonField(filtersJsonInput, "Filters JSON")
    if (filtersJson === null) return
    const dataQuality = parseJsonField(dataQualityInput, "Data quality JSON")
    if (dataQuality === null) return

    setKeyResultSubmitting(true)
    try {
      if (editingKeyResult) {
        const payload: KeyResultUpdate = {
          description: newKeyResult.description,
          start_value: newKeyResult.start_value,
          target_value: newKeyResult.target_value,
          current_value: newKeyResult.current_value,
          unit: newKeyResult.unit || undefined,
          metric_key: newKeyResult.metric_key?.trim() || undefined,
          metric_def_id: newKeyResult.metric_def_id || undefined,
          direction: newKeyResult.direction,
          progress_rule: newKeyResult.progress_rule,
          filters_json: filtersJson,
          data_quality_requirements: dataQuality,
        }
        await OKRsAPI.updateKeyResult(editingKeyResult.id, payload)
      } else {
        await OKRsAPI.createKeyResult(selectedObjective.id, {
          ...newKeyResult,
          unit: newKeyResult.unit || undefined,
          metric_key: newKeyResult.metric_key?.trim() || undefined,
          metric_def_id: newKeyResult.metric_def_id || undefined,
          direction: newKeyResult.direction,
          progress_rule: newKeyResult.progress_rule,
          filters_json: filtersJson,
          data_quality_requirements: dataQuality,
        })
      }
      await loadOkrs()
      setShowKeyResultDialog(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save key result"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setKeyResultSubmitting(false)
    }
  }, [selectedObjective, newKeyResult, editingKeyResult, loadOkrs, toast, filtersJsonInput, dataQualityInput])

  const handleDeleteKeyResult = useCallback(async (kr: KeyResult) => {
    if (!confirm(`Delete key result "${kr.description}"?`)) return
    try {
      await OKRsAPI.deleteKeyResult(kr.id)
      await loadOkrs()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete key result"
      toast({ title: "Error", description: msg, variant: "destructive" })
    }
  }, [loadOkrs, toast])

  const stats = useMemo(() => {
    const total = objectives.length
    const active = objectives.filter(obj => obj.status === 'active').length
    const completed = objectives.filter(obj => obj.status === 'completed').length
    const archived = objectives.filter(obj => obj.status === 'archived').length
    const avgProgress = total > 0 ? objectives.reduce((sum, obj) => sum + getObjectiveProgress(obj), 0) / total : 0

    return { total, active, completed, archived, avgProgress }
  }, [objectives])

  // Show loading state
  if (loading && objectives.length === 0) {
    return (
    <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading OKRs...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">OKRs</h1>
            <Badge variant="outline" className="ml-2">
              Objectives & Key Results
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Align strategic goals with measurable outcomes and owners.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search objectives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-64"
            />
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Dialog
            open={showCreateDialog}
            onOpenChange={(open) => {
              setShowCreateDialog(open)
              if (!open) {
                setEditingObjectiveId(null)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Objective
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingObjectiveId ? "Edit Objective" : "Create New Objective"}</DialogTitle>
                <DialogDescription>Define a new strategic objective and timeline. You can add key results after creating the objective.</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Objective Title *</Label>
                  <Input
                    id="title"
                    value={newObjective.title}
                    onChange={(e) => setNewObjective({ ...newObjective, title: e.target.value })}
                    placeholder="e.g., Increase customer satisfaction by 20%"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newObjective.description}
                    onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
                    placeholder="Brief description of the objective..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newObjective.status}
                      onValueChange={(value) =>
                        setNewObjective({ ...newObjective, status: value as OKRCreate["status"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="visibility">Visibility</Label>
                    <Select
                      value={(newObjective.visibility as ObjectiveVisibility) || "internal"}
                      onValueChange={(value) =>
                        setNewObjective({
                          ...newObjective,
                          visibility: value as ObjectiveVisibility,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="internal">Internal</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    value={objectiveTagsInput}
                    onChange={(e) => setObjectiveTagsInput(e.target.value)}
                    placeholder="growth, retention, sales"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="scopeType">Scope Type</Label>
                    <Input
                      id="scopeType"
                      value={newObjective.scope_type || ""}
                      onChange={(e) => setNewObjective({ ...newObjective, scope_type: e.target.value })}
                      placeholder="org, team, city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="scopeRef">Scope Ref</Label>
                    <Input
                      id="scopeRef"
                      value={newObjective.scope_ref || ""}
                      onChange={(e) => setNewObjective({ ...newObjective, scope_ref: e.target.value })}
                      placeholder="Dept ID or city"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newObjective.start_date || ""}
                      onChange={(e) => setNewObjective({ ...newObjective, start_date: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={newObjective.due_date || ""}
                      onChange={(e) => setNewObjective({ ...newObjective, due_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveObjective} disabled={loading}>
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    editingObjectiveId ? "Save Objective" : "Create Objective"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total OKRs</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <div>
                <p className="text-sm text-muted-foreground">Archived</p>
                <p className="text-2xl font-bold">{stats.archived}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Progress</p>
                <p className="text-2xl font-bold">{Math.round(stats.avgProgress)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Objectives Grid */}
      <div className="grid gap-4">
        {filteredObjectives.map((objective) => (
          <Card 
            key={objective.id}
            className="cursor-pointer hover:shadow-md transition-shadow border-border/60 bg-card/40"
            onClick={() => {
              setSelectedObjective(objective)
              setShowDetailDialog(true)
            }}
          >
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold truncate">{objective.title}</h3>
                      <Badge className={getStatusColor(objective.status)} variant="outline">
                        {objective.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    {objective.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {objective.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right min-w-0 ml-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {getObjectiveProgress(objective)}%
                    </div>
                    <Progress value={getObjectiveProgress(objective)} className="w-20" />
                  </div>
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {objective.start_date || objective.due_date ? (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(objective.start_date)} — {formatDate(objective.due_date)}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      No dates
                    </div>
                  )}
                </div>

                {/* Key Results Summary */}
                {objective.key_results && objective.key_results.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Key Results</h4>
                      <Badge variant="outline" className="text-xs">
                        {objective.key_results.length} KRs
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {objective.key_results.slice(0, 2).map((kr: KeyResult) => (
                        <div key={kr.id} className="flex items-center justify-between text-sm">
                          <span className="flex-1 truncate">{kr.description}</span>
                          <div className="flex items-center gap-2">
                            <Badge className={getKRStatusColor(kr.progress_percentage)} variant="outline">
                              {Math.round(kr.progress_percentage ?? 0)}%
                            </Badge>
                            <span className="text-xs text-muted-foreground min-w-0">
                              {Math.round(kr.progress_percentage ?? 0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                      {objective.key_results.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{objective.key_results.length - 2} more key results
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredObjectives.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              {hasActiveFilters ? (
                <>
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No objectives found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your filters or search terms to find what you&apos;re looking for.
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Objective
                  </Button>
                </>
              ) : (
                <AnalyticsEmptyState
                  context="okr"
                  title="Пока нет OKR"
                  description="Создайте первую цель и задайте измеримые Key Results."
                  showRequest={false}
                  primaryAction={{
                    label: "Создать цель",
                    onClick: () => setShowCreateDialog(true),
                  }}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Objective Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          {selectedObjective && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  {selectedObjective.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedObjective.status.replace('_', ' ').toUpperCase()} • {getObjectiveProgress(selectedObjective)}% Complete
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="key-results">Key Results ({selectedObjective.key_results?.length || 0})</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4">
                    {selectedObjective.description && (
                      <div>
                        <Label>Description</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedObjective.description}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Start Date</Label>
                        <p className="text-sm">
                          {formatDate(selectedObjective.start_date)}
                        </p>
                      </div>
                      <div>
                        <Label>Due Date</Label>
                        <p className="text-sm">
                          {formatDate(selectedObjective.due_date)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label>Overall Progress</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={getObjectiveProgress(selectedObjective)} className="flex-1" />
                        <span className="text-sm font-medium">{getObjectiveProgress(selectedObjective)}%</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="key-results" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Key results for this objective</p>
                    <Button size="sm" variant="outline" onClick={openCreateKeyResult}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Key Result
                    </Button>
                  </div>
                  {selectedObjective.key_results && selectedObjective.key_results.length > 0 ? (
                    <div className="space-y-4">
                      {selectedObjective.key_results.map((kr: KeyResult) => (
                        <Card key={kr.id}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h4 className="font-medium">{kr.description}</h4>
                                </div>
                                <Badge className={getKRStatusColor(kr.progress_percentage)} variant="outline">
                                  {Math.round(kr.progress_percentage ?? 0)}%
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                <span>
                                  Progress: {Number(kr.current_value ?? 0).toLocaleString()}{kr.unit ?? ""} / {Number(kr.target_value ?? 0).toLocaleString()}{kr.unit ?? ""}
                                </span>
                                <span className="font-medium">{Math.round(kr.progress_percentage ?? 0)}%</span>
                              </div>

                              <Progress value={kr.progress_percentage ?? 0} />
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" onClick={() => openEditKeyResult(kr)}>
                                  <Edit3 className="w-4 h-4 mr-2" />
                                  Edit
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteKeyResult(kr)}>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Key Results</h3>
                      <p className="text-muted-foreground mb-4">
                        Add measurable key results to track progress on this objective.
                      </p>
                      <Button size="sm" onClick={openCreateKeyResult}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Key Result
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4" />
                    <p>Activity tracking coming soon...</p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleEditObjective(selectedObjective)
                      setShowDetailDialog(false)
                    }}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteObjective(selectedObjective)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
                <Button size="sm" onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showKeyResultDialog} onOpenChange={setShowKeyResultDialog}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingKeyResult ? "Edit Key Result" : "Add Key Result"}</DialogTitle>
            <DialogDescription>
              Define a measurable outcome for this objective.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="kr-description">Description *</Label>
              <Textarea
                id="kr-description"
                value={newKeyResult.description}
                onChange={(e) => setNewKeyResult({ ...newKeyResult, description: e.target.value })}
                placeholder="e.g., Increase NPS to 45"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kr-metric-key">Metric Key</Label>
              <Input
                id="kr-metric-key"
                value={newKeyResult.metric_key || ""}
                onChange={(e) => setNewKeyResult({ ...newKeyResult, metric_key: e.target.value })}
                placeholder="e.g., nps_score"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kr-metric-search">Metric Selector</Label>
              <Input
                id="kr-metric-search"
                value={metricSearch}
                onChange={(e) => setMetricSearch(e.target.value)}
                placeholder={metricLoading ? "Loading metrics..." : "Search metric definitions"}
              />
              <Select
                value={newKeyResult.metric_def_id || ""}
                onValueChange={(value) => {
                  const metric = metricDefinitions.find((item) => item.id === value)
                  setNewKeyResult((prev) => ({
                    ...prev,
                    metric_def_id: metric?.id,
                    metric_key: metric?.name || prev.metric_key,
                    unit: metric?.unit || prev.unit,
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select metric definition (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No metric</SelectItem>
                  {filteredMetricDefinitions.map((metric) => (
                    <SelectItem key={metric.id} value={metric.id}>
                      {metric.name}{metric.unit ? ` (${metric.unit})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="kr-direction">Direction</Label>
                <Select
                  value={(newKeyResult.direction as KeyResultDirection) || "increase"}
                  onValueChange={(value: KeyResultDirection) =>
                    setNewKeyResult({ ...newKeyResult, direction: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase</SelectItem>
                    <SelectItem value="decrease">Decrease</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="kr-progress-rule">Progress Rule</Label>
                <Select
                  value={(newKeyResult.progress_rule as KeyResultProgressRule) || "linear"}
                  onValueChange={(value: KeyResultProgressRule) =>
                    setNewKeyResult({ ...newKeyResult, progress_rule: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="ratio">Ratio</SelectItem>
                    <SelectItem value="capped">Capped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="kr-start">Start Value</Label>
                <Input
                  id="kr-start"
                  type="number"
                  value={newKeyResult.start_value}
                  onChange={(e) =>
                    setNewKeyResult({
                      ...newKeyResult,
                      start_value: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="kr-current">Current Value</Label>
                <Input
                  id="kr-current"
                  type="number"
                  value={newKeyResult.current_value}
                  onChange={(e) =>
                    setNewKeyResult({
                      ...newKeyResult,
                      current_value: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="kr-target">Target Value *</Label>
                <Input
                  id="kr-target"
                  type="number"
                  value={newKeyResult.target_value}
                  onChange={(e) =>
                    setNewKeyResult({
                      ...newKeyResult,
                      target_value: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="kr-unit">Unit</Label>
                <Input
                  id="kr-unit"
                  value={newKeyResult.unit}
                  onChange={(e) => setNewKeyResult({ ...newKeyResult, unit: e.target.value })}
                  placeholder="%, pts, leads"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kr-filters">Filters JSON</Label>
              <Textarea
                id="kr-filters"
                value={filtersJsonInput}
                onChange={(e) => setFiltersJsonInput(e.target.value)}
                placeholder='{"city":"Kyiv","channel":"Paid Meta"}'
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kr-data-quality">Data Quality JSON</Label>
              <Textarea
                id="kr-data-quality"
                value={dataQualityInput}
                onChange={(e) => setDataQualityInput(e.target.value)}
                placeholder='{"min_coverage":0.8,"max_lag_days":3}'
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKeyResultDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveKeyResult} disabled={keyResultSubmitting}>
              {keyResultSubmitting ? "Saving..." : "Save Key Result"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
