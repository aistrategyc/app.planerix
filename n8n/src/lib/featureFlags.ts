export const FEATURE_FLAGS = {
  // Analytics: debug/ops-only blocks (raw tables, internal checks).
  // Default: OFF unless explicitly enabled in env.
  analyticsShowCrmRawWidgets: process.env.NEXT_PUBLIC_ANALYTICS_SHOW_CRM_RAW_WIDGETS === "true",
} as const

