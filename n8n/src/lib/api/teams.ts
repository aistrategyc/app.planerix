import { api } from "@/lib/api/config"
import { CompanyAPI } from "@/lib/api/company"
import { MembershipRole } from "@/types/roles"

export interface TeamMember {
  id: string
  name: string
  email: string
  role: MembershipRole
  department?: string | null
  position?: string | null
  avatar_url?: string | null
  join_date?: string | null
  status?: string | null
  tasks_completed: number
  projects_active: number
  tasks_open: number
  tasks_overdue: number
  tasks_in_review: number
  tasks_blocked: number
}

export interface TeamPolicy {
  default_approver_role?: MembershipRole
  escalation_days?: number
  weekly_digest_recipients?: string[]
}

export interface Team {
  id: string
  name: string
  description?: string | null
  department?: string | null
  lead?: string | null
  policy?: TeamPolicy | null
  members: TeamMember[]
  projects: number
  tasks_open: number
  tasks_overdue: number
  tasks_in_review: number
  tasks_blocked: number
  created_at?: string | null
}

export interface TeamListResponse {
  items: Team[]
  total: number
}

async function getDefaultOrgId(): Promise<string | null> {
  const org = await CompanyAPI.getCurrentCompany()
  return org?.id ?? null
}

export async function getTeams(orgId?: string): Promise<Team[]> {
  const resolvedOrgId = orgId ?? (await getDefaultOrgId())
  if (!resolvedOrgId) return []
  const { data } = await api.get<TeamListResponse>(`/orgs/${resolvedOrgId}/teams/`)
  return data.items ?? []
}

export async function createTeam(payload: {
  name: string
  description?: string
  manager_id?: string
  policy?: TeamPolicy
}): Promise<void> {
  const orgId = await getDefaultOrgId()
  if (!orgId) return
  await api.post(`/orgs/${orgId}/departments/`, {
    name: payload.name,
    description: payload.description,
    manager_id: payload.manager_id,
    policy: payload.policy,
  })
}

export async function inviteTeamMember(payload: {
  email: string
  role: MembershipRole
  department_id?: string
}): Promise<void> {
  const orgId = await getDefaultOrgId()
  if (!orgId) return
  await api.post(`/orgs/${orgId}/invitations`, {
    invited_email: payload.email,
    role: payload.role,
    department_id: payload.department_id,
  })
}
