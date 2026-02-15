// components/organization/OrganizationSettings.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { 
  Shield,
  CheckCircle,
  AlertCircle,
  Edit,
  Settings,
  Activity,
  Copy
} from "lucide-react";
import { EditOrganizationDialog } from "./EditOrganizationDialog";
import type { Organization, OrganizationStats } from "../hooks/useOrganization";
import { useOrganizationApi } from "../hooks/useApi";

interface OrganizationSettingsProps {
  organization: Organization;
  stats: OrganizationStats;
  onOrganizationUpdated: (data: Partial<Organization>) => Promise<Organization>;
  copyOrgUrl: () => void;
}

export function OrganizationSettings({ 
  organization, 
  stats, 
  onOrganizationUpdated,
  copyOrgUrl 
}: OrganizationSettingsProps) {
  const api = useOrganizationApi();
  const { toast } = useToast();

  type ProviderKey = "facebook_ads" | "google_ads" | "ga4";
  type IntegrationFormState = {
    accessToken: string;
    refreshToken: string;
    accountId: string;
    templateWorkflowId: string;
    credentialType: string;
    credentialData: string;
  };

  const [integrationState, setIntegrationState] = useState<Record<ProviderKey, IntegrationFormState>>({
    facebook_ads: {
      accessToken: "",
      refreshToken: "",
      accountId: "",
      templateWorkflowId: "",
      credentialType: "",
      credentialData: "{}",
    },
    google_ads: {
      accessToken: "",
      refreshToken: "",
      accountId: "",
      templateWorkflowId: "",
      credentialType: "",
      credentialData: "{}",
    },
    ga4: {
      accessToken: "",
      refreshToken: "",
      accountId: "",
      templateWorkflowId: "",
      credentialType: "",
      credentialData: "{}",
    },
  });
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const providerMeta: Record<ProviderKey, { label: string; description: string }> = {
    facebook_ads: {
      label: "Facebook Ads",
      description: "Подключение Meta Ads для загрузки кампаний и лидов.",
    },
    google_ads: {
      label: "Google Ads",
      description: "Подключение Google Ads для статистики кампаний.",
    },
    ga4: {
      label: "Google Analytics",
      description: "Подключение GA4 для аналитики сайта.",
    },
  };

  const updateIntegrationField = (
    provider: ProviderKey,
    field: keyof IntegrationFormState,
    value: string
  ) => {
    setIntegrationState((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
  };

  const handleSaveOAuth = async (provider: ProviderKey) => {
    const payload = integrationState[provider];
    if (!payload.accessToken) {
      toast({ title: "Ошибка", description: "Нужен access token", variant: "destructive" });
      return;
    }
    try {
      setSavingProvider(`${provider}-oauth`);
      await api.storeOAuthCredential({
        provider,
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken || undefined,
        external_account_id: payload.accountId || undefined,
        metadata: payload.accountId ? { account_id: payload.accountId } : undefined,
        name: `${organization.name} ${provider}`,
      });
      toast({ title: "Успешно", description: "OAuth данные сохранены" });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
          ? (err as { message?: string }).message ?? "Ошибка сохранения"
          : "Ошибка сохранения";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setSavingProvider(null);
    }
  };

  const handleCreateN8nCredential = async (provider: ProviderKey) => {
    const payload = integrationState[provider];
    if (!payload.credentialType) {
      toast({ title: "Ошибка", description: "Нужен тип credential", variant: "destructive" });
      return;
    }
    let credentialData: Record<string, unknown> = {};
    try {
      credentialData = JSON.parse(payload.credentialData || "{}");
    } catch (err) {
      toast({ title: "Ошибка", description: "Неверный JSON для credential", variant: "destructive" });
      return;
    }

    try {
      setSavingProvider(`${provider}-n8n`);
      await api.createN8nCredential({
        name: `${organization.name} ${provider}`,
        credential_type: payload.credentialType,
        credential_data: credentialData,
      });
      toast({ title: "Успешно", description: "n8n credential создан" });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
          ? (err as { message?: string }).message ?? "Ошибка создания credential"
          : "Ошибка создания credential";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setSavingProvider(null);
    }
  };

  const handleProvisionWorkflow = async (provider: ProviderKey) => {
    const payload = integrationState[provider];
    if (!payload.templateWorkflowId) {
      toast({ title: "Ошибка", description: "Нужен ID шаблона workflow", variant: "destructive" });
      return;
    }
    try {
      setSavingProvider(`${provider}-provision`);
      const response = await api.provisionN8nWorkflow({
        provider,
        template_workflow_id: payload.templateWorkflowId,
        name: `${organization.name} ${provider}`,
      });
      toast({
        title: "Workflow создан",
        description: response.workflow_url ? `Ссылка: ${response.workflow_url}` : "Workflow создан",
      });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
          ? (err as { message?: string }).message ?? "Ошибка создания workflow"
          : "Ошибка создания workflow";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Основные настройки */}
      <Card>
        <CardHeader>
          <CardTitle>Основные настройки</CardTitle>
          <CardDescription>
            Базовая информация об организации
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Название организации</Label>
            <p className="text-sm text-slate-600 mt-1">{organization.name}</p>
          </div>
          
          <div>
            <Label className="text-sm font-medium">URL организации</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                /{organization.slug}
              </code>
              <Button variant="ghost" size="sm" onClick={copyOrgUrl}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {organization.preferences && (
            <>
              <div>
                <Label className="text-sm font-medium">Часовой пояс</Label>
                <p className="text-sm text-slate-600 mt-1">
                  {organization.preferences.timezone || 'Не установлен'}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Валюта</Label>
                <p className="text-sm text-slate-600 mt-1">
                  {organization.preferences.currency || 'Не установлена'}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Язык</Label>
                <p className="text-sm text-slate-600 mt-1">
                  {organization.preferences.locale === 'ru-RU' ? 'Русский' :
                   organization.preferences.locale === 'en-US' ? 'English' :
                   organization.preferences.locale === 'pl-PL' ? 'Polski' : 
                   'Не установлен'}
                </p>
              </div>
            </>
          )}

          <EditOrganizationDialog
            organization={organization}
            onOrganizationUpdated={onOrganizationUpdated}
            trigger={
              <Button variant="outline" className="w-full">
                <Edit className="w-4 h-4 mr-2" />
                Редактировать настройки
              </Button>
            }
          />
        </CardContent>
      </Card>

      {/* Безопасность */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            Безопасность
          </CardTitle>
          <CardDescription>
            Управление доступом и безопасностью
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Двухфакторная аутентификация</span>
            </div>
            <p className="text-xs text-green-700">Включена для всех администраторов</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Приватная организация</span>
              <Badge className="bg-blue-100 text-blue-800">Включено</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Одобрение приглашений</span>
              <Badge className="bg-yellow-100 text-yellow-800">Требуется</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Аудит действий</span>
              <Badge className="bg-green-100 text-green-800">Активен</Badge>
            </div>
          </div>

          <Button variant="outline" className="w-full">
            <Settings className="w-4 h-4 mr-2" />
            Настройки безопасности
          </Button>
        </CardContent>
      </Card>

      {/* Интеграции */}
      <Card id="integrations" className="lg:col-span-2 scroll-mt-20">
        <CardHeader>
          <CardTitle>Интеграции</CardTitle>
          <CardDescription>
            Подключения рекламных платформ и аналитики для n8n и ETL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(["facebook_ads", "google_ads", "ga4"] as ProviderKey[]).map((provider) => {
            const state = integrationState[provider];
            const meta = providerMeta[provider];
            const isSavingOAuth = savingProvider === `${provider}-oauth`;
            const isSavingCredential = savingProvider === `${provider}-n8n`;
            const isSavingProvision = savingProvider === `${provider}-provision`;

            return (
              <div key={provider} className="border rounded-lg p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold">{meta.label}</h4>
                  <p className="text-xs text-slate-500">{meta.description}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Access token</Label>
                    <Input
                      value={state.accessToken}
                      onChange={(event) => updateIntegrationField(provider, "accessToken", event.target.value)}
                      placeholder="access_token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Refresh token (optional)</Label>
                    <Input
                      value={state.refreshToken}
                      onChange={(event) => updateIntegrationField(provider, "refreshToken", event.target.value)}
                      placeholder="refresh_token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account ID</Label>
                    <Input
                      value={state.accountId}
                      onChange={(event) => updateIntegrationField(provider, "accountId", event.target.value)}
                      placeholder="account_id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Template workflow ID</Label>
                    <Input
                      value={state.templateWorkflowId}
                      onChange={(event) => updateIntegrationField(provider, "templateWorkflowId", event.target.value)}
                      placeholder="m7ER5TZW2B017s63"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>n8n credential type</Label>
                    <Input
                      value={state.credentialType}
                      onChange={(event) => updateIntegrationField(provider, "credentialType", event.target.value)}
                      placeholder="googleAdsOAuth2Api / facebookGraphApi / googleAnalyticsOAuth2Api"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Credential data (JSON)</Label>
                    <Textarea
                      value={state.credentialData}
                      onChange={(event) => updateIntegrationField(provider, "credentialData", event.target.value)}
                      rows={4}
                      placeholder='{"clientId":"...","clientSecret":"..."}'
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleSaveOAuth(provider)} disabled={isSavingOAuth}>
                    {isSavingOAuth ? "Сохраняем..." : "Сохранить OAuth"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCreateN8nCredential(provider)}
                    disabled={isSavingCredential}
                  >
                    {isSavingCredential ? "Создаем..." : "Создать credential"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleProvisionWorkflow(provider)}
                    disabled={isSavingProvision}
                  >
                    {isSavingProvision ? "Создаем..." : "Создать workflow"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Статистика */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-500" />
            Активность
          </CardTitle>
          <CardDescription>
            Статистика использования
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Всего участников</span>
              <span className="text-sm font-medium">{stats.totalMembers}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Активных участников</span>
              <span className="text-sm font-medium">{stats.activeMembers}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Приглашений отправлено</span>
              <span className="text-sm font-medium">{stats.pendingMembers}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Отделов создано</span>
              <span className="text-sm font-medium">{stats.totalDepartments}</span>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-slate-500">
              Последнее обновление: {new Date(organization.updated_at).toLocaleString('ru-RU')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Опасная зона */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            Опасная зона
          </CardTitle>
          <CardDescription>
            Необратимые действия с организацией
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <h4 className="text-sm font-medium text-red-800 mb-2">Удаление организации</h4>
            <p className="text-xs text-red-700 mb-3">
              Это действие нельзя отменить. Будут удалены все данные организации,
              участники, отделы и проекты.
            </p>
            <Button variant="destructive" size="sm">
              Удалить организацию
            </Button>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">Передача владения</h4>
            <p className="text-xs text-yellow-700 mb-3">
              Передать права владельца другому участнику организации.
            </p>
            <Button variant="outline" size="sm">
              Передать владение
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
