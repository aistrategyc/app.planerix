import { api } from "@/lib/api/config"

export interface DataSource {
  id: string
  type: string
  name: string
  status: string
  created_at: string
}

export class IntegrationsAPI {
  static async listDataSources(): Promise<DataSource[]> {
    const { data } = await api.get("integrations/data-sources")
    return data ?? []
  }
}
