// lib/onboarding.ts

import { api } from './config'
import { apiCall } from './utils'
import type {
  OrganizationCreatePayload,
  OrganizationResponse,
  DepartmentCreatePayload,
  DepartmentResponse,
  InviteItem,
  BulkInviteResponse
} from '@/types/onboarding'

export class OnboardingAPI {
  /**
   * Создать организацию
   */
  static async createOrganization(payload: OrganizationCreatePayload): Promise<OrganizationResponse> {
    return apiCall<OrganizationResponse>(
      api.post('/orgs', payload),
      { extractType: 'single', errorContext: 'Create organization' }
    )
  }

  /**
   * Создать департамент
   */
  static async createDepartment(
    orgId: string,
    payload: DepartmentCreatePayload
  ): Promise<DepartmentResponse> {
    return apiCall<DepartmentResponse>(
      api.post(`/orgs/${orgId}/departments/`, payload),
      { extractType: 'single', errorContext: 'Create department' }
    )
  }

  /**
   * Массовое приглашение пользователей (через invitations)
   * Используем правильный endpoint для приглашений по email
   */
  static async bulkInvite(
    orgId: string,
    invites: InviteItem[]
  ): Promise<BulkInviteResponse> {
    const payload = {
      memberships: invites.map((invite) => ({
        email: invite.email,
        role: invite.role || 'member',
        department_id: invite.department_id || null
      }))
    }

    return apiCall<BulkInviteResponse>(
      api.post(`/orgs/${orgId}/memberships/bulk-invite`, payload),
      { extractType: 'single', errorContext: 'Bulk invite' }
    )
  }

  /**
   * Создать отдельное приглашение
   */
  static async createInvite(
    orgId: string,
    invite: InviteItem
  ): Promise<Record<string, unknown>> {
    const payload = {
      invited_email: invite.email,
      role: invite.role || 'member',
      department_id: invite.department_id || null
    }

    return apiCall<Record<string, unknown>>(
      api.post(`/orgs/${orgId}/invitations`, payload),
      { extractType: 'single', errorContext: 'Create invite' }
    )
  }

  /**
   * Получить список организаций пользователя
   */
  static async getUserOrganizations(): Promise<OrganizationResponse[]> {
    return apiCall<OrganizationResponse[]>(
      api.get('/orgs'),
      { extractType: 'list', errorContext: 'Get user organizations' }
    )
  }

  /**
   * Проверить доступность slug
   */
  static async checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
    try {
      return await apiCall<{ available: boolean }>(
        api.get(`/orgs/check-slug/${slug}`),
        { extractType: 'single', errorContext: 'Check slug availability' }
      )
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number } }
      // Если эндпоинт не существует, считаем доступным
      if (err.message?.includes('404') || err.response?.status === 404) {
        return { available: true }
      }
      throw error
    }
  }

  /**
   * Получить организацию по ID
   */
  static async getOrganization(orgId: string): Promise<OrganizationResponse> {
    return apiCall<OrganizationResponse>(
      api.get(`/orgs/${orgId}`),
      { extractType: 'single', errorContext: 'Get organization' }
    )
  }

  /**
   * Обновить организацию
   */
  static async updateOrganization(
    orgId: string,
    payload: Partial<OrganizationCreatePayload>
  ): Promise<OrganizationResponse> {
    return apiCall<OrganizationResponse>(
      api.patch(`/orgs/${orgId}`, payload),
      { extractType: 'single', errorContext: 'Update organization' }
    )
  }

  /**
   * Получить департаменты организации
   */
  static async getDepartments(orgId: string): Promise<DepartmentResponse[]> {
    return apiCall<DepartmentResponse[]>(
      api.get(`/orgs/${orgId}/departments/`),
      { extractType: 'list', errorContext: 'Get departments' }
    )
  }

  /**
   * Получить участников организации
   */
  static async getMembers(orgId: string): Promise<Array<Record<string, unknown>>> {
    return apiCall<Array<Record<string, unknown>>>(
      api.get(`/orgs/${orgId}/memberships/`),
      { extractType: 'list', errorContext: 'Get members' }
    )
  }

  /**
   * Получить приглашения организации
   */
  static async getInvitations(): Promise<Array<Record<string, unknown>>> {
    console.warn('Invitations list endpoint is not available')
    return []
  }
}

export default OnboardingAPI
