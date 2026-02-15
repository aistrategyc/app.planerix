import { api } from "@/lib/api/config"

export interface MetricDefinition {
  id: string
  org_id: string
  name: string
  description?: string | null
  unit?: string | null
  formula?: string | null
  aggregation?: string | null
  meta_data?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

interface MetricDefinitionListResponse {
  items: MetricDefinition[]
  total: number
  page: number
  page_size: number
}

export class MetricsAPI {
  static async listDefinitions(params?: { page?: number; page_size?: number; search?: string }): Promise<MetricDefinition[]> {
    const { data } = await api.get<MetricDefinitionListResponse>("/metrics/definitions", { params })
    return data.items || []
  }
}
