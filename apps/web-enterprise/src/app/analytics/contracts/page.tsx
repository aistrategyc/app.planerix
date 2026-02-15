import { Suspense } from "react"
import ContractsPageClient from "./ContractsPageClient"

export default function ContractsAnalyticsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading contracts...</div>}>
      <ContractsPageClient />
    </Suspense>
  )
}
