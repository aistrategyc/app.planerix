"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Plus, CheckSquare, Clock, AlertTriangle, Search, Loader2, Eye, Star, PlayCircle, XCircle, Trash2, Calendar, History } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useTasks, useUsers, useProjects } from "@/app/tasks/hooks/useTasks"
import { TasksAPI, TaskStatus, TaskPriority, TaskType, TaskCreate, Task, TaskUpdate, TaskFilters, TaskParticipant, TaskParticipantRole, TaskApproval, TaskApprovalStatus, canTransitionTaskStatus, getTaskStatusOptions } from "@/lib/api/tasks"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { EmptyState } from "@/components/ui/empty-state"
import { PageLoader } from "@/components/ui/loading-spinner"
import { useAuth } from "@/contexts/auth-context"
import { type MembershipRole, isReadOnlyRole } from "@/types/roles"
import { PageHeader } from "@/components/layout/PageHeader"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface NewTaskForm extends TaskCreate {
  project_id: string
  assignee_id: string
}

type PriorityFilter = "all" | TaskPriority
type TypeFilter = "all" | TaskType
type TaskScope = "all" | "my" | "assigned" | "created" | "subordinates" | "watching"

const MANAGER_ROLES = new Set(["owner", "admin", "bu_manager", "hod", "team_lead", "pmo"])

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

// Column configuration mapping API statuses to UI
const columnsConfig = {
  [TaskStatus.TODO]: { 
    name: "To Do", 
    icon: <CheckSquare className="w-4 h-4" />,
    color: "bg-slate-100"
  },
  [TaskStatus.IN_PROGRESS]: { 
    name: "In Progress", 
    icon: <PlayCircle className="w-4 h-4" />,
    color: "bg-blue-100"
  },
  [TaskStatus.IN_REVIEW]: { 
    name: "In Review", 
    icon: <Eye className="w-4 h-4" />,
    color: "bg-yellow-100"
  },
  [TaskStatus.BLOCKED]: {
    name: "Blocked",
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "bg-orange-100"
  },
  [TaskStatus.DONE]: { 
    name: "Done", 
    icon: <CheckSquare className="w-4 h-4" />,
    color: "bg-green-100"
  },
  [TaskStatus.CANCELLED]: { 
    name: "Cancelled", 
    icon: <XCircle className="w-4 h-4" />,
    color: "bg-red-100"
  },
}

function TasksPageContent() {
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    updateFilters,
    refetch: refetchTasks,
  } = useTasks()
  const { users, loading: usersLoading } = useUsers()
  const { projects, loading: projectsLoading } = useProjects()

  const currentUserId = currentUser?.id

  const [searchQuery, setSearchQuery] = useState("")
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>("all")
  const [filterType, setFilterType] = useState<TypeFilter>("all")
  const [filterProject, setFilterProject] = useState<string>("all")
  const [filterScope, setFilterScope] = useState<TaskScope>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const createParam = searchParams.get("create")
  const hasActiveFilters =
    Boolean(searchQuery) ||
    filterPriority !== "all" ||
    filterType !== "all" ||
    filterProject !== "all" ||
    filterScope !== "all"

  useEffect(() => {
    if (createParam === "1") {
      setShowCreateDialog(true)
      router.replace("/tasks")
    }
  }, [createParam, router])
  // Push filters to server (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      const payload: Partial<TaskFilters> = {
        priority: filterPriority === "all" ? undefined : filterPriority,
        task_type: filterType === "all" ? undefined : filterType,
        project_id: filterProject === "all" ? undefined : filterProject,
      }
      if (searchQuery) payload.search = searchQuery
      updateFilters(payload)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, filterPriority, filterType, filterProject, updateFilters])

  useEffect(() => {
    if (!currentUserId) return
    if (filterScope === "assigned") {
      updateFilters({ assignee_id: currentUserId, creator_id: undefined, watcher_id: undefined })
      return
    }
    if (filterScope === "created") {
      updateFilters({ creator_id: currentUserId, assignee_id: undefined, watcher_id: undefined })
      return
    }
    if (filterScope === "watching") {
      updateFilters({ watcher_id: currentUserId, assignee_id: undefined, creator_id: undefined })
      return
    }
    updateFilters({ assignee_id: undefined, creator_id: undefined, watcher_id: undefined })
  }, [filterScope, currentUserId, updateFilters])

  // Task detail dialog state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId) || null, [tasks, selectedTaskId])

  const openTask = useCallback((id: string) => {
    setSelectedTaskId(id)
    setIsDetailOpen(true)
  }, [])

  const [newTask, setNewTask] = useState<NewTaskForm>({
    title: "",
    description: "",
    priority: TaskPriority.MEDIUM,
    task_type: TaskType.FEATURE,
    project_id: "",
    assignee_id: "",
    due_date: "",
    estimated_hours: undefined,
  })

  // Filter tasks based on search and filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description?.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesPriority = filterPriority === "all" || task.priority === filterPriority
      const matchesType = filterType === "all" || task.task_type === filterType
      const matchesProject = filterProject === "all" || task.project_id === filterProject

      return matchesSearch && matchesPriority && matchesType && matchesProject
    })
  }, [tasks, searchQuery, filterPriority, filterType, filterProject])

  const currentMember = useMemo(
    () => (currentUserId ? users.find((u) => u.id === currentUserId) ?? null : null),
    [users, currentUserId]
  )
  const currentRole = currentMember?.role as MembershipRole | undefined
  const canEditTasks = !currentRole || !isReadOnlyRole(currentRole)

  const subordinateIds = useMemo(() => {
    if (!currentMember || !MANAGER_ROLES.has(currentMember.role ?? "")) return new Set<string>()
    const deptId = currentMember.department_id ?? null
    return new Set(
      users
        .filter((user) => {
          if (user.id === currentMember.id) return false
          if (MANAGER_ROLES.has(user.role ?? "")) return false
          if (deptId && user.department_id && user.department_id !== deptId) return false
          return true
        })
        .map((user) => user.id)
    )
  }, [users, currentMember])

  const scopedTasks = useMemo(() => {
    if (!currentUserId) return filteredTasks
    switch (filterScope) {
      case "my":
        return filteredTasks.filter(
          (task) => task.assignee_id === currentUserId || task.creator_id === currentUserId
        )
      case "assigned":
        return filteredTasks.filter((task) => task.assignee_id === currentUserId)
      case "created":
        return filteredTasks.filter((task) => task.creator_id === currentUserId)
      case "subordinates":
        return filteredTasks.filter(
          (task) => !!task.assignee_id && subordinateIds.has(task.assignee_id)
        )
      case "watching":
        return filteredTasks
      default:
        return filteredTasks
    }
  }, [filteredTasks, filterScope, currentUserId, subordinateIds])

  const baseFilters = useMemo(() => {
    const filters: TaskFilters = {}
    if (searchQuery) filters.search = searchQuery
    if (filterPriority !== "all") filters.priority = filterPriority
    if (filterType !== "all") filters.task_type = filterType
    if (filterProject !== "all") filters.project_id = filterProject
    return filters
  }, [searchQuery, filterPriority, filterType, filterProject])

  const [scopeCounts, setScopeCounts] = useState({
    all: 0,
    my: 0,
    assigned: 0,
    created: 0,
    subordinates: 0,
    watching: 0,
  })

  useEffect(() => {
    let active = true
    if (!currentUserId) {
      setScopeCounts({ all: 0, my: 0, assigned: 0, created: 0, subordinates: 0, watching: 0 })
      return () => {
        active = false
      }
    }

    const loadCounts = async () => {
      try {
        const [allTasks, assignedTasks, createdTasks, watchingTasks] = await Promise.all([
          TasksAPI.getTasks({ ...baseFilters, per_page: 200 }),
          TasksAPI.getTasks({ ...baseFilters, assignee_id: currentUserId, per_page: 200 }),
          TasksAPI.getTasks({ ...baseFilters, creator_id: currentUserId, per_page: 200 }),
          TasksAPI.getTasks({ ...baseFilters, watcher_id: currentUserId, per_page: 200 }),
        ])
        if (!active) return
        const myIds = new Set([...assignedTasks, ...createdTasks].map((task) => task.id))
        const subordinatesCount = allTasks.filter(
          (task) => !!task.assignee_id && subordinateIds.has(task.assignee_id)
        ).length
        setScopeCounts({
          all: allTasks.length,
          my: myIds.size,
          assigned: assignedTasks.length,
          created: createdTasks.length,
          subordinates: subordinatesCount,
          watching: watchingTasks.length,
        })
      } catch {
        if (!active) return
        setScopeCounts((prev) => ({ ...prev }))
      }
    }

    loadCounts()
    return () => {
      active = false
    }
  }, [baseFilters, currentUserId, subordinateIds])

  // Handle drag and drop
  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return
      if (!canEditTasks) {
        toast({
          title: "Read-only access",
          description: "You don't have permission to move tasks.",
          variant: "destructive",
        })
        return
      }

      const taskId = result.draggableId
      const newStatus = result.destination.droppableId as TaskStatus
      
      // Optimistically update UI
      const task = tasks.find(t => t.id === taskId)
      if (!task) return
      if (newStatus === task.status) return
      if (!canTransitionTaskStatus(task.status, newStatus)) {
        toast({
          title: "Invalid status transition",
          description: `Cannot move task from ${task.status ? task.status.replace("_", " ") : "unknown"} to ${newStatus.replace("_", " ")}`,
          variant: "destructive",
        })
        return
      }

      // Update task status via API
      const success = await updateTaskStatus(taskId, newStatus)
      
      if (!success) {
        // Revert optimistic update on failure
        toast({
          title: "Error",
          description: "Failed to update task status",
          variant: "destructive",
        })
      }
    },
    [tasks, updateTaskStatus, toast, canEditTasks]
  )

  // Create new task
  const handleCreateTask = useCallback(async () => {
    if (!canEditTasks) {
      toast({
        title: "Read-only access",
        description: "You don't have permission to create tasks.",
        variant: "destructive",
      })
      return
    }
    if (!newTask.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Task title is required",
        variant: "destructive",
      })
      return
    }

    const success = await createTask({
      ...newTask,
      title: newTask.title.trim(),
      description: newTask.description?.trim() || undefined,
      project_id: newTask.project_id || undefined,
      assignee_id: newTask.assignee_id || undefined,
      due_date: newTask.due_date || undefined,
    })

    if (success) {
      setNewTask({
        title: "",
        description: "",
        priority: TaskPriority.MEDIUM,
        task_type: TaskType.FEATURE,
        project_id: "",
        assignee_id: "",
        due_date: "",
        estimated_hours: undefined,
      })
      setShowCreateDialog(false)
    }
  }, [newTask, createTask, toast, canEditTasks])

  // Delete task with confirmation
  const handleDeleteTask = useCallback(async (taskId: string, taskTitle: string) => {
    if (confirm(`Are you sure you want to delete "${taskTitle}"?`)) {
      await deleteTask(taskId)
    }
  }, [deleteTask])

  // Priority styling
  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.CRITICAL:
        return "bg-red-100 text-red-800 border-red-300"
      case TaskPriority.HIGH:
        return "bg-orange-100 text-orange-800 border-orange-300"
      case TaskPriority.MEDIUM:
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case TaskPriority.LOW:
        return "bg-green-100 text-green-800 border-green-300"
      default:
        return "bg-slate-100 text-slate-800 border-slate-300"
    }
  }

  // Type styling
  const getTypeColor = (type: TaskType) => {
    switch (type) {
      case TaskType.TASK:
        return "bg-slate-100 text-slate-800"
      case TaskType.BUG:
        return "bg-red-100 text-red-800"
      case TaskType.FEATURE:
        return "bg-blue-100 text-blue-800"
      case TaskType.IMPROVEMENT:
        return "bg-purple-100 text-purple-800"
      case TaskType.RESEARCH:
        return "bg-emerald-100 text-emerald-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  // Group tasks by status
  const columns = useMemo(() => {
    const result: Record<
      TaskStatus,
      { name: string; icon: React.ReactNode; color: string; tasks: Task[] }
    > = Object.create(null)

    Object.values(TaskStatus).forEach(status => {
      result[status] = {
        ...columnsConfig[status],
        tasks: scopedTasks.filter(task => task.status === status)
      }
    })

    return result
  }, [scopedTasks])

  const taskStats = useMemo(() => {
    const total = scopedTasks.length
    const overdue = scopedTasks.filter(
      (task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== TaskStatus.DONE
    ).length
    const inProgress = scopedTasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length
    const done = scopedTasks.filter((task) => task.status === TaskStatus.DONE).length
    const highPriority = scopedTasks.filter(
      (task) => task.priority === TaskPriority.HIGH || task.priority === TaskPriority.CRITICAL
    ).length
    return { total, overdue, inProgress, done, highPriority }
  }, [scopedTasks])

  // Get user name by ID
  const getUserName = useCallback((userId?: string) => {
    if (!userId) return "Unassigned"
    const user = users.find(u => u.id === userId)
    return user?.username || "Unknown User"
  }, [users])

  const getUserInitials = useCallback((userId?: string) => {
    if (!userId) return "?"
    const user = users.find(u => u.id === userId)
    const name = user?.username || user?.email || ""
    if (!name) return "?"
    return name.split(" ").map(part => part[0]).join("").toUpperCase()
  }, [users])

  const getUserAvatar = useCallback((userId?: string) => {
    if (!userId) return undefined
    const user = users.find(u => u.id === userId)
    return user?.avatar_url || undefined
  }, [users])

  // Get project name by ID
  const getProjectName = useCallback((projectId?: string) => {
    if (!projectId) return ""
    const project = projects.find(p => p.id === projectId)
    return project?.name || "Unknown Project"
  }, [projects])


  if (tasksLoading || usersLoading || projectsLoading) {
    return <PageLoader text="Загрузка задач..." />
  }

  if (tasksError) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Не удалось загрузить задачи"
          description={tasksError}
          action={{
            label: "Повторить",
            onClick: () => refetchTasks(),
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Execution board across teams, with live status, ownership and due dates."
        actions={
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          
          <Select value={filterPriority} onValueChange={(value) => setFilterPriority(value as PriorityFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value={TaskPriority.CRITICAL}>Critical</SelectItem>
              <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
              <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
              <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={(value) => setFilterType(value as TypeFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value={TaskType.TASK}>Task</SelectItem>
              <SelectItem value={TaskType.FEATURE}>Feature</SelectItem>
              <SelectItem value={TaskType.BUG}>Bug</SelectItem>
              <SelectItem value={TaskType.IMPROVEMENT}>Improvement</SelectItem>
              <SelectItem value={TaskType.RESEARCH}>Research</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterScope} onValueChange={(value) => setFilterScope(value as TaskScope)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="my">My Tasks</SelectItem>
              <SelectItem value="assigned">Assigned to me</SelectItem>
              <SelectItem value="created">Created by me</SelectItem>
              <SelectItem value="subordinates">My subordinates</SelectItem>
              <SelectItem value="watching">Watching</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button
                className="bg-primary hover:bg-primary/90"
                disabled={!canEditTasks}
                title={!canEditTasks ? "Read-only access: you can't create tasks." : undefined}
              >
                <Plus className="w-4 h-4 mr-2" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Add a new task to your project workflow.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Enter task title..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Task description..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value) => setNewTask({ ...newTask, priority: value as TaskPriority })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
                        <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
                        <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
                        <SelectItem value={TaskPriority.CRITICAL}>Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="task_type">Type</Label>
                    <Select
                      value={newTask.task_type}
                      onValueChange={(value) => setNewTask({ ...newTask, task_type: value as TaskType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TaskType.TASK}>Task</SelectItem>
                        <SelectItem value={TaskType.FEATURE}>Feature</SelectItem>
                        <SelectItem value={TaskType.BUG}>Bug</SelectItem>
                        <SelectItem value={TaskType.IMPROVEMENT}>Improvement</SelectItem>
                        <SelectItem value={TaskType.RESEARCH}>Research</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="assignee_id">Assignee</Label>
                    <Select
                      value={newTask.assignee_id}
                      onValueChange={(value) => setNewTask({ ...newTask, assignee_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="project_id">Project</Label>
                    <Select
                      value={newTask.project_id}
                      onValueChange={(value) => setNewTask({ ...newTask, project_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Project</SelectItem>
                        {projects.map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Input
                      id="due_date"
                      type="date"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="estimated_hours">Estimated Hours</Label>
                    <Input
                      id="estimated_hours"
                      type="number"
                      min="0"
                      step="0.5"
                      value={newTask.estimated_hours || ""}
                      onChange={(e) => setNewTask({ 
                        ...newTask, 
                        estimated_hours: e.target.value ? parseFloat(e.target.value) : undefined 
                      })}
                      placeholder="Hours"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask}>
                  Create Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total tasks", value: taskStats.total, icon: <CheckSquare className="h-4 w-4 text-blue-600" /> },
          { label: "In progress", value: taskStats.inProgress, icon: <PlayCircle className="h-4 w-4 text-indigo-500" /> },
          { label: "Done", value: taskStats.done, icon: <CheckSquare className="h-4 w-4 text-emerald-600" /> },
          { label: "Overdue", value: taskStats.overdue, icon: <Clock className="h-4 w-4 text-rose-500" /> },
          { label: "High priority", value: taskStats.highPriority, icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              {item.icon}
            </div>
            <div className="mt-2 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </div>

      {!canEditTasks && (
        <Card>
          <CardContent className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            Read-only access: you can view tasks, but creating or editing is disabled for your role.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "All", count: scopeCounts.all },
          { value: "my", label: "My", count: scopeCounts.my },
          { value: "assigned", label: "Assigned to me", count: scopeCounts.assigned },
          { value: "created", label: "Created by me", count: scopeCounts.created },
          { value: "subordinates", label: "Subordinates", count: scopeCounts.subordinates },
          { value: "watching", label: "Watching", count: scopeCounts.watching },
        ].map((option) => (
          <Button
            key={option.value}
            variant={filterScope === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterScope(option.value as TaskScope)}
          >
            {option.label}
            <Badge variant="secondary" className="ml-2">
              {option.count}
            </Badge>
          </Button>
        ))}
      </div>

      {scopedTasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            {hasActiveFilters ? (
              <>
                <CheckSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No tasks found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or search terms.
                </p>
                <Button onClick={() => setShowCreateDialog(true)} disabled={!canEditTasks}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              </>
            ) : (
              <AnalyticsEmptyState
                context="tasks"
                title="Пока нет задач"
                description="Создайте первую задачу и назначьте ответственного."
                showRequest={false}
                primaryAction={{
                  label: "Создать задачу",
                  onClick: () => setShowCreateDialog(true),
                }}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          <DragDropContext onDragEnd={onDragEnd}>
            {Object.entries(columns).map(([columnId, column]) => (
              <div key={columnId} className="min-w-[280px] flex-1">
                <div className={`rounded-2xl border border-border/60 p-3 mb-4 ${column.color}`}>
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    {column.icon}
                    {column.name}
                    <Badge variant="secondary" className="ml-auto">
                      {column.tasks.length}
                    </Badge>
                  </h2>
                </div>
                
                <Droppable droppableId={columnId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-3 min-h-[420px] p-2 rounded-2xl border border-border/60 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-muted/50' : 'bg-card/30'
                      }`}
                    >
                      {column.tasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => openTask(task.id)}
                              className={`cursor-move transition-all border-border/60 bg-card/60 ${
                                snapshot.isDragging ? 'shadow-lg rotate-2' : 'hover:shadow-md'
                              }`}
                            >
                              <CardContent className="p-4">
                              {/* Task Header */}
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-medium text-base line-clamp-2">
                                  {task.title}
                                </h3>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteTask(task.id, task.title)
                                  }}
                                  disabled={!canEditTasks}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Task Description */}
                              {task.description && (
                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                  {task.description}
                                </p>
                              )}

                              {/* Priority and Type Badges */}
                              <div className="flex gap-2 mb-3">
                                <Badge className={getPriorityColor(task.priority)} variant="outline">
                                  {task.priority ? task.priority.toUpperCase() : "NO PRIORITY"}
                                </Badge>
                                <Badge className={getTypeColor(task.task_type)} variant="outline">
                                  {task.task_type ? task.task_type.replace("_", " ").toUpperCase() : "NO TYPE"}
                                </Badge>
                              </div>

                              {/* Project Info */}
                              {task.project_id && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                  <Star className="w-3 h-3" />
                                  {getProjectName(task.project_id)}
                                </div>
                              )}

                              {/* Assignee */}
                              <div className="flex items-center gap-2 mb-3">
                                <Avatar className="w-7 h-7">
                                  <AvatarImage src={getUserAvatar(task.assignee_id)} />
                                  <AvatarFallback className="text-[10px]">
                                    {getUserInitials(task.assignee_id)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col leading-tight">
                                  <span className="text-[10px] uppercase text-muted-foreground">Responsible</span>
                                  <span className="text-sm">{getUserName(task.assignee_id)}</span>
                                </div>
                              </div>

                              {task.creator_id && (
                                <div className="text-xs text-muted-foreground mb-3">
                                  Created by {getUserName(task.creator_id)}
                                </div>
                              )}

                              {/* Due Date */}
                              {task.due_date && (
                                <div className="flex items-center gap-2 text-sm mb-3">
                                  <Clock className="w-4 h-4" />
                                  <span className={`${
                                    new Date(task.due_date) < new Date() && task.status !== TaskStatus.DONE
                                      ? 'text-destructive font-medium'
                                      : 'text-muted-foreground'
                                  }`}>
                                  {formatDate(task.due_date)}
                                  </span>
                                  {new Date(task.due_date) < new Date() && task.status !== TaskStatus.DONE && (
                                    <AlertTriangle className="w-4 h-4 text-destructive" />
                                  )}
                                </div>
                              )}

                              {/* Estimated Hours */}
                              {task.estimated_hours && (
                                <div className="text-xs text-muted-foreground">
                                  Estimated: {task.estimated_hours}h
                                  {task.actual_hours && (
                                    <span> | Actual: {task.actual_hours}h</span>
                                  )}
                                </div>
                              )}

                              {/* Task Metadata */}
                              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                                <div>Created: {formatDate(task.created_at)}</div>
                                {task.updated_at !== task.created_at && (
                                  <div>Updated: {formatDate(task.updated_at)}</div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </DragDropContext>
      </div>
      )}

      {/* Task Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Task Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(columns).map(([status, column]) => (
              <div key={status} className="text-center">
                <div className="text-2xl font-bold text-foreground">
                {column.tasks.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {column.name}
                </div>
              </div>
            ))}
          </div>
          
          {/* Additional Stats */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                {scopedTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== TaskStatus.DONE).length}
              </div>
              <div className="text-sm text-destructive">Overdue</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                {scopedTasks.filter(t => t.assignee_id).length}
              </div>
              <div className="text-sm text-muted-foreground">Assigned</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">
                {scopedTasks.filter(t => t.priority === TaskPriority.HIGH || t.priority === TaskPriority.CRITICAL).length}
              </div>
              <div className="text-sm text-orange-600">High Priority</div>
            </div>
          </div>
        </CardContent>
      </Card>
      <TaskDetailDialog
        task={selectedTask}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onUpdate={updateTask}
        users={users.map(u => ({ id: u.id, username: u.username }))}
        projects={projects.map(p => ({ id: p.id, name: p.name }))}
        canEdit={canEditTasks}
      />
    </div>
  )
}

function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  users,
  projects,
  canEdit,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (taskId: string, updates: TaskUpdate) => Promise<Task | null>
  users: Array<{ id: string; username: string }>
  projects: Array<{ id: string; name: string }>
  canEdit: boolean
}) {
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  const [editedTask, setEditedTask] = useState<TaskUpdate>({})
  type TaskComment = {
    id?: string
    content?: string
    created_at?: string
    user?: { username?: string; email?: string }
  }
  type TaskWatcher = {
    id?: string
    user_id: string
    user?: { username?: string; full_name?: string; avatar_url?: string }
  }
  const [comments, setComments] = useState<TaskComment[]>([])
  const [watchers, setWatchers] = useState<TaskWatcher[]>([])
  const [watchersLoading, setWatchersLoading] = useState(false)
  const [commentLoading, setCommentLoading] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [participants, setParticipants] = useState<TaskParticipant[]>([])
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [approvals, setApprovals] = useState<TaskApproval[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [newParticipantUserId, setNewParticipantUserId] = useState("")
  const [newParticipantRole, setNewParticipantRole] = useState<TaskParticipantRole>(TaskParticipantRole.RESPONSIBLE)
  const [approvalComment, setApprovalComment] = useState("")
  const [approvalApproverId, setApprovalApproverId] = useState("")
  const currentUserId = currentUser?.id
  const isWatching = Boolean(currentUserId && watchers.some((w) => w.user_id === currentUserId))
  const isApprover = Boolean(
    currentUserId && participants.some((p) => p.user_id === currentUserId && p.role === TaskParticipantRole.APPROVER)
  )
  const getUserNameById = useCallback((userId?: string) => {
    if (!userId) return "Unknown User"
    const user = users.find(u => u.id === userId)
    return user?.username || "Unknown User"
  }, [users])

  useEffect(() => {
    if (task && open) {
      setEditedTask({
        title: task.title,
        description: task.description,
        priority: task.priority,
        task_type: task.task_type,
        status: task.status,
        assignee_id: task.assignee_id,
        project_id: task.project_id,
        due_date: task.due_date,
        estimated_hours: task.estimated_hours,
        actual_hours: task.actual_hours,
      })
    }
  }, [task, open])

  useEffect(() => {
    const fetchComments = async () => {
      if (!task || !open) return
      try {
        setCommentLoading(true)
        const data = await TasksAPI.getTaskComments(task.id)
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : []
        setComments(items)
      } catch {
        toast({ title: "Error", description: "Failed to load comments", variant: "destructive" })
      } finally {
        setCommentLoading(false)
      }
    }

    fetchComments()
  }, [task, open, toast])

  useEffect(() => {
    const fetchWatchers = async () => {
      if (!task || !open) return
      try {
        setWatchersLoading(true)
        const data = await TasksAPI.getTaskWatchers(task.id)
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : []
        setWatchers(items)
      } catch {
        setWatchers([])
      } finally {
        setWatchersLoading(false)
      }
    }

    fetchWatchers()
  }, [task, open])

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!task || !open) return
      try {
        setParticipantsLoading(true)
        const data = await TasksAPI.listParticipants(task.id)
        setParticipants(data)
      } catch {
        setParticipants([])
      } finally {
        setParticipantsLoading(false)
      }
    }

    fetchParticipants()
  }, [task, open])

  useEffect(() => {
    const fetchApprovals = async () => {
      if (!task || !open) return
      try {
        setApprovalsLoading(true)
        const data = await TasksAPI.listApprovals(task.id)
        setApprovals(data)
      } catch {
        setApprovals([])
      } finally {
        setApprovalsLoading(false)
      }
    }

    fetchApprovals()
  }, [task, open])

  const handleUpdate = useCallback(async () => {
    if (!task) return
    if (!canEdit) return
    setIsUpdating(true)
    try {
      const res = await onUpdate(task.id, editedTask)
      if (res) {
        toast({ title: "Task Updated", description: "Changes saved successfully." })
        onOpenChange(false)
      }
    } catch {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" })
    } finally {
      setIsUpdating(false)
    }
  }, [task, editedTask, onUpdate, toast, onOpenChange])

  const handleAddComment = useCallback(async () => {
    if (!task || !newComment.trim()) return
    try {
      const created = await TasksAPI.addTaskComment(task.id, newComment.trim())
      const createdItem = created && typeof created === "object" ? created : { content: newComment.trim() }
      setComments((prev) => [createdItem as TaskComment, ...prev])
      setNewComment("")
    } catch {
      toast({ title: "Error", description: "Failed to add comment", variant: "destructive" })
    }
  }, [task, newComment, toast])

  const handleToggleWatch = useCallback(async () => {
    if (!task || !currentUserId) return
    try {
      setWatchersLoading(true)
      if (isWatching) {
        await TasksAPI.removeTaskWatcher(task.id, currentUserId)
        setWatchers((prev) => prev.filter((watcher) => watcher.user_id !== currentUserId))
      } else {
        await TasksAPI.addTaskWatchers(task.id, [currentUserId])
        const data = await TasksAPI.getTaskWatchers(task.id)
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : []
        setWatchers(items)
      }
    } catch {
      toast({ title: "Error", description: "Failed to update watcher", variant: "destructive" })
    } finally {
      setWatchersLoading(false)
    }
  }, [task, currentUserId, isWatching, toast])

  const handleAddParticipant = useCallback(async () => {
    if (!task || !newParticipantUserId) return
    try {
      setParticipantsLoading(true)
      await TasksAPI.addParticipants(task.id, {
        user_ids: [newParticipantUserId],
        role: newParticipantRole,
      })
      const data = await TasksAPI.listParticipants(task.id)
      setParticipants(data)
      setNewParticipantUserId("")
    } catch {
      toast({ title: "Error", description: "Failed to add participant", variant: "destructive" })
    } finally {
      setParticipantsLoading(false)
    }
  }, [task, newParticipantUserId, newParticipantRole, toast])

  const handleRemoveParticipant = useCallback(async (participantId: string) => {
    if (!task) return
    try {
      setParticipantsLoading(true)
      await TasksAPI.removeParticipant(task.id, participantId)
      setParticipants((prev) => prev.filter((p) => p.id !== participantId))
    } catch {
      toast({ title: "Error", description: "Failed to remove participant", variant: "destructive" })
    } finally {
      setParticipantsLoading(false)
    }
  }, [task, toast])

  const handleRequestApproval = useCallback(async () => {
    if (!task) return
    try {
      setApprovalsLoading(true)
      await TasksAPI.requestApproval(task.id, {
        comment: approvalComment.trim() || undefined,
        approver_id: approvalApproverId || undefined,
      })
      const data = await TasksAPI.listApprovals(task.id)
      setApprovals(data)
      setApprovalComment("")
      setApprovalApproverId("")
    } catch {
      toast({ title: "Error", description: "Failed to request approval", variant: "destructive" })
    } finally {
      setApprovalsLoading(false)
    }
  }, [task, approvalComment, approvalApproverId, toast])

  const handleDecision = useCallback(async (approvalId: string, status: TaskApprovalStatus) => {
    if (!task) return
    try {
      setApprovalsLoading(true)
      await TasksAPI.decideApproval(task.id, approvalId, { status })
      const data = await TasksAPI.listApprovals(task.id)
      setApprovals(data)
    } catch {
      toast({ title: "Error", description: "Failed to update approval", variant: "destructive" })
    } finally {
      setApprovalsLoading(false)
    }
  }, [task, toast])

  const getStatusColor = (status: TaskStatus) => {
    const map: Record<TaskStatus, string> = {
      [TaskStatus.TODO]: "bg-slate-100 text-slate-800",
      [TaskStatus.IN_PROGRESS]: "bg-blue-100 text-blue-800",
      [TaskStatus.IN_REVIEW]: "bg-yellow-100 text-yellow-800",
      [TaskStatus.BLOCKED]: "bg-orange-100 text-orange-800",
      [TaskStatus.DONE]: "bg-green-100 text-green-800",
      [TaskStatus.CANCELLED]: "bg-red-100 text-red-800",
    }
    return map[status]
  }

  const getApprovalColor = (status: TaskApprovalStatus) => {
    const map: Record<TaskApprovalStatus, string> = {
      [TaskApprovalStatus.PENDING]: "bg-yellow-100 text-yellow-800",
      [TaskApprovalStatus.APPROVED]: "bg-green-100 text-green-800",
      [TaskApprovalStatus.REJECTED]: "bg-red-100 text-red-800",
    }
    return map[status]
  }

  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              Task Details
              <Badge className={getStatusColor(task.status)} variant="outline">
                {task.status ? task.status.replace("_", " ").toUpperCase() : "UNKNOWN"}
              </Badge>
            </div>
            <Button
              size="sm"
              variant={isWatching ? "secondary" : "outline"}
              onClick={handleToggleWatch}
              disabled={!currentUserId || watchersLoading}
            >
              {isWatching ? "Watching" : "Watch"}
            </Button>
          </DialogTitle>
          <DialogDescription>View and update this task</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {watchers.slice(0, 4).map((watcher, index) => (
                <Avatar key={watcher.id ?? watcher.user_id ?? String(index)} className="w-7 h-7">
                  <AvatarImage src={watcher.user?.avatar_url} />
                  <AvatarFallback className="text-[10px]">
                    {getUserNameById(watcher.user_id).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              <span>{watchers.length} watching</span>
            </div>
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={editedTask.title || ""}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                disabled={!canEdit}
              />
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={editedTask.description || ""}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={(editedTask.status as TaskStatus) || undefined}
                  onValueChange={(value) => setEditedTask({ ...editedTask, status: value as TaskStatus })}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getTaskStatusOptions(task.status).map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ").toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={(editedTask.priority as TaskPriority) || undefined}
                  onValueChange={(value) => setEditedTask({ ...editedTask, priority: value as TaskPriority })}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TaskPriority).map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={(editedTask.task_type as TaskType) || undefined}
                  onValueChange={(value) => setEditedTask({ ...editedTask, task_type: value as TaskType })}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TaskType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Assignee</Label>
                <Select
                  value={editedTask.assignee_id || ""}
                  onValueChange={(value) => setEditedTask({ ...editedTask, assignee_id: value || undefined })}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Project</Label>
                <Select
                  value={editedTask.project_id || ""}
                  onValueChange={(value) => setEditedTask({ ...editedTask, project_id: value || undefined })}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue placeholder="No Project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={editedTask.due_date || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, due_date: e.target.value || undefined })}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid gap-2">
                <Label>Estimated Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editedTask.estimated_hours ?? ""}
                  onChange={(e) => setEditedTask({
                    ...editedTask,
                    estimated_hours: e.target.value ? parseFloat(e.target.value) : undefined,
                  })}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid gap-2">
                <Label>Actual Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editedTask.actual_hours ?? ""}
                  onChange={(e) => setEditedTask({
                    ...editedTask,
                    actual_hours: e.target.value ? parseFloat(e.target.value) : undefined,
                  })}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Created: {formatDateTime(task.created_at)}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Updated: {formatDateTime(task.updated_at)}</div>
              </div>
              <div className="space-y-2">
                <div>Task ID: {task.id}</div>
                <div>Created by: {getUserNameById(task.creator_id)}</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            <div className="grid gap-2">
              <Label>Add Comment</Label>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                  Add Comment
                </Button>
              </div>
            </div>

            {commentLoading ? (
              <div className="text-center text-muted-foreground">Loading comments...</div>
            ) : comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment, index) => (
                  <div key={comment.id ?? String(index)} className="border rounded-lg p-3">
                    <div className="text-sm font-medium">
                      {comment.user?.username || comment.user?.email || "User"}
                    </div>
                    <div className="text-sm text-muted-foreground">{comment.content}</div>
                    {comment.created_at && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(comment.created_at as string | null)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">No comments yet.</div>
            )}
          </TabsContent>

          <TabsContent value="approvals" className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Participants</h3>
                {participantsLoading && <span className="text-xs text-muted-foreground">Updating...</span>}
              </div>

              {canEdit && (
                <div className="grid grid-cols-3 gap-2">
                  <Select value={newParticipantUserId} onValueChange={setNewParticipantUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={newParticipantRole}
                    onValueChange={(value) => setNewParticipantRole(value as TaskParticipantRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TaskParticipantRole).map((role) => (
                        <SelectItem key={role} value={role}>
                          {role.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button size="sm" onClick={handleAddParticipant} disabled={!newParticipantUserId}>
                    Add
                  </Button>
                </div>
              )}

              {participants.length > 0 ? (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <div className="text-sm">
                        <div className="font-medium">{participant.user?.username || getUserNameById(participant.user_id)}</div>
                        <div className="text-xs text-muted-foreground">{participant.role}</div>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveParticipant(participant.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No participants assigned.</div>
              )}
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Approvals</h3>
                {approvalsLoading && <span className="text-xs text-muted-foreground">Updating...</span>}
              </div>

              {canEdit && (
                <div className="grid gap-2">
                  <Select value={approvalApproverId} onValueChange={setApprovalApproverId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select approver (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No approver</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Approval comment (optional)"
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleRequestApproval}>
                      Request Approval
                    </Button>
                  </div>
                </div>
              )}

              {approvals.length > 0 ? (
                <div className="space-y-2">
                  {approvals.map((approval) => (
                    <div key={approval.id} className="border rounded-lg px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={getApprovalColor(approval.status)}>
                          {approval.status.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {approval.created_at ? formatDateTime(approval.created_at) : ""}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Requested by {approval.requested_by?.username || approval.requested_by?.email || "User"}
                      </div>
                      {approval.comment && (
                        <div className="text-sm">{approval.comment}</div>
                      )}
                      {approval.status === TaskApprovalStatus.PENDING && (isApprover || canEdit) && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleDecision(approval.id, TaskApprovalStatus.APPROVED)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDecision(approval.id, TaskApprovalStatus.REJECTED)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No approval requests yet.</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="py-6 text-center text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-2" />
            History coming soon...
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpdate} disabled={isUpdating || !canEdit}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function TasksPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <TasksPageContent />
    </ProtectedRoute>
  )
}
