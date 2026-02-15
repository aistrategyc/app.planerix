import { api } from "@/lib/api/config"

export type WidgetData<T = Record<string, unknown>> = {
  current: T[]
  compare?: T[]
}

export type WidgetMeta = {
  widget_key: string
  missing_view?: boolean
  error?: string
  sem_view?: string
  grain?: string | null
  supports_filters?: Record<string, boolean>
}

export type WidgetPayload<T = Record<string, unknown>> = {
  data: WidgetData<T>
  meta: WidgetMeta
}

export type AttributionWidgetsResponse<T = Record<string, unknown>> = {
  widgets: Record<string, WidgetPayload<T>>
}

interface FetchAttributionWidgetsParams {
  widgetKeys: string[]
  filters?: Record<string, string | number | null | undefined>
}

export const fetchAttributionWidgets = async ({
  widgetKeys,
  filters,
}: FetchAttributionWidgetsParams): Promise<AttributionWidgetsResponse> => {
  const params = new URLSearchParams()
  widgetKeys.forEach((key) => params.append("widget_keys", key))
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return
    params.set(key, String(value))
  })

  const response = await api.get<AttributionWidgetsResponse>(
    `/analytics/attribution/widgets?${params.toString()}`
  )
  return response.data
}
