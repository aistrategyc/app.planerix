"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import AIChat from "@/components/ai/AIChat"
import { PageHeader } from "@/components/layout/PageHeader"

export default function AIChatPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <div className="space-y-6">
        <PageHeader
          title="AI-чат с аналитическим агентом"
          description="Обсуждайте инсайты, запрашивайте анализ и фиксируйте решения в одном диалоге."
        />
        <AIChat />
      </div>
    </ProtectedRoute>
  )
}
