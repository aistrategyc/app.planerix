import { Suspense } from "react"
import AdsPlatformPageClient from "./AdsPlatformPageClient"

export default function AdsPlatformPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading marketing...</div>}>
      <AdsPlatformPageClient />
    </Suspense>
  )
}
