import { api } from "@/lib/api/config"
import { CompanyAPI } from "@/lib/api/company"

export type CRMContactStatus = "lead" | "prospect" | "customer" | "inactive"
export type CRMContactPriority = "low" | "medium" | "high"
export type CRMContactSource = "website" | "referral" | "cold_outreach" | "event" | "social"
export type CRMDealStage =
  | "prospecting"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost"

export interface CRMContact {
  id: string
  org_id: string
  name: string
  email: string
  phone?: string | null
  company?: string | null
  position?: string | null
  status: CRMContactStatus
  priority: CRMContactPriority
  source: CRMContactSource
  value?: number | null
  last_contact?: string | null
  next_follow_up?: string | null
  notes?: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface CRMDeal {
  id: string
  org_id: string
  title: string
  contact_id?: string | null
  contact_name?: string | null
  company?: string | null
  amount: number
  stage: CRMDealStage
  probability: number
  expected_close_date?: string | null
  created_at: string
  updated_at: string
}

interface CRMListResponse<T> {
  items: T[]
  page: number
  page_size: number
  total: number
}

async function getDefaultOrgId(): Promise<string | null> {
  const org = await CompanyAPI.getCurrentCompany()
  return org?.id ?? null
}

export async function getContacts(orgId?: string): Promise<CRMContact[]> {
  const resolvedOrgId = orgId ?? (await getDefaultOrgId())
  const query = resolvedOrgId ? `?org_id=${encodeURIComponent(resolvedOrgId)}` : ""
  const { data } = await api.get<CRMListResponse<CRMContact>>(`/crm/contacts${query}`)
  return data.items ?? []
}

export async function createContact(payload: Omit<CRMContact, "id" | "created_at" | "updated_at" | "org_id"> & { org_id?: string }): Promise<CRMContact> {
  const orgId = payload.org_id ?? (await getDefaultOrgId())
  const { data } = await api.post<CRMContact>("/crm/contacts", {
    ...payload,
    org_id: orgId ?? undefined,
  })
  return data
}

export async function updateContact(contactId: string, payload: Partial<CRMContact>): Promise<CRMContact> {
  const { data } = await api.patch<CRMContact>(`/crm/contacts/${contactId}`, payload)
  return data
}

export async function deleteContact(contactId: string): Promise<void> {
  await api.delete(`/crm/contacts/${contactId}`)
}

export async function getDeals(orgId?: string): Promise<CRMDeal[]> {
  const resolvedOrgId = orgId ?? (await getDefaultOrgId())
  const query = resolvedOrgId ? `?org_id=${encodeURIComponent(resolvedOrgId)}` : ""
  const { data } = await api.get<CRMListResponse<CRMDeal>>(`/crm/deals${query}`)
  return data.items ?? []
}

export async function createDeal(payload: Omit<CRMDeal, "id" | "created_at" | "updated_at" | "org_id" | "contact_name"> & { org_id?: string }): Promise<CRMDeal> {
  const orgId = payload.org_id ?? (await getDefaultOrgId())
  const { data } = await api.post<CRMDeal>("/crm/deals", {
    ...payload,
    org_id: orgId ?? undefined,
  })
  return data
}

export async function updateDeal(dealId: string, payload: Partial<CRMDeal>): Promise<CRMDeal> {
  const { data } = await api.patch<CRMDeal>(`/crm/deals/${dealId}`, payload)
  return data
}

export async function deleteDeal(dealId: string): Promise<void> {
  await api.delete(`/crm/deals/${dealId}`)
}
