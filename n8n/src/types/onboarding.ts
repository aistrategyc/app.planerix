// types/onboarding.ts

import type { MembershipRole } from './roles'

export interface OrganizationCreatePayload {
  name: string
  slug?: string // будет автогенерирован если не указан
  description?: string
  industry?: 'retail' | 'it' | 'marketing' | 'education' | 'other'
  size?: 'small' | 'medium'
  address?: {
    line1?: string
    line2?: string
    city?: string
    region?: string
    country?: string // ISO-2 код
    postal_code?: string
  }
  preferences?: {
    timezone?: string
    currency?: 'PLN' | 'USD' | 'EUR'
    locale?: 'pl-PL' | 'en-US' | 'ru-RU'
    week_start?: 'monday' | 'sunday'
  }
  custom_fields?: Record<string, unknown>
}

export interface InviteItem {
  email: string
  role: MembershipRole
  department_id?: string
}

export interface DepartmentCreatePayload {
  name: string
  description?: string
  parent_id?: string
  manager_id?: string
}

export interface OrganizationResponse {
  id: string
  name: string
  slug: string
  description?: string
  industry?: string
  size?: string
  owner_id: string
  address?: Record<string, unknown>
  preferences?: Record<string, unknown>
  custom_fields?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DepartmentResponse {
  id: string
  name: string
  description?: string
  org_id: string
  parent_id?: string
  manager_id?: string
  created_at: string
  updated_at: string
}

export interface BulkInviteResponse {
  created: Array<{
    invitation_id: string
    email: string
    role: string
  }>
  errors: Array<{
    index: number
    email: string
    error: string
  }>
  total: number
}
