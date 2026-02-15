"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useOrganizationAnalytics } from "../../hooks/useOrganizationAnalytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/layout/PageHeader";

function formatCurrencyPLN(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function OrganizationAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = id as string;
  const { data, loading, error } = useOrganizationAnalytics(orgId);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Organization analytics" description="Loading analytics..." />
        <Card className="glass-panel">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading analytics...
          </CardContent>
        </Card>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Organization analytics" description="Failed to load analytics." />
        <Card className="glass-panel">
          <CardContent className="py-10 text-center text-sm text-destructive">
            Failed to load analytics: {error.message || String(error)}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Organization analytics" description="No analytics data found." />
        <Card className="glass-panel">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No analytics data found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalProjects = Number(data.totalProjects ?? 0);
  const totalMembers = Number(data.totalMembers ?? 0);
  const activeMembers = Number(data.activeMembers ?? 0);
  const revenue = Number(data.revenue ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Analytics for ${data.organizationName || "Organization"}`}
        description="Organization-level performance overview."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <MetricCard title="Total Projects" value={totalProjects} />
        <MetricCard title="Total Members" value={totalMembers} />
        <MetricCard title="Active Members" value={activeMembers} />
        <MetricCard title="Revenue" value={formatCurrencyPLN(revenue)} />
      </div>

      {(data.period?.from || data.period?.to) && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {data.period?.from ? `From: ${data.period.from}` : null}
              {data.period?.to ? ` — To: ${data.period.to}` : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
