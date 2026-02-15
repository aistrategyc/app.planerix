// src/app/organization/hooks/useApi.ts
import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api/config";

// ------------------------------
// Types
// ------------------------------
interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
}

interface User {
  id: string;
  email: string;
  username?: string;
  [key: string]: unknown;
}

interface OAuthCredentialPayload {
  provider: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  external_account_id?: string;
  metadata?: Record<string, unknown>;
  name?: string;
}

interface N8NCredentialPayload {
  name: string;
  credential_type: string;
  credential_data: Record<string, unknown>;
  data_source_id?: string;
}

interface N8NWorkflowProvisionPayload {
  provider: string;
  template_workflow_id: string;
  name?: string;
}

// ------------------------------
// Low-level request helper
// ------------------------------
async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", headers = {}, body } = options;

  const ep = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  try {
    const response = await api.request<T>({
      url: ep,
      method,
      data: body && method !== "GET" ? body : undefined,
      headers: { "Content-Type": "application/json", ...headers },
    });
    return response.data;
  } catch (err: unknown) {
    const errorData = (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data;
    const error: ApiError = {
      message: errorData?.detail || errorData?.message || "Произошла ошибка",
      status: (err as { response?: { status?: number } })?.response?.status ?? 0,
      details: errorData,
    };
    throw error;
  }
}

// ------------------------------
// Generic hook wrapper
// ------------------------------
export function useApi<T extends unknown[], R>(
  apiFunction: (...args: T) => Promise<R>,
  options: {
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
    successMessage?: string;
  } = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    showSuccessToast = false,
    showErrorToast = true,
    successMessage = "Операция выполнена успешно",
  } = options;

  const execute = useCallback(
    async (...args: T): Promise<R> => {
      try {
        setLoading(true);
        setError(null);

        const result = await apiFunction(...args);

        if (showSuccessToast) {
          toast({ title: "Успешно", description: successMessage });
        }

        return result;
      } catch (err: unknown) {
        const errorMessage =
          err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
            ? (err as { message?: string }).message ?? "Произошла неизвестная ошибка"
            : "Произошла неизвестная ошибка";
        setError(errorMessage);

        if (showErrorToast) {
          toast({ title: "Ошибка", description: errorMessage, variant: "destructive" });
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, showSuccessToast, showErrorToast, successMessage, toast]
  );

  return {
    execute,
    loading,
    error,
    clearError: useCallback(() => setError(null), []),
  };
}

// ------------------------------
// Organization API
// ------------------------------
export function useOrganizationApi() {
  const getOrganization = useCallback(async (orgId: string) => {
    return apiRequest(`/orgs/${orgId}`);
  }, []);

  const updateOrganization = useCallback(async (orgId: string, data: Record<string, unknown>) => {
    return apiRequest(`/orgs/${orgId}`, { method: "PATCH", body: data });
  }, []);

  const getMembers = useCallback(async (orgId: string) => {
    return apiRequest(`/orgs/${orgId}/memberships/`);
  }, []);

  const createInvite = useCallback(async (orgId: string, data: Record<string, unknown>) => {
    const hasInvitedEmail = typeof data.invited_email === "string";
    const payload: Record<string, unknown> = hasInvitedEmail
      ? { ...data }
      : { ...data, invited_email: data.email };
    if ("email" in payload) {
      delete payload.email;
    }
    return apiRequest(`/orgs/${orgId}/invitations`, { method: "POST", body: payload });
  }, []);

  const getDepartments = useCallback(async (orgId: string) => {
    return apiRequest(`/orgs/${orgId}/departments/`);
  }, []);

  const createDepartment = useCallback(async (orgId: string, data: Record<string, unknown>) => {
    return apiRequest(`/orgs/${orgId}/departments/`, { method: "POST", body: data });
  }, []);

  const updateDepartment = useCallback(async (orgId: string, departmentId: string, data: Record<string, unknown>) => {
    return apiRequest(`/orgs/${orgId}/departments/${departmentId}`, { method: "PATCH", body: data });
  }, []);

  const deleteDepartment = useCallback(async (orgId: string, departmentId: string) => {
    return apiRequest(`/orgs/${orgId}/departments/${departmentId}`, { method: "DELETE" });
  }, []);

  const removeMember = useCallback(async (orgId: string, memberId: string) => {
    return apiRequest(`/orgs/${orgId}/memberships/${memberId}`, { method: "DELETE" });
  }, []);

  const updateMemberRole = useCallback(async (orgId: string, memberId: string, role: string) => {
    return apiRequest(`/orgs/${orgId}/memberships/${memberId}`, { method: "PATCH", body: { role } });
  }, []);

  const getStats = useCallback(async (orgId: string) => {
    return apiRequest(`/orgs/${orgId}/stats`);
  }, []);

  const getAnalytics = useCallback(async (orgId: string, timeRange: string = "30d") => {
    return apiRequest(`/orgs/${orgId}/analytics?time_range=${encodeURIComponent(timeRange)}`);
  }, []);

  const storeOAuthCredential = useCallback(async (payload: OAuthCredentialPayload) => {
    return apiRequest("/integrations/oauth", { method: "POST", body: payload });
  }, []);

  const createN8nCredential = useCallback(async (payload: N8NCredentialPayload) => {
    return apiRequest("/integrations/n8n/credentials", { method: "POST", body: payload });
  }, []);

  const provisionN8nWorkflow = useCallback(async (payload: N8NWorkflowProvisionPayload) => {
    return apiRequest("/integrations/n8n/provision", { method: "POST", body: payload });
  }, []);

  return {
    getOrganization,
    updateOrganization,
    getMembers,
    createInvite,
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    removeMember,
    updateMemberRole,
    getStats,
    getAnalytics,
    storeOAuthCredential,
    createN8nCredential,
    provisionN8nWorkflow,
  };
}

// ------------------------------
// File upload
// ------------------------------
export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const uploadFile = useCallback(
    async (file: File, orgId?: string) => {
      try {
        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);
        if (orgId) formData.append("organization_id", orgId);

        const { data } = await api.post<{ url?: string; message?: string }>(
          "/upload",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        toast({ title: "Файл загружен", description: "Файл успешно загружен на сервер" });
        return data;
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
            ? (err as { message?: string }).message ?? "Ошибка загрузки файла"
            : "Ошибка загрузки файла";
        setError(msg);
        toast({ title: "Ошибка", description: msg, variant: "destructive" });
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [toast]
  );

  return {
    uploadFile,
    uploading,
    error,
    clearError: useCallback(() => setError(null), []),
  };
}

// ------------------------------
// Current user
// ------------------------------
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const getCurrentUser = useCallback(async () => {
    try {
      setLoading(true);
      const orgs = await apiRequest<Array<{ id: string }>>("/orgs/");
      const list = (orgs as { items?: Array<{ id: string }> })?.items ?? orgs ?? [];
      const orgId = Array.isArray(list) && list.length ? list[0].id : null;
      if (!orgId) {
        setUser(null);
        return null;
      }
      const membership = await apiRequest<{ user?: User; role?: string }>(`/orgs/${orgId}/memberships/me`);
      const userData = membership?.user ?? null;
      if (userData) {
        setUser({ ...userData, role: membership?.role });
        return userData;
      }
      setUser(null);
      return null;
    } catch (err) {
      console.error("Error getting current user:", err);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setUser(null);
    window.location.href = "/login";
  }, []);

  return {
    user,
    loading,
    getCurrentUser,
    logout,
    isAuthenticated: !!user,
  };
}
