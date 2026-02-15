// src/lib/api/tasks.ts
import { api } from "@/lib/api/config"
import { CompanyAPI } from "@/lib/api/company"

// ------------ Types matching backend exactly ------------
export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  task_type: TaskType
  project_id?: string
  assignee_id?: string
  parent_task_id?: string
  creator_id?: string
  created_at: string
  updated_at: string
  due_date?: string
  start_date?: string
  estimated_hours?: number
  actual_hours?: number
  story_points?: number
  tags?: string[]
  custom_fields?: Record<string, unknown>
}

export enum TaskParticipantRole {
  CREATOR = "creator",
  ASSIGNEE = "assignee",
  RESPONSIBLE = "responsible",
  APPROVER = "approver",
  WATCHER = "watcher",
}

export enum TaskApprovalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface TaskParticipant {
  id: string
  task_id: string
  user_id: string
  role: TaskParticipantRole
  created_at: string
  user?: { username?: string; email?: string; avatar_url?: string }
}

export interface TaskApproval {
  id: string
  task_id: string
  status: TaskApprovalStatus
  requested_by_id?: string
  decided_by_id?: string
  decided_at?: string | null
  comment?: string | null
  created_at: string
  requested_by?: { username?: string; email?: string }
  decided_by?: { username?: string; email?: string }
}

export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  IN_REVIEW = "in_review", 
  BLOCKED = "blocked",
  DONE = "done",
  CANCELLED = "cancelled",
}

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED, TaskStatus.BLOCKED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.DONE, TaskStatus.TODO, TaskStatus.CANCELLED, TaskStatus.BLOCKED],
  [TaskStatus.IN_REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS, TaskStatus.TODO, TaskStatus.CANCELLED, TaskStatus.BLOCKED],
  [TaskStatus.DONE]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.CANCELLED]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS, TaskStatus.TODO, TaskStatus.CANCELLED],
}

export const getAllowedTaskStatusTransitions = (status: TaskStatus): TaskStatus[] =>
  TASK_STATUS_TRANSITIONS[status] ?? []

export const getTaskStatusOptions = (status?: TaskStatus): TaskStatus[] => {
  if (!status) return Object.values(TaskStatus)
  return Array.from(new Set([status, ...getAllowedTaskStatusTransitions(status)]))
}

export const canTransitionTaskStatus = (from: TaskStatus, to: TaskStatus): boolean =>
  from === to || getAllowedTaskStatusTransitions(from).includes(to)

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum TaskType {
  TASK = "task",
  BUG = "bug", 
  FEATURE = "feature",
  IMPROVEMENT = "improvement",
  RESEARCH = "research",
}

const normalizeTaskStatus = (value: unknown): TaskStatus => {
  if (!value) return TaskStatus.TODO
  const raw = String(value).toLowerCase()
  if (raw === "review") return TaskStatus.IN_REVIEW
  if ((Object.values(TaskStatus) as string[]).includes(raw)) return raw as TaskStatus
  return TaskStatus.TODO
}

const normalizeTaskPriority = (value: unknown): TaskPriority => {
  if (!value) return TaskPriority.MEDIUM
  const raw = String(value).toLowerCase()
  if (raw === "urgent") return TaskPriority.CRITICAL
  if ((Object.values(TaskPriority) as string[]).includes(raw)) return raw as TaskPriority
  return TaskPriority.MEDIUM
}

const normalizeTaskType = (value: unknown): TaskType => {
  if (!value) return TaskType.TASK
  const raw = String(value).toLowerCase()
  if ((Object.values(TaskType) as string[]).includes(raw)) return raw as TaskType
  return TaskType.TASK
}

const normalizeTask = (task: Task): Task => ({
  ...task,
  status: normalizeTaskStatus(task.status),
  priority: normalizeTaskPriority(task.priority),
  task_type: normalizeTaskType(task.task_type),
})

export interface TaskCreate {
  title: string
  description?: string
  priority?: TaskPriority
  task_type?: TaskType
  assignee_id?: string
  due_date?: string
  start_date?: string
  estimated_hours?: number
  story_points?: number
  tags?: string[]
  custom_fields?: Record<string, unknown>
  project_id?: string
  parent_task_id?: string
  status?: TaskStatus
}

export interface TaskUpdate {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  task_type?: TaskType
  project_id?: string
  assignee_id?: string
  due_date?: string
  start_date?: string
  estimated_hours?: number
  actual_hours?: number
  story_points?: number
  tags?: string[]
  custom_fields?: Record<string, unknown>
}

export interface TaskFilters {
  page?: number
  per_page?: number
  status?: TaskStatus
  priority?: TaskPriority
  task_type?: TaskType
  project_id?: string
  assignee_id?: string
  creator_id?: string
  watcher_id?: string
  search?: string
}

export interface TaskStats {
  user_id: string
  project_id?: string
  total_tasks: number
  status_distribution: Record<string, number>
  priority_distribution: Record<string, number>
  overdue_count: number
  completion_rate: number
  upcoming_count?: number
}

// ------------ Tasks API ------------
export class TasksAPI {
  static async getTasks(filters?: TaskFilters): Promise<Task[]> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
    }

    const q = params.toString()
    const url = q ? `tasks/?${q}` : "tasks/"

    const { data } = await api.get(url)

    // 🔧 Нормализуем ответ в массив
    const items = Array.isArray(data)
      ? data
      : data?.items ?? data?.results ?? data?.tasks ?? []

    return (items as Task[]).map(normalizeTask)
  }

  static async getTask(taskId: string): Promise<Task> {
    const { data } = await api.get(`tasks/${taskId}`)
    return normalizeTask(data as Task)
  }

  static async createTask(taskData: TaskCreate): Promise<Task> {
    const { data } = await api.post("tasks/", taskData)
    return normalizeTask(data as Task)
  }

  static async updateTask(taskId: string, taskData: TaskUpdate): Promise<Task> {
    const { data } = await api.patch(`tasks/${taskId}`, taskData)
    return normalizeTask(data as Task)
  }

  static async deleteTask(taskId: string): Promise<void> {
    await api.delete(`tasks/${taskId}`)
  }

  static async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const { data } = await api.patch(`tasks/${taskId}/status`, { status })
    return normalizeTask(data as Task)
  }

  static async updateTaskAssignment(taskId: string, assigneeId: string): Promise<Task> {
    const { data } = await api.patch(`tasks/${taskId}/assignment`, {
      assignee_id: assigneeId,
    })
    return normalizeTask(data as Task)
  }

  static async getTaskComments(taskId: string) {
    const { data } = await api.get(`tasks/${taskId}/comments`)
    return data
  }

  static async addTaskComment(taskId: string, content: string) {
    const { data } = await api.post(`tasks/${taskId}/comments`, { content })
    return data
  }

  static async getTaskWatchers(taskId: string) {
    const { data } = await api.get(`tasks/${taskId}/watchers`)
    return data
  }

  static async addTaskWatchers(taskId: string, userIds: string[]) {
    const { data } = await api.post(`tasks/${taskId}/watchers`, { user_ids: userIds })
    return data
  }

  static async removeTaskWatcher(taskId: string, userId: string) {
    await api.delete(`tasks/${taskId}/watchers/${userId}`)
  }

  static async listParticipants(taskId: string): Promise<TaskParticipant[]> {
    const { data } = await api.get(`tasks/${taskId}/participants`)
    return data || []
  }

  static async addParticipants(taskId: string, payload: { user_ids: string[]; role: TaskParticipantRole }): Promise<TaskParticipant[]> {
    const { data } = await api.post(`tasks/${taskId}/participants`, payload)
    return data || []
  }

  static async removeParticipant(taskId: string, participantId: string) {
    await api.delete(`tasks/${taskId}/participants/${participantId}`)
  }

  static async listApprovals(taskId: string): Promise<TaskApproval[]> {
    const { data } = await api.get(`tasks/${taskId}/approvals`)
    return data || []
  }

  static async requestApproval(taskId: string, payload?: { comment?: string; approver_id?: string }): Promise<TaskApproval> {
    const { data } = await api.post(`tasks/${taskId}/approvals`, payload || {})
    return data
  }

  static async decideApproval(taskId: string, approvalId: string, payload: { status: TaskApprovalStatus; comment?: string }): Promise<TaskApproval> {
    const { data } = await api.post(`tasks/${taskId}/approvals/${approvalId}/decision`, payload)
    return data
  }

  static async getTaskStats(): Promise<TaskStats> {
    const { data } = await api.get("tasks/stats")
    return data
  }
}

// ------------ Users API (для списка исполнителей) ------------
export interface User {
  id: string
  username: string
  email: string
  role?: string
  department_id?: string | null
  avatar_url?: string | null
}

export class UsersAPI {
  static async getUsers(): Promise<User[]> {
    try {
      const org = await CompanyAPI.getCurrentCompany()
      if (!org?.id) return []
      const { data } = await api.get(`orgs/${org.id}/memberships/`, { params: { expand: "user" } })
      const items = data?.items ?? data ?? []
      return items
        .map((item: { user?: User; user_id?: string; role?: string; department_id?: string | null }) => {
          const user = item.user
          if (user) {
            return {
              id: user.id,
              username: user.username || user.email || "User",
              email: user.email || "",
              role: item.role,
              department_id: item.department_id ?? null,
              avatar_url: user.avatar_url ?? null,
            }
          }
          if (item.user_id) {
            return {
              id: item.user_id,
              username: "User",
              email: "",
              role: item.role,
              department_id: item.department_id ?? null,
              avatar_url: null,
            }
          }
          return null
        })
        .filter(Boolean) as User[]
    } catch {
      return []
    }
  }

  static async searchUsers(query: string): Promise<User[]> {
    try {
      const org = await CompanyAPI.getCurrentCompany()
      if (!org?.id) return []
      const { data } = await api.get(`orgs/${org.id}/memberships/`, {
        params: { expand: "user", q: query },
      })
      const items = data?.items ?? data ?? []
      return items
        .map((item: { user?: User; user_id?: string; role?: string; department_id?: string | null }) => {
          const user = item.user
          if (user) {
            return {
              id: user.id,
              username: user.username || user.email || "User",
              email: user.email || "",
              role: item.role,
              department_id: item.department_id ?? null,
              avatar_url: user.avatar_url ?? null,
            }
          }
          if (item.user_id) {
            return {
              id: item.user_id,
              username: "User",
              email: "",
              role: item.role,
              department_id: item.department_id ?? null,
              avatar_url: null,
            }
          }
          return null
        })
        .filter(Boolean) as User[]
    } catch {
      return []
    }
  }
}

// ------------ Projects API import ------------
// Note: Full Projects API moved to @/lib/api/projects.ts
// This is a minimal interface for task-project relationships
export interface ProjectBasic {
  id: string
  name: string
  status: string
}

export class TaskProjectsAPI {
  static async getProjectsForTasks(): Promise<ProjectBasic[]> {
    const { data } = await api.get("projects/")
    return Array.isArray(data) ? data : data?.items ?? data?.results ?? []
  }
}
