import type { CityOption } from "@/app/analytics/hooks/use_cities"

const normalizeCity = (value: string) => value.toLowerCase().replace(/[\s\-_.]/g, "")

export const resolveDefaultCityId = (cities: CityOption[]) => {
  if (!cities.length) return null
  const match = cities.find((city) => {
    const normalized = normalizeCity(city.city_name)
    return (
      normalized.includes("kyiv") ||
      normalized.includes("kiev") ||
      normalized.includes("київ") ||
      normalized.includes("киев")
    )
  })
  return match?.id_city ?? cities[0]?.id_city ?? null
}

export const buildLastWeekRange = (maxDate: string | null, days = 6) => {
  if (!maxDate) return null
  const max = new Date(maxDate)
  if (Number.isNaN(max.getTime())) return null
  const from = new Date(max)
  from.setDate(from.getDate() - days)
  return { from, to: max }
}
