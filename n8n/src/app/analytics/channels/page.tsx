import { Suspense } from "react"
import ChannelsPageClient from "./ChannelsPageClient"

export default function ChannelsPage() {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-sm text-muted-foreground">Loading channels...</div>}>
      <ChannelsPageClient />
    </Suspense>
  )
}
