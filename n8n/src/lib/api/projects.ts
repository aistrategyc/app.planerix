import { api } from './config'

export const ProjectStatus = {
  ACTIVE: 'active' as const,
  COMPLETED: 'completed' as const,
  ON_HOLD: 'on_hold' as const,
  DRAFT: 'draft' as const,
  CANCELLED: 'cancelled' as const,
  ARCHIVED: 'archived' as const
} as const

export const ProjectPriority = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
  URGENT: 'urgent' as const
} as const

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]
export type ProjectPriority = (typeof ProjectPriority)[keyof typeof ProjectPriority]

const normalizeProjectStatus = (value: unknown): ProjectStatus => {
  if (!value) return ProjectStatus.DRAFT
  const raw = String(value).toLowerCase()
  if (raw === "planning") return ProjectStatus.DRAFT
  const allowed = Object.values(ProjectStatus) as string[]
  return (allowed.includes(raw) ? raw : ProjectStatus.DRAFT) as ProjectStatus
}

const normalizeProjectPriority = (value: unknown): ProjectPriority => {
  if (!value) return ProjectPriority.MEDIUM
  const raw = String(value).toLowerCase()
  if (raw === "critical") return ProjectPriority.URGENT
  const allowed = Object.values(ProjectPriority) as string[]
  return (allowed.includes(raw) ? raw : ProjectPriority.MEDIUM) as ProjectPriority
}

const normalizeProject = (project: Project): Project => ({
  ...project,
  status: normalizeProjectStatus(project.status),
  priority: project.priority ? normalizeProjectPriority(project.priority) : undefined,
})

export interface Project {
  id: string
  org_id?: string
  name: string
  description?: string
  status: ProjectStatus
  priority?: ProjectPriority
  start_date?: string
  end_date?: string
  budget?: number
  tags?: string[]
  is_public: boolean
  objective_id?: string | null
  created_at: string
  updated_at: string
  owner_id?: string
  completed_at?: string
  owner?: {
    id?: string
    username?: string
    full_name?: string
    avatar_url?: string
  }
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: string
  joined_at?: string | null
  created_at: string
  user?: {
    id?: string
    username?: string
    full_name?: string
    email?: string
    avatar_url?: string
  }
}

export interface ProjectHealth {
  project_id: string
  delivery_score: number
  kpi_score?: number | null
  risk_score: number
  health_status: string
  total_tasks: number
  completed_tasks: number
  overdue_tasks: number
  blocked_tasks: number
  in_review_tasks: number
  completion_rate: number
  kpi_on_track: number
  kpi_at_risk: number
  kpi_critical: number
  active_assignees: number
  overloaded_members: number
}

export interface ProjectCreate {
  name: string
  description?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  start_date?: string
  end_date?: string
  budget?: number
  member_ids?: string[]
  tags?: string[]
  is_public?: boolean
  objective_id?: string
}

export interface ProjectUpdate {
  name?: string
  description?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  start_date?: string
  end_date?: string
  budget?: number
  member_ids?: string[]
  tags?: string[]
  is_public?: boolean
  objective_id?: string | null
}

interface ProjectsListResponse {
  items: Project[]
  total: number
  page: number
  page_size: number
  pages: number
}

export class ProjectsAPI {
  static async list(params?: Record<string, unknown>): Promise<ProjectsListResponse> {
    const response = await api.get<ProjectsListResponse>('/projects/', { params })
    const data = response.data
    return {
      ...data,
      items: (data.items || []).map(normalizeProject),
    }
  }

  static async get(id: string): Promise<Project> {
    const response = await api.get<Project>(`/projects/${id}`)
    return normalizeProject(response.data)
  }

  static async create(data: ProjectCreate): Promise<Project> {
    const response = await api.post<Project>('/projects/', {
      ...data,
      status: data.status || 'draft',
      priority: data.priority || 'medium',
      is_public: data.is_public || false
    })
    return normalizeProject(response.data)
  }

  static async update(id: string, data: ProjectUpdate): Promise<Project> {
    const response = await api.patch<Project>(`/projects/${id}`, data)
    return normalizeProject(response.data)
  }

  static async delete(id: string): Promise<void> {
    await api.delete(`/projects/${id}`)
  }

  static async updateStatus(id: string, status: Project['status']): Promise<Project> {
    return this.update(id, { status })
  }

  static async getMembers(projectId: string): Promise<ProjectMember[]> {
    const response = await api.get<ProjectMember[]>(`/projects/${projectId}/members`)
    const data = response.data
    return Array.isArray(data) ? data : (data as { items?: ProjectMember[] })?.items ?? []
  }

  static async getHealth(projectId: string): Promise<ProjectHealth> {
    const response = await api.get<ProjectHealth>(`/projects/${projectId}/health`)
    return response.data
  }
}
