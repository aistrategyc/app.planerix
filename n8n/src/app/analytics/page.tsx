import CRMPageClient from "@/app/analytics/crm/CRMPageClient"
import { FEATURE_FLAGS } from "@/lib/featureFlags"

export default function AnalyticsPage() {
  return <CRMPageClient showCrmRawWidgets={FEATURE_FLAGS.analyticsShowCrmRawWidgets} />
}
