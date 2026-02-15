"use client"

import React, { useEffect, useRef, useState } from "react"
import { ResponsiveContainer, ResponsiveContainerProps } from 'recharts'

type SafeResponsiveContainerProps = ResponsiveContainerProps & {
  wrapperClassName?: string
  wrapperStyle?: React.CSSProperties
}

export function SafeResponsiveContainer({
  wrapperClassName,
  wrapperStyle,
  children,
  ...props
}: SafeResponsiveContainerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const node = wrapperRef.current
    if (!node) return

    let frame: number | null = null

    const update = () => {
      const rect = node.getBoundingClientRect()
      setReady(rect.width > 0 && rect.height > 0)
    }

    update()

    const observer = new ResizeObserver(() => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      frame = requestAnimationFrame(update)
    })

    observer.observe(node)

    return () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      observer.disconnect()
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      className={wrapperClassName}
      style={{ width: "100%", height: "100%", ...wrapperStyle }}
    >
      {ready ? (
        <ResponsiveContainer minWidth={1} minHeight={1} {...props}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}