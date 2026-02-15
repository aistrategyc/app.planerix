import { api } from "@/lib/api/config"

export interface AuditActor {
  id: string
  email?: string | null
  username?: string | null
  full_name?: string | null
}

export interface AuditLogItem {
  id: string
  org_id?: string | null
  user_id?: string | null
  event_type: string
  success: boolean
  ip_address?: string | null
  user_agent?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
  actor?: AuditActor | null
}

export interface AuditLogListResponse {
  items: AuditLogItem[]
  page: number
  page_size: number
  total: number
}

export async function getAuditLogs(params: {
  orgId?: string
  page?: number
  pageSize?: number
  eventType?: string
  success?: boolean
}): Promise<AuditLogListResponse> {
  const {
    orgId,
    page = 1,
    pageSize = 20,
    eventType,
    success,
  } = params

  const query = new URLSearchParams()
  query.set("page", String(page))
  query.set("page_size", String(pageSize))
  if (orgId) query.set("org_id", orgId)
  if (eventType) query.set("event_type", eventType)
  if (success !== undefined) query.set("success", String(success))

  const { data } = await api.get(`/audit/logs?${query.toString()}`)
  return data
}
