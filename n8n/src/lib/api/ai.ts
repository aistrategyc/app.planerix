import { api } from "./config"

export type AIChatRole = "user" | "assistant" | "system"

export interface AIChatMessage {
  role: AIChatRole
  content: string
}

export interface AIChatResponse {
  answer: string
  sources?: Record<string, unknown>[]
  widget_data?: Record<string, unknown>
}

export interface AIActionRequest {
  id: number
  status: string
  action_type?: string | null
  title?: string | null
  description?: string | null
  priority?: string | null
  widget_key?: string | null
  severity?: string | null
  entity_type?: string | null
  entity_id?: string | null
  project_id?: string | null
  kpi_indicator_id?: string | null
  objective_id?: string | null
  key_result_id?: string | null
  expected_impact?: Record<string, unknown> | null
  payload?: Record<string, unknown> | null
  created_at?: string | null
}

export interface AIActionRequestList {
  items: AIActionRequest[]
}

export const sendAIChatMessage = async (
  message: string,
  history: AIChatMessage[]
): Promise<AIChatResponse> => {
  const { data } = await api.post<AIChatResponse>("/ai/chat", {
    message,
    history,
  })
  return data
}

export const fetchAIActionRequests = async (
  status: string = "pending"
): Promise<AIActionRequestList> => {
  const { data } = await api.get<AIActionRequestList>("/ai/action-requests", {
    params: { status },
  })
  return data
}

export const acceptAIActionRequest = async (id: number) => {
  const { data } = await api.post(`/ai/action-requests/${id}/accept`)
  return data
}

export const rejectAIActionRequest = async (id: number) => {
  const { data } = await api.post(`/ai/action-requests/${id}/reject`)
  return data
}
