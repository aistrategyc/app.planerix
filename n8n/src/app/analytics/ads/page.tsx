import { Suspense } from "react"
import AdsPageClient from "@/app/analytics/ads/AdsPageClient"

export default function AdsAnalyticsPage() {
  return (
    <Suspense fallback={<div className="min-h-[200px]" />}>
      <AdsPageClient />
    </Suspense>
  )
}
