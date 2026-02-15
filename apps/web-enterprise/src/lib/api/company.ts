// lib/api/company.ts
import { api, clearTokens, getAccessToken, isAccessTokenExpired } from '@/lib/api/config'
import type { Department, Membership, TeamMember } from '@/types/profile'

export type { Department, Membership, TeamMember } from '@/types/profile'

export interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  address?: string
  created_at: string
  updated_at: string
}
export interface ClientCreate { name: string; email?: string; phone?: string; company?: string; address?: string }
export interface ClientUpdate { name?: string; email?: string; phone?: string; company?: string; address?: string }

export interface Company extends Client {
  industry?: string
  size?: string
  description?: string
  website?: string
  logo_url?: string
  founded_year?: number
  headquarters?: string
  revenue?: string
  employees_count?: number
  business_model?: string
  target_market?: string
}

export interface CompanyStats {
  total_employees: number
  total_projects: number
  total_clients: number
  monthly_revenue?: number
  completion_rate: number
  active_projects: number
}

export interface CompanySettings {
  timezone: string
  currency: string
  language: string
  date_format: string
  working_hours: { start: string; end: string; days: string[] }
  notifications: { email_reports: boolean; project_updates: boolean; task_reminders: boolean }
}

export interface MembershipWithUser extends Membership {
  user?: {
    id: string
    username?: string
    email?: string
    full_name?: string
    avatar_url?: string | null
    is_active?: boolean
    is_verified?: boolean
    last_login_at?: string | null
    timezone?: string | null
    language?: string | null
  }
}

const ORG_CACHE_TTL_MS = 15_000
let orgCache: { value: Company | null; fetchedAt: number } | null = null
let orgPromise: Promise<Company | null> | null = null

const isCacheFresh = () => orgCache && Date.now() - orgCache.fetchedAt < ORG_CACHE_TTL_MS

export class CompanyAPI {
  static clearOrgCache(): void {
    orgCache = null
    orgPromise = null
  }
  // Clients
  static async getClients(): Promise<Client[]> {
    const { data } = await api.get('clients/')
    return data
  }

  static async getClient(clientId: string): Promise<Client> {
    const { data } = await api.get(`clients/${clientId}`)
    return data
  }

  static async createClient(clientData: ClientCreate): Promise<Client> {
    const { data } = await api.post('clients/', clientData)
    return data
  }

  static async updateClient(clientId: string, updates: ClientUpdate): Promise<Client> {
    const { data } = await api.put(`clients/${clientId}`, updates)
    return data
  }

  static async deleteClient(clientId: string): Promise<void> {
    await api.delete(`clients/${clientId}`)
  }

  // Company (Organization)
  static async getCurrentCompany(): Promise<Company | null> {
    const token = getAccessToken()
    if (!token) return null
    if (isAccessTokenExpired(token)) {
      clearTokens()
      return null
    }
    if (isCacheFresh()) return orgCache!.value
    if (orgPromise) return orgPromise

    orgPromise = (async () => {
      try {
        const resp = await api.get('orgs/')
        const list = resp.data?.items ?? resp.data ?? []
        const value = Array.isArray(list) && list.length ? list[0] : null
        orgCache = { value, fetchedAt: Date.now() }
        return value
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 401 || status === 403) {
          clearTokens()
          orgCache = { value: null, fetchedAt: Date.now() }
          return null
        }
        orgCache = { value: null, fetchedAt: Date.now() }
        throw err
      }
    })()

    try {
      return await orgPromise
    } finally {
      orgPromise = null
    }
  }

  static async getCurrentMembership(): Promise<MembershipWithUser | null> {
    const org = await CompanyAPI.getCurrentCompany()
    if (!org?.id) return null

    const { data } = await api.get<MembershipWithUser>(`orgs/${org.id}/memberships/me`, {
      params: { expand: 'user' },
    })
    return data ?? null
  }

  static async updateCompany(companyData: Partial<Company>): Promise<Company> {
    const current = await CompanyAPI.getCurrentCompany()
    if (current?.id) {
      const orgId = current.id
      const { data } = await api.patch(`orgs/${orgId}`, companyData)
      orgCache = { value: data ?? current, fetchedAt: Date.now() }
      return data
    }

    const name = companyData.name || 'My Company'
    const { data } = await api.post('orgs/', { name, ...companyData })
    orgCache = { value: data, fetchedAt: Date.now() }
    return data
  }

  static async createCompany(companyData: {
    name: string
    description?: string
    website?: string
    industry?: string
    size?: string
  }): Promise<Company> {
    const { data } = await api.post('orgs/', companyData)
    return data
  }

  static async getCompanyStats(): Promise<CompanyStats> {
    try {
      const org = await CompanyAPI.getCurrentCompany()
      if (!org?.id) {
        return { total_employees: 0, total_projects: 0, total_clients: 0, completion_rate: 0, active_projects: 0 }
      }

      const orgId = org.id
      const membershipsResp = await api.get(`orgs/${orgId}/memberships/`)
      const memberships = membershipsResp.data?.items ?? membershipsResp.data ?? []

      let projects: Array<{ status?: string }> = []
      try {
        const projectsResponse = await api.get('projects/')
        projects = projectsResponse.data?.items ?? projectsResponse.data ?? []
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status
        if (status === 401) throw e
        console.warn('Projects API not available:', e)
      }

      let clients: Array<Record<string, unknown>> = []
      try {
        const clientsResponse = await api.get('clients/')
        clients = clientsResponse.data?.items ?? clientsResponse.data ?? []
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status
        if (status === 401) throw e
        console.warn('Clients API not available:', e)
      }

      return {
        total_employees: memberships.length || 0,
        total_projects: projects.length || 0,
        total_clients: clients.length || 0,
        completion_rate: 85,
        active_projects: projects.filter((p) => p.status === 'active').length || 0,
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 401) throw error
      console.error('Failed to fetch company stats:', error)
      return { total_employees: 0, total_projects: 0, total_clients: 0, completion_rate: 0, active_projects: 0 }
    }
  }

  // Departments
  static async getDepartments(orgId: string): Promise<Department[]> {
    const { data } = await api.get(`orgs/${orgId}/departments/`)
    return data?.items ?? data
  }

  static async createDepartment(
    orgId: string,
    departmentData: { name: string; description?: string; parent_id?: string; manager_id?: string }
  ): Promise<Department> {
    const { data } = await api.post(`orgs/${orgId}/departments/`, departmentData)
    return data
  }

  static async updateDepartment(
    orgId: string,
    deptId: string,
    updates: { name?: string; description?: string; manager_id?: string }
  ): Promise<Department> {
    const { data } = await api.patch(`orgs/${orgId}/departments/${deptId}`, updates)
    return data
  }

  static async deleteDepartment(orgId: string, deptId: string): Promise<void> {
    await api.delete(`orgs/${orgId}/departments/${deptId}`)
  }

  static async getDepartmentStats(orgId: string, deptId: string): Promise<Record<string, unknown>> {
    const { data } = await api.get(`orgs/${orgId}/departments/${deptId}/stats`)
    return data
  }

  // Team
  static async getTeamMembers(orgId: string): Promise<TeamMember[]> {
    const membershipsResp = await api.get(`orgs/${orgId}/memberships/`, { params: { expand: 'user' } })
    const membershipItems: Array<{
      user_id: string
      role: string
      department_id?: string | null
      user?: { id: string; username?: string; email?: string; avatar_url?: string; is_active?: boolean; last_login_at?: string }
    }> = membershipsResp.data?.items ?? membershipsResp.data ?? []

    return membershipItems
      .map((membership) => {
        const user = membership.user
        if (!user) return null
        return {
          id: user.id,
          username: user.username || user.email || 'User',
          email: user.email || '',
          role: membership.role,
          department_id: membership.department_id ?? null,
          avatar_url: user.avatar_url ?? null,
          is_active: user.is_active ?? true,
          last_login_at: user.last_login_at ?? null,
        }
      })
      .filter(Boolean) as TeamMember[]
  }

  static async inviteEmployee(orgId: string, email: string, role: string, departmentId?: string): Promise<void> {
    await api.post(`orgs/${orgId}/invitations`, {
      invited_email: email,
      role,
      department_id: departmentId,
    })
  }

  static async updateMemberRole(orgId: string, membershipId: string, role: string, departmentId?: string): Promise<Membership> {
    const { data } = await api.patch(`orgs/${orgId}/memberships/${membershipId}`, { role, department_id: departmentId })
    return data
  }

  static async removeEmployee(orgId: string, membershipId: string): Promise<void> {
    await api.delete(`orgs/${orgId}/memberships/${membershipId}`)
  }

  // Settings (mock)
  static async getCompanySettings(): Promise<CompanySettings> {
    return {
      timezone: 'UTC',
      currency: 'USD',
      language: 'en',
      date_format: 'MM/DD/YYYY',
      working_hours: { start: '09:00', end: '17:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
      notifications: { email_reports: true, project_updates: true, task_reminders: true },
    }
  }

  static async updateCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const current = await this.getCompanySettings()
    return { ...current, ...settings }
  }
}
