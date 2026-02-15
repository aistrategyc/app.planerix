// n8n/src/lib/api-client.ts
// Canonical API client shim.
//
// IMPORTANT:
// - We keep this file to avoid breaking legacy imports,
//   but we REMOVE the custom fetch-based APIClient and any duplicated refresh logic.
// - All auth/refresh/401 retry logic is handled in "@/lib/api/config" (axios interceptors).
// - This shim only exposes a convenient interface similar to the old one.

import type { AxiosRequestConfig } from "axios";
import { api } from "@/lib/api/config";
import { useAuth } from "@/contexts/auth-context";

type AuthContextLike = {
  accessToken?: string | null;
  setAccessToken?: (token: string | null) => void;
  logout?: () => void;
};

export type ApiClientLike = {
  get: <T = unknown>(endpoint: string, config?: AxiosRequestConfig) => Promise<T>;
  post: <T = unknown>(endpoint: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>;
  put: <T = unknown>(endpoint: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>;
  patch: <T = unknown>(endpoint: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>;
  delete: <T = unknown>(endpoint: string, config?: AxiosRequestConfig) => Promise<T>;
};

function exposeAuthContextToWindow(auth: unknown) {
  if (typeof window === "undefined") return;
  const win = window as Window & { __authContext?: AuthContextLike };
  win.__authContext = auth as AuthContextLike;
}

// Export a singleton "apiClient" (same name as before)
export const apiClient: ApiClientLike = {
  async get<T = unknown>(endpoint: string, config?: AxiosRequestConfig) {
    const { data } = await api.get<T>(endpoint, config);
    return data;
  },
  async post<T = unknown>(endpoint: string, data?: unknown, config?: AxiosRequestConfig) {
    const { data: res } = await api.post<T>(endpoint, data, config);
    return res;
  },
  async put<T = unknown>(endpoint: string, data?: unknown, config?: AxiosRequestConfig) {
    const { data: res } = await api.put<T>(endpoint, data, config);
    return res;
  },
  async patch<T = unknown>(endpoint: string, data?: unknown, config?: AxiosRequestConfig) {
    const { data: res } = await api.patch<T>(endpoint, data, config);
    return res;
  },
  async delete<T = unknown>(endpoint: string, config?: AxiosRequestConfig) {
    const { data } = await api.delete<T>(endpoint, config);
    return data;
  },
};

// Hook preserved for compatibility (some components might start using it later).
// Also exposes auth context to window for config.ts helpers that call window.__authContext
export function useAPIClient(): ApiClientLike {
  const auth = useAuth();
  exposeAuthContextToWindow(auth);
  return apiClient;
}