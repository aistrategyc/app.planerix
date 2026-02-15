"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AttributionFilterBar } from "@/app/attribution/components/AttributionFilterBar"
import { useAttributionFilters } from "@/app/attribution/hooks/useAttributionFilters"

interface AttributionPlaceholderClientProps {
  title: string
  description?: string
}

export function AttributionPlaceholderClient({ title, description }: AttributionPlaceholderClientProps) {
  const { draftFilters, setDraftFilters, applyFilters, resetFilters } = useAttributionFilters()

  return (
    <div className="space-y-6">
      <AttributionFilterBar
        value={draftFilters}
        onChange={(next) => setDraftFilters((prev) => ({ ...prev, ...next }))}
        onApply={applyFilters}
        onReset={resetFilters}
      />
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {description ?? "Раздел в разработке. Скоро добавим витрины и визуализации."}
        </CardContent>
      </Card>
    </div>
  )
}
