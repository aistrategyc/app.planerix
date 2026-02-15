export const dynamic = "force-dynamic"

import CRMPageClient from "./CRMPageClient"
import { FEATURE_FLAGS } from "@/lib/featureFlags"

export default function CRMPage() {
  return <CRMPageClient showCrmRawWidgets={FEATURE_FLAGS.analyticsShowCrmRawWidgets} />
}
