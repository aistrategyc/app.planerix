"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type AnalyticsSkeletonProps = {
  variant?: "card" | "chart" | "table" | "grid"
  count?: number
  className?: string
}

export function AnalyticsSkeleton({
  variant = "card",
  count = 1,
  className,
}: AnalyticsSkeletonProps) {
  if (variant === "grid") {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-3xl" />
        ))}
      </div>
    )
  }

  if (variant === "chart") {
    return <Skeleton className={cn("h-64 w-full rounded-3xl", className)} />
  }

  if (variant === "table") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return <Skeleton className={cn("h-24 w-full rounded-3xl", className)} />
}
