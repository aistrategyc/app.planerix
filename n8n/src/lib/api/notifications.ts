import { api } from "@/lib/api/config"

export type NotificationStatus = "unread" | "read" | "archived"
export type NotificationType =
  | "system"
  | "task_assigned"
  | "task_completed"
  | "task_overdue"
  | "project_update"
  | "mention"
  | "comment"
  | "deadline_reminder"
  | "okr_update"
  | "kpi_alert"
  | "invitation"

export interface NotificationItem {
  id: string
  org_id?: string | null
  user_id: string
  type: NotificationType
  status: NotificationStatus
  title: string
  message: string
  related_entity_type?: string | null
  related_entity_id?: string | null
  action_url?: string | null
  action_text?: string | null
  priority?: string | null
  created_at: string
  read_at?: string | null
}

export interface NotificationListResponse {
  items: NotificationItem[]
  page: number
  page_size: number
  total: number
  unread_count: number
}

export async function getNotifications(params: {
  orgId?: string
  page?: number
  pageSize?: number
  status?: NotificationStatus
  type?: NotificationType
}): Promise<NotificationListResponse> {
  const { orgId, page = 1, pageSize = 20, status, type } = params
  const query = new URLSearchParams()
  query.set("page", String(page))
  query.set("page_size", String(pageSize))
  if (orgId) query.set("org_id", orgId)
  if (status) query.set("status", status)
  if (type) query.set("type", type)

  const { data } = await api.get(`/notifications?${query.toString()}`)
  return data
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem> {
  const { data } = await api.patch(`/notifications/${notificationId}/read`)
  return data
}

export async function markAllNotificationsRead(orgId?: string): Promise<{ updated: number }> {
  const query = orgId ? `?org_id=${encodeURIComponent(orgId)}` : ""
  const { data } = await api.patch(`/notifications/read-all${query}`)
  return data
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await api.delete(`/notifications/${notificationId}`)
}
