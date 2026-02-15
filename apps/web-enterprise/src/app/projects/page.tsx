"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState"
import { EmptyState } from "@/components/ui/empty-state"
import { PageLoader } from "@/components/ui/loading-spinner"
import { PageHeader } from "@/components/layout/PageHeader"

import {
  Plus,
  Search,
  FolderOpen,
  Calendar,
  Users,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Edit3,
  Trash2,
  Loader2,
  Award
} from "lucide-react"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { ProjectsAPI, type Project, type ProjectCreate, type ProjectMember, type ProjectHealth, ProjectStatus, ProjectPriority } from "@/lib/api/projects"
import { TasksAPI, TaskStatus, type Task } from "@/lib/api/tasks"
import { useAuth } from "@/contexts/auth-context"

const EMPTY_PROJECT: ProjectCreate = {
  name: "",
  description: "",
  status: ProjectStatus.DRAFT,
  priority: ProjectPriority.MEDIUM,
  start_date: "",
  end_date: "",
  budget: undefined,
  is_public: true,
  tags: [],
  member_ids: []
}

interface ProjectsPageState {
  projects: Project[]
  loading: boolean
  error: string | null
  selectedProject: Project | null
  showCreateDialog: boolean
  showDetailDialog: boolean
  searchQuery: string
  filterStatus: string
  filterPriority: string
  filterScope: ProjectScope
  page: number
  totalPages: number
}

type ProjectScope = "all" | "mine" | "participating" | "watching"
const PROJECT_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
}

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const candidate = err as { response?: { data?: { detail?: unknown } }; message?: unknown }
    const detail = candidate.response?.data?.detail
    if (typeof detail === "string") return detail
    if (typeof candidate.message === "string") return candidate.message
  }
  return fallback
}

export default function ProjectsPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <ProjectsPageContent />
    </ProtectedRoute>
  )
}

function ProjectsPageContent() {
  const { toast } = useToast()
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const currentUserId = currentUser?.id

  const [state, setState] = useState<ProjectsPageState>({
    projects: [],
    loading: true,
    error: null,
    selectedProject: null,
    showCreateDialog: false,
    showDetailDialog: false,
    searchQuery: "",
    filterStatus: "all",
    filterPriority: "all",
    filterScope: "all",
    page: 1,
    totalPages: 1
  })
  const [projectMembersById, setProjectMembersById] = useState<Record<string, ProjectMember[]>>({})
  const [projectTasksById, setProjectTasksById] = useState<Record<string, Task[]>>({})
  const [projectTasksLoading, setProjectTasksLoading] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [projectHealthById, setProjectHealthById] = useState<Record<string, ProjectHealth | null>>({})
  const [projectHealthLoading, setProjectHealthLoading] = useState(false)

  const [newProject, setNewProject] = useState<ProjectCreate>({ ...EMPTY_PROJECT })

  // Load projects
  const loadProjects = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const params: Record<string, string | number> = {
        page: state.page,
        page_size: 20
      }

      if (state.searchQuery) params.search = state.searchQuery
      if (state.filterStatus !== "all") params.status = state.filterStatus
      if (state.filterPriority !== "all") params.priority = state.filterPriority

      const response = await ProjectsAPI.list(params)

      setState(prev => ({
        ...prev,
        projects: response.items,
        totalPages: Math.ceil(response.total / response.page_size),
        loading: false,
        error: null,
      }))
    } catch (error) {
      console.error("Failed to load projects:", error)
      const message = getErrorMessage(error, "Failed to load projects")
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      })
      setState(prev => ({ ...prev, loading: false, error: message }))
    }
  }, [state.page, state.searchQuery, state.filterStatus, state.filterPriority, toast])

  // Load projects on mount and filter changes
  useEffect(() => {
    const timer = setTimeout(loadProjects, 300)
    return () => clearTimeout(timer)
  }, [loadProjects])

  useEffect(() => {
    let active = true
    const loadMembers = async () => {
      if (!state.projects.length) {
        if (active) setProjectMembersById({})
        return
      }
      const entries = await Promise.all(
        state.projects.map(async (project) => {
          try {
            const members = await ProjectsAPI.getMembers(project.id)
            return [project.id, members] as const
          } catch {
            return [project.id, []] as const
          }
        })
      )
      if (active) setProjectMembersById(Object.fromEntries(entries))
    }

    loadMembers()
    return () => {
      active = false
    }
  }, [state.projects])

  useEffect(() => {
    let active = true
    const loadProjectTasks = async () => {
      if (!state.selectedProject || !state.showDetailDialog) return
      setProjectTasksLoading(true)
      try {
        const items = await TasksAPI.getTasks({ project_id: state.selectedProject.id, per_page: 50 })
        if (!active) return
        setProjectTasksById((prev) => ({ ...prev, [state.selectedProject!.id]: items }))
      } catch {
        if (!active) return
        setProjectTasksById((prev) => ({ ...prev, [state.selectedProject!.id]: [] }))
      } finally {
        if (active) setProjectTasksLoading(false)
      }
    }

    loadProjectTasks()
    return () => {
      active = false
    }
  }, [state.selectedProject, state.showDetailDialog])

  useEffect(() => {
    let active = true
    const loadProjectHealth = async () => {
      if (!state.selectedProject || !state.showDetailDialog) return
      setProjectHealthLoading(true)
      try {
        const health = await ProjectsAPI.getHealth(state.selectedProject.id)
        if (active) {
          setProjectHealthById((prev) => ({ ...prev, [state.selectedProject!.id]: health }))
        }
      } catch {
        if (active) {
          setProjectHealthById((prev) => ({ ...prev, [state.selectedProject!.id]: null }))
        }
      } finally {
        if (active) setProjectHealthLoading(false)
      }
    }

    loadProjectHealth()
    return () => {
      active = false
    }
  }, [state.selectedProject, state.showDetailDialog])

  // Create project
  const resetProjectForm = useCallback(() => {
    setNewProject({ ...EMPTY_PROJECT })
  }, [])

  const handleSaveProject = useCallback(async () => {
    if (!newProject.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required",
        variant: "destructive"
      })
      return
    }

    try {
      const payload = {
        ...newProject,
        name: newProject.name.trim(),
        description: newProject.description?.trim() || undefined
      }
      if (editingProjectId) {
        const updated = await ProjectsAPI.update(editingProjectId, payload)
        toast({
          title: "Success",
          description: "Project updated successfully"
        })
        setState(prev => ({
          ...prev,
          showCreateDialog: false,
          projects: prev.projects.map(project => project.id === editingProjectId ? updated : project),
          selectedProject: prev.selectedProject?.id === editingProjectId ? updated : prev.selectedProject
        }))
      } else {
        const created = await ProjectsAPI.create(payload)
        toast({
          title: "Success",
          description: "Project created successfully"
        })
        setState(prev => ({
          ...prev,
          showCreateDialog: false,
          projects: [created, ...prev.projects]
        }))
      }
      setEditingProjectId(null)
      resetProjectForm()
    } catch (error) {
      console.error("Failed to create project:", error)
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive"
      })
    }
  }, [newProject, toast, editingProjectId, resetProjectForm])

  const openEditProject = useCallback((project: Project) => {
    setEditingProjectId(project.id)
    setNewProject({
      name: project.name,
      description: project.description ?? "",
      status: project.status ?? ProjectStatus.DRAFT,
      priority: project.priority ?? ProjectPriority.MEDIUM,
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
      budget: project.budget ?? undefined,
      is_public: project.is_public ?? true,
      tags: project.tags ?? [],
      member_ids: []
    })
    setState(prev => ({ ...prev, showDetailDialog: false, showCreateDialog: true }))
  }, [])

  // Update project
  // Delete project
  const handleDeleteProject = useCallback(async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      await ProjectsAPI.delete(id)
      toast({
        title: "Success",
        description: "Project deleted successfully"
      })
      setState(prev => ({ ...prev, showDetailDialog: false }))
      loadProjects()
    } catch (error) {
      console.error("Failed to delete project:", error)
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive"
      })
    }
  }, [toast, loadProjects])

  // Get status color
  const getStatusColor = (status?: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.DRAFT: return "bg-slate-100 text-slate-800"
      case ProjectStatus.ACTIVE: return "bg-blue-100 text-blue-800"
      case ProjectStatus.ON_HOLD: return "bg-yellow-100 text-yellow-800"
      case ProjectStatus.COMPLETED: return "bg-green-100 text-green-800"
      case ProjectStatus.CANCELLED: return "bg-red-100 text-red-800"
      case ProjectStatus.ARCHIVED: return "bg-slate-100 text-slate-600"
      default: return "bg-slate-100 text-slate-800"
    }
  }

  const getHealthTone = (status?: string) => {
    switch ((status || "").toLowerCase()) {
      case "green":
        return "bg-emerald-100 text-emerald-800"
      case "yellow":
        return "bg-amber-100 text-amber-800"
      case "red":
        return "bg-rose-100 text-rose-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  // Get priority color
  const getPriorityColor = (priority?: ProjectPriority) => {
    switch (priority) {
      case ProjectPriority.LOW: return "bg-green-500 text-white"
      case ProjectPriority.MEDIUM: return "bg-yellow-500 text-white"
      case ProjectPriority.HIGH: return "bg-orange-500 text-white"
      case ProjectPriority.URGENT: return "bg-red-500 text-white"
      default: return "bg-slate-500 text-white"
    }
  }

  // Get status icon
  const getStatusIcon = (status?: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.DRAFT: return <Clock className="w-4 h-4" />
      case ProjectStatus.ACTIVE: return <Target className="w-4 h-4" />
      case ProjectStatus.ON_HOLD: return <AlertTriangle className="w-4 h-4" />
      case ProjectStatus.COMPLETED: return <CheckCircle2 className="w-4 h-4" />
      case ProjectStatus.CANCELLED: return <AlertTriangle className="w-4 h-4" />
      case ProjectStatus.ARCHIVED: return <Clock className="w-4 h-4" />
      default: return <FolderOpen className="w-4 h-4" />
    }
  }

  // Get user initials
  const getInitials = (name?: string) => {
    if (!name) return "?"
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const formatDate = (value?: string | null) => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleDateString()
  }

  const getMemberDisplayName = (member?: ProjectMember | null) => {
    if (!member) return "Member"
    const user = member.user
    return (
      user?.full_name ||
      user?.username ||
      user?.email ||
      (member.user_id ? `User ${member.user_id.slice(0, 8)}` : "Member")
    )
  }

  const getMemberEmail = (member?: ProjectMember | null) => {
    const user = member?.user
    return user?.email || ""
  }

  const getProjectMembers = useCallback(
    (projectId: string) => projectMembersById[projectId] ?? [],
    [projectMembersById]
  )

  const getMemberUser = useCallback(
    (projectId: string, userId?: string) => {
      if (!userId) return null
      return getProjectMembers(projectId).find((member) => member.user_id === userId)?.user ?? null
    },
    [getProjectMembers]
  )

  const projectRoleById = useMemo(() => {
    const map = new Map<string, string>()
    if (!currentUserId) return map
    Object.entries(projectMembersById).forEach(([projectId, members]) => {
      const role = members.find((member) => member.user_id === currentUserId)?.role
      if (role) map.set(projectId, role)
    })
    return map
  }, [projectMembersById, currentUserId])

  const selectedProjectRole = useMemo(() => {
    if (!state.selectedProject) return undefined
    return projectRoleById.get(state.selectedProject.id)
  }, [state.selectedProject, projectRoleById])

  const canManageSelectedProject = Boolean(
    state.selectedProject &&
      (selectedProjectRole ? selectedProjectRole !== "viewer" : state.selectedProject.owner_id === currentUserId)
  )

  // Statistics
  const scopeFilteredProjects = useMemo(() => {
    if (!currentUserId || state.filterScope === "all") return state.projects
    return state.projects.filter((project) => {
      const role = projectRoleById.get(project.id)
      const isOwner = project.owner_id === currentUserId || role === "owner" || role === "admin"
      const isViewer = role === "viewer"
      const isMember = role === "member" || role === "admin" || role === "owner"

      if (state.filterScope === "mine") return isOwner
      if (state.filterScope === "participating") return isMember && !isOwner
      if (state.filterScope === "watching") return isViewer
      return true
    })
  }, [state.projects, state.filterScope, currentUserId, projectRoleById])

  const stats = useMemo(() => {
    const total = scopeFilteredProjects.length
    const active = scopeFilteredProjects.filter(p => p.status === ProjectStatus.ACTIVE).length
    const completed = scopeFilteredProjects.filter(p => p.status === ProjectStatus.COMPLETED).length
    const onHold = scopeFilteredProjects.filter(p => p.status === ProjectStatus.ON_HOLD).length

    return { total, active, completed, onHold }
  }, [scopeFilteredProjects])
  const hasActiveFilters =
    Boolean(state.searchQuery) ||
    state.filterStatus !== "all" ||
    state.filterPriority !== "all" ||
    state.filterScope !== "all"

  const getCompletionPercentage = useCallback((project: Project) => {
    const tasks = projectTasksById[project.id] ?? []
    if (tasks.length) {
      const completed = tasks.filter((task) => task.status === TaskStatus.DONE).length
      return Math.round((completed / tasks.length) * 100)
    }
    if (project.status === ProjectStatus.COMPLETED) return 100
    if (project.status === ProjectStatus.CANCELLED) return 0
    return 0
  }, [projectTasksById])

  if (state.loading && state.projects.length === 0) {
    return <PageLoader text="Загрузка проектов..." />
  }

  if (state.error && state.projects.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Не удалось загрузить проекты"
          description={state.error}
          action={{
            label: "Повторить",
            onClick: loadProjects,
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Track delivery, ownership, and team progress across initiatives."
        meta={<Badge variant="outline">Project Management</Badge>}
        actions={(
          <Dialog
            open={state.showCreateDialog}
            onOpenChange={(open) => {
              setState(prev => ({ ...prev, showCreateDialog: open }))
              if (!open) {
                setEditingProjectId(null)
                resetProjectForm()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {editingProjectId ? "Edit Project" : "New Project"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingProjectId ? "Edit Project" : "Create New Project"}</DialogTitle>
                <DialogDescription>
                  {editingProjectId
                    ? "Update project details and timeline."
                    : "Start a new project to organize your work and collaborate with your team."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    placeholder="Enter project name..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Brief project description..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newProject.status}
                      onValueChange={(value) => setNewProject({ ...newProject, status: value as ProjectStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ProjectStatus.DRAFT}>Draft</SelectItem>
                        <SelectItem value={ProjectStatus.ACTIVE}>Active</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newProject.priority}
                      onValueChange={(value) => setNewProject({ ...newProject, priority: value as ProjectPriority })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ProjectPriority.LOW}>Low</SelectItem>
                        <SelectItem value={ProjectPriority.MEDIUM}>Medium</SelectItem>
                        <SelectItem value={ProjectPriority.HIGH}>High</SelectItem>
                        <SelectItem value={ProjectPriority.URGENT}>Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newProject.start_date}
                      onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={newProject.end_date}
                      onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="budget">Budget ($)</Label>
                  <Input
                    id="budget"
                    type="number"
                    min="0"
                    step="100"
                    value={newProject.budget || ""}
                    onChange={(e) => setNewProject({
                      ...newProject,
                      budget: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    placeholder="Project budget"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setState(prev => ({ ...prev, showCreateDialog: false }))}>
                  Cancel
                </Button>
                <Button onClick={handleSaveProject}>
                  {editingProjectId ? "Save Changes" : "Create Project"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <Card className="border-muted/70 shadow-sm glass-panel">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={state.searchQuery}
              onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="pl-8 w-full sm:w-64"
            />
          </div>

          <Select
            value={state.filterStatus}
            onValueChange={(value) => setState(prev => ({ ...prev, filterStatus: value }))}
          >
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value={ProjectStatus.DRAFT}>Draft</SelectItem>
              <SelectItem value={ProjectStatus.ACTIVE}>Active</SelectItem>
              <SelectItem value={ProjectStatus.ON_HOLD}>On Hold</SelectItem>
              <SelectItem value={ProjectStatus.COMPLETED}>Completed</SelectItem>
              <SelectItem value={ProjectStatus.CANCELLED}>Cancelled</SelectItem>
              <SelectItem value={ProjectStatus.ARCHIVED}>Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={state.filterPriority}
            onValueChange={(value) => setState(prev => ({ ...prev, filterPriority: value }))}
          >
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value={ProjectPriority.LOW}>Low</SelectItem>
              <SelectItem value={ProjectPriority.MEDIUM}>Medium</SelectItem>
              <SelectItem value={ProjectPriority.HIGH}>High</SelectItem>
              <SelectItem value={ProjectPriority.URGENT}>Urgent</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={state.filterScope}
            onValueChange={(value) => setState(prev => ({ ...prev, filterScope: value as ProjectScope }))}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="mine">My Projects</SelectItem>
              <SelectItem value="participating">Participating</SelectItem>
              <SelectItem value="watching">Watching</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-600" />
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
              <Award className="w-4 h-4 text-primary" />
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
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">On Hold</p>
                <p className="text-2xl font-bold">{stats.onHold}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scopeFilteredProjects.map((project) => {
          const members = getProjectMembers(project.id)
          const ownerUser = project.owner ?? getMemberUser(project.id, project.owner_id ?? undefined)
          const myRole = projectRoleById.get(project.id)
          return (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-border/60 bg-card/40"
              onClick={() => setState(prev => ({ ...prev, selectedProject: project, showDetailDialog: true }))}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold truncate">{project.name}</h3>
                        {project.priority ? (
                          <Badge className={getPriorityColor(project.priority)} variant="secondary">
                            {project.priority.toUpperCase()}
                          </Badge>
                        ) : (
                          <Badge variant="outline">NO PRIORITY</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getStatusColor(project.status)} variant="outline">
                          {getStatusIcon(project.status)}
                          <span className="ml-1">
                            {project.status ? project.status.replace("_", " ").toUpperCase() : "UNKNOWN"}
                          </span>
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  {ownerUser && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={ownerUser.avatar_url} />
                        <AvatarFallback className="text-[9px]">
                          {getInitials(ownerUser.full_name || ownerUser.username)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">
                        {ownerUser.full_name || ownerUser.username || "Owner not set"}
                      </span>
                    </div>
                  )}

                  {(project.start_date || project.end_date) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {formatDate(project.start_date)}{" "}
                        →{" "}
                        {formatDate(project.end_date)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {projectTasksById[project.id]?.length
                        ? `Progress ${getCompletionPercentage(project)}%`
                        : "Progress will appear once tasks are linked."}
                    </span>
                    {myRole && (
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {PROJECT_ROLE_LABELS[myRole] || myRole}
                      </Badge>
                    )}
                  </div>
                  {projectTasksById[project.id]?.length ? (
                    <Progress value={getCompletionPercentage(project)} className="h-2" />
                  ) : null}

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{members.length} members</span>
                    </div>
                    {project.budget && (
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        <span>${project.budget.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {members.length > 0 && (
                    <div className="flex -space-x-2">
                      {members.slice(0, 4).map((member) => (
                        <Avatar key={member.id} className="w-7 h-7 border-2 border-white">
                          <AvatarImage src={member.user?.avatar_url} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(getMemberDisplayName(member))}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {members.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-muted border-2 border-white flex items-center justify-center text-[10px] text-muted-foreground">
                          +{members.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {scopeFilteredProjects.length === 0 && !state.loading && (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-12 text-center">
                {hasActiveFilters ? (
                  <>
                    <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No projects found</h3>
                    <p className="text-muted-foreground mb-4">
                      Try adjusting your filters or search terms.
                    </p>
                    <Button onClick={() => setState(prev => ({ ...prev, showCreateDialog: true }))}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Project
                    </Button>
                  </>
                ) : (
                  <AnalyticsEmptyState
                    context="projects"
                    title="Пока нет проектов"
                    description="Создайте первый проект, чтобы распределить задачи и участников."
                    showRequest={false}
                    primaryAction={{
                      label: "Создать проект",
                      onClick: () => setState(prev => ({ ...prev, showCreateDialog: true })),
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Pagination */}
      {state.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={state.page <= 1}
            onClick={() => setState(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {state.page} of {state.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={state.page >= state.totalPages}
            onClick={() => setState(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Project Detail Dialog */}
      <Dialog open={state.showDetailDialog} onOpenChange={(open) => setState(prev => ({ ...prev, showDetailDialog: open }))}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          {state.selectedProject && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  {state.selectedProject.name}
                  <Badge className={getPriorityColor(state.selectedProject.priority)} variant="secondary">
                    {state.selectedProject.priority ? state.selectedProject.priority.toUpperCase() : "NO PRIORITY"}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {state.selectedProject.status
                    ? state.selectedProject.status.replace("_", " ").toUpperCase()
                    : "UNKNOWN"} •
                  Created {formatDate(state.selectedProject.created_at)}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="members">
                    Members ({getProjectMembers(state.selectedProject.id).length})
                  </TabsTrigger>
                  <TabsTrigger value="tasks">
                    Tasks ({projectTasksById[state.selectedProject.id]?.length ?? 0})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4">
                    {state.selectedProject.description && (
                      <div>
                        <Label>Description</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {state.selectedProject.description}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Status</Label>
                        <Badge className={getStatusColor(state.selectedProject.status)} variant="outline">
                          {getStatusIcon(state.selectedProject.status)}
                          <span className="ml-1">
                            {state.selectedProject.status
                              ? state.selectedProject.status.replace("_", " ").toUpperCase()
                              : "UNKNOWN"}
                          </span>
                        </Badge>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Badge className={getPriorityColor(state.selectedProject.priority)} variant="secondary">
                          {state.selectedProject.priority ? state.selectedProject.priority.toUpperCase() : "NO PRIORITY"}
                        </Badge>
                      </div>
                    </div>

                    {(state.selectedProject.start_date || state.selectedProject.end_date) && (
                      <div className="grid grid-cols-2 gap-4">
                        {state.selectedProject.start_date && (
                          <div>
                            <Label>Start Date</Label>
                            <p className="text-sm">{formatDate(state.selectedProject.start_date)}</p>
                          </div>
                        )}
                        {state.selectedProject.end_date && (
                          <div>
                            <Label>End Date</Label>
                            <p className="text-sm">{formatDate(state.selectedProject.end_date)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {state.selectedProject.budget && (
                      <div>
                        <Label>Budget</Label>
                        <p className="text-sm">${state.selectedProject.budget.toLocaleString()}</p>
                      </div>
                    )}

                    <div>
                      <Label>Owner</Label>
                      <div className="flex items-center gap-2 mt-1">
                        {(() => {
                          const selectedOwner = getMemberUser(
                            state.selectedProject.id,
                            state.selectedProject.owner_id ?? undefined
                          )
                          const ownerDisplayName =
                            selectedOwner?.full_name ||
                            selectedOwner?.username ||
                            selectedOwner?.email ||
                            (state.selectedProject.owner_id
                              ? `Owner ${state.selectedProject.owner_id.slice(0, 8)}`
                              : "Owner not set")
                          return (
                            <>
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={selectedOwner?.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(ownerDisplayName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{ownerDisplayName}</span>
                            </>
                          )
                        })()}
                      </div>
                    </div>

                    <div>
                      <Label>Progress</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={getCompletionPercentage(state.selectedProject)} className="flex-1" />
                        <span className="text-sm font-medium">{getCompletionPercentage(state.selectedProject)}%</span>
                      </div>
                    </div>

                    <div>
                      <Label>Project Health</Label>
                      {projectHealthLoading ? (
                        <div className="text-sm text-muted-foreground mt-2">Calculating health...</div>
                      ) : (
                        (() => {
                          const health = projectHealthById[state.selectedProject!.id]
                          if (!health) {
                            return <div className="text-sm text-muted-foreground mt-2">No health data available.</div>
                          }
                          return (
                            <div className="space-y-3 mt-2">
                              <div className="flex items-center gap-2">
                                <Badge className={getHealthTone(health.health_status)} variant="outline">
                                  {health.health_status.toUpperCase()}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Delivery {Math.round(health.delivery_score)} • Risk {Math.round(health.risk_score)}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                                <div>
                                  <div className="text-foreground font-medium">{health.overdue_tasks}</div>
                                  Overdue tasks
                                </div>
                                <div>
                                  <div className="text-foreground font-medium">{health.blocked_tasks}</div>
                                  Blocked tasks
                                </div>
                                <div>
                                  <div className="text-foreground font-medium">{health.overloaded_members}</div>
                                  Overloaded
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span>Delivery</span>
                                    <span>{Math.round(health.delivery_score)}%</span>
                                  </div>
                                  <Progress value={health.delivery_score} className="h-2" />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span>KPI</span>
                                    <span>{health.kpi_score !== null && health.kpi_score !== undefined ? Math.round(health.kpi_score) : "—"}</span>
                                  </div>
                                  <Progress value={health.kpi_score || 0} className="h-2" />
                                </div>
                              </div>
                            </div>
                          )
                        })()
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="members" className="space-y-4">
                  {getProjectMembers(state.selectedProject.id).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4" />
                      <p>No members added yet</p>
                      <Button className="mt-4" variant="outline" disabled={!canManageSelectedProject}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Members
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {getProjectMembers(state.selectedProject.id).map((member) => (
                        <Card key={member.id}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9">
                                <AvatarImage src={member.user?.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(getMemberDisplayName(member))}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{getMemberDisplayName(member)}</div>
                                {getMemberEmail(member) && (
                                  <div className="text-xs text-muted-foreground">{getMemberEmail(member)}</div>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="uppercase text-[10px]">
                              {PROJECT_ROLE_LABELS[member.role] || member.role}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4">
                  {projectTasksLoading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading project tasks...
                    </div>
                  ) : projectTasksById[state.selectedProject.id]?.length ? (
                    <div className="grid gap-3">
                      {projectTasksById[state.selectedProject.id]!.map((task) => (
                        <Card key={task.id}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-xs text-muted-foreground line-clamp-1">
                                  {task.description}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="uppercase text-[10px]">
                              {task.status ? task.status.replace("_", " ") : "unknown"}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="w-12 h-12 mx-auto mb-4" />
                      <p>No tasks created yet</p>
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => router.push('/tasks')}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Tasks
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  {canManageSelectedProject && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditProject(state.selectedProject!)}
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteProject(state.selectedProject!.id, state.selectedProject!.name)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
                <Button size="sm" onClick={() => setState(prev => ({ ...prev, showDetailDialog: false }))}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
