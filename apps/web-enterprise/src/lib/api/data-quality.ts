import { api } from "@/lib/api/config"

export interface FreshnessItem {
  agent_key: string
  as_of_date: string
  row_idx: number
  obj: string
  last_ts: string
}

export interface AgentReadyItem {
  date_key: string
  id_city: number
  city_name: string
  contracts_all: number | null
  contracts_meta: number | null
  contracts_gads: number | null
  contracts_offline: number | null
  spend_all: number | null
  spend_meta: number | null
  spend_gads: number | null
  cpa_all_contracts: number | null
  cpa_paid_contracts: number | null
  offline_share: number | null
  refreshed_at?: string | null
}

interface FreshnessResponse {
  items: FreshnessItem[]
}

interface AgentReadyResponse {
  items: AgentReadyItem[]
}

export class DataQualityAPI {
  static async getFreshness(params?: { tenant?: string; agent_key?: string; limit?: number }): Promise<FreshnessItem[]> {
    const response = await api.get<FreshnessResponse>("/analytics/data-quality/freshness", { params })
    return response.data.items || []
  }

  static async getAgentReady(params?: { date_from?: string; date_to?: string; limit?: number }): Promise<AgentReadyItem[]> {
    const response = await api.get<AgentReadyResponse>("/analytics/data-quality/agent-ready", { params })
    return response.data.items || []
  }
}
