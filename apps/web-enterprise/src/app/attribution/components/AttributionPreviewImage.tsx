"use client"

import { useState } from "react"
import { ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_BASE_URL } from "@/lib/api/config"

type AttributionPreviewImageProps = {
  src?: string | null
  alt: string
  className?: string
  fallbackClassName?: string
}

export function AttributionPreviewImage({
  src,
  alt,
  className,
  fallbackClassName,
}: AttributionPreviewImageProps) {
  const [failed, setFailed] = useState(false)
  const trimmed = typeof src === "string" ? src.trim() : ""
  const shouldShow = Boolean(trimmed) && !failed

  const resolvedSrc = (() => {
    if (!trimmed) return ""
    if (!/^https?:\/\//i.test(trimmed)) return trimmed
    try {
      const url = new URL(trimmed)
      const host = url.hostname.toLowerCase()
      const proxyHosts = [".fbcdn.net", ".facebook.com", ".instagram.com", ".cdninstagram.com"]
      const needsProxy = proxyHosts.some(
        (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
      )
      if (!needsProxy) return trimmed
      return `${API_BASE_URL}/media/preview?url=${encodeURIComponent(trimmed)}`
    } catch {
      return trimmed
    }
  })()

  if (!shouldShow) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground",
          fallbackClassName
        )}
      >
        <ImageOff className="h-4 w-4" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
