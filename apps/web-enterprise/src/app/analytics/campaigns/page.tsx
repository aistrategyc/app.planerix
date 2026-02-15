import { Suspense } from "react"
import CampaignsPageClient from "./CampaignsPageClient"

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-sm text-muted-foreground">Loading campaigns...</div>}>
      <CampaignsPageClient />
    </Suspense>
  )
}
