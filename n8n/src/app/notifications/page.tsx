"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { EmptyState } from "@/components/ui/empty-state";
import { OrganizationNotifications } from "@/app/organization/components/OrganizationNotifications";
import { CompanyAPI } from "@/lib/api/company";
import { PageHeader } from "@/components/layout/PageHeader";

function NotificationsContent() {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const company = await CompanyAPI.getCurrentCompany();
        if (!active) return;
        setOrgId(company?.id ?? null);
      } catch {
        if (active) setOrgId(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-48 bg-slate-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="p-6">
        <EmptyState
          title="Нет организации"
          description="Чтобы увидеть уведомления, нужно быть участником организации."
          action={{
            label: "На дашборд",
            onClick: () => router.push("/dashboard"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Уведомления"
        description="История событий и системных сообщений."
      />
      <OrganizationNotifications orgId={orgId} limit={50} />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
