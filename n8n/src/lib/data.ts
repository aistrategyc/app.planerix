import { api } from "@/lib/api/config"
export async function getTrafficSummary() {
  const response = await api.get("/analytics/sales/v6/traffic/organic-vs-paid")
  return response.data
}
