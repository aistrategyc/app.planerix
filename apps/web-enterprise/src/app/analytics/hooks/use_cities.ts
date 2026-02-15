import { useEffect, useState } from "react"
import { api } from "@/lib/api/config"

export interface CityOption {
  id_city: number
  city_name: string
}

export function useCities() {
  const [cities, setCities] = useState<CityOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data } = await api.get<{ items: CityOption[] }>("/analytics/filters/cities")
        if (!active) return
        setCities(data.items ?? [])
      } catch (error) {
        if (!active) return
        console.error("Failed to load cities:", error)
        setCities([])
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return { cities, isLoading }
}
