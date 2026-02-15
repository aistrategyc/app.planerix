

"use client";

import React, { useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

import { useOrganizationData } from "../../hooks/useOrganization";
import type { Organization } from "../../hooks/useOrganization";
import { OrganizationSettings } from "../../components/OrganizationSettings";

export default function OrganizationSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const {
    organization,
    stats,
    loading,
    error,
    actions,
  } = useOrganizationData(id);

  const copyOrgUrl = useCallback(async () => {
    if (!organization) return;
    const url = `${window.location.origin}/organization/${organization.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Скопировано", description: "Ссылка на организацию скопирована" });
    } catch {
      toast({
        title: "Не удалось скопировать",
        description: `Скопируйте вручную: ${url}`,
        variant: "destructive",
      });
    }
  }, [organization, toast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Настройки организации</CardTitle>
            <CardDescription>Загрузка…</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
              Пожалуйста, подождите
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="space-y-6">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Настройки организации</CardTitle>
            <CardDescription>Ошибка загрузки</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-red-600">
                {typeof error === "string"
                  ? error
                  : (error as { message?: string })?.message || "Не удалось загрузить данные организации"}
              </p>
              <Button variant="outline" onClick={() => router.refresh()}>Повторить</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleOrganizationUpdated = async (data: Partial<Organization>) => {
    try {
      await actions.updateOrganization(data);
      toast({ title: "Сохранено", description: "Организация обновлена" });
    } catch (e: unknown) {
      const error = e as { message?: string }
      toast({ title: "Ошибка", description: error?.message ?? "Не удалось обновить", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={organization.name}
        description="Настройки организации"
        actions={(
          <Button variant="ghost" onClick={() => router.push(`/organization/${organization.id}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            К организации
          </Button>
        )}
      />

      <OrganizationSettings
        organization={organization}
        stats={stats}
        onOrganizationUpdated={handleOrganizationUpdated}
        copyOrgUrl={copyOrgUrl}
      />
    </div>
  );
}
