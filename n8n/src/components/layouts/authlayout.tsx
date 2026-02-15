// src/components/layouts/AuthLayout.tsx

import { ReactNode } from "react"

interface AuthLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
}

export default function AuthLayout({
  children,
  title = "Planerix",
  subtitle = "Welcome back. Sign in to your workspace.",
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen flex items-center justify-center app-surface px-4">
      <div className="w-full max-w-md bg-card p-8 rounded-[28px] shadow-[0_22px_60px_rgba(15,23,42,0.12)] border border-border glass-panel">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
        </div>
        {children}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 Planerix. All rights reserved.
        </div>
      </div>
    </main>
  )
}
