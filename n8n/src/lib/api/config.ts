// src/lib/api/config.ts
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

function joinOriginPrefix(origin: string, prefix: string) {
  const o = origin.replace(/\/+$/, "");
  const p = (prefix || "").startsWith("/") ? (prefix || "") : `/${prefix || ""}`;
  return `${o}${p}`.replace(/\/+$/, "");
}

function getApiBaseUrl(): string {
  const prefix = process.env.NEXT_PUBLIC_API_PREFIX || "/api";

  // server-side (docker/next server)
  if (typeof window === "undefined") {
    const internal = process.env.INTERNAL_API_URL; // e.g. http://api:8000/api внутри docker network
    if (internal) return internal.replace(/\/+$/, "");

    const origin = process.env.NEXT_PUBLIC_API_ORIGIN;
    if (origin) return joinOriginPrefix(origin, prefix);

    const legacy = process.env.NEXT_PUBLIC_API_URL; // должен быть уже с /api
    if (legacy) return legacy.replace(/\/+$/, "");

    return "https://api.planerix.com/api";
  }

  // browser
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN;
  if (origin) return joinOriginPrefix(origin, prefix);

  const legacy = process.env.NEXT_PUBLIC_API_URL;
  if (legacy) return legacy.replace(/\/+$/, "");

  return "https://api.planerix.com/api";
}

export const API_BASE_URL = getApiBaseUrl();

// ---- token helpers ----
export const getAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem("access_token"); } catch { return null; }
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : (globalThis as { Buffer?: { from: (input: string, enc: string) => { toString: (enc: string) => string } } })
            .Buffer?.from(padded, "base64")
            .toString("utf-8");
    if (!decoded) return null;
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export const isAccessTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp * 1000 : null;
  if (!exp) return true;
  return Date.now() >= exp;
};

type SyncOptions = { syncAuth?: boolean }

let syncingAuthContext = false

const resolveCookieDomainAttr = (host: string) => {
  const explicit = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim()
  if (explicit) {
    const normalized = explicit.startsWith(".") ? explicit : `.${explicit}`
    const isLocal = explicit === "localhost" || explicit === "127.0.0.1" || explicit === "0.0.0.0"
    const isIp = explicit.split(".").every((p) => p && /^\d+$/.test(p))
    return !isLocal && !isIp ? `; Domain=${normalized}` : ""
  }

  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"
  const isIp = host.split(".").every((p) => p && /^\d+$/.test(p))
  const parts = host.split(".").filter(Boolean)
  const baseDomain = parts.length >= 2 ? `.${parts.slice(-2).join(".")}` : ""
  return !isLocalhost && !isIp && baseDomain ? `; Domain=${baseDomain}` : ""
}

export const setAccessToken = (token: string, options: SyncOptions = {}): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("access_token", token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    // short-lived cookie for Next middleware checks
    const isSecure = window.location.protocol === "https:";
    const secureAttr = isSecure ? "; Secure" : "";
    const sameSiteAttr = isSecure ? "None" : "Lax";
    const host = window.location.hostname || "";
    const domainAttr = resolveCookieDomainAttr(host);
    document.cookie = `access_token=${token}; path=/; max-age=${15 * 60}; SameSite=${sameSiteAttr}${secureAttr}${domainAttr}`;

    const shouldSync = options.syncAuth !== false;
    const win = window as Window & { __authContext?: { setAccessToken?: (value: string | null) => void } };
    if (shouldSync && win.__authContext?.setAccessToken && !syncingAuthContext) {
      syncingAuthContext = true;
      win.__authContext.setAccessToken(token);
      syncingAuthContext = false;
    }
  } catch {}
};

export const clearTokens = (options: SyncOptions = {}): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("access_token");
    delete api.defaults.headers.common.Authorization;

    const isSecure = window.location.protocol === "https:";
    const secureAttr = isSecure ? "; Secure" : "";
    const sameSiteAttr = isSecure ? "None" : "Lax";
    const host = window.location.hostname || "";
    const domainAttr = resolveCookieDomainAttr(host);
    document.cookie = `access_token=; path=/; max-age=0; SameSite=${sameSiteAttr}${secureAttr}${domainAttr}`;

    const shouldSync = options.syncAuth !== false;
    const win = window as Window & { __authContext?: { setAccessToken?: (value: string | null) => void } };
    if (shouldSync && win.__authContext?.setAccessToken && !syncingAuthContext) {
      syncingAuthContext = true;
      win.__authContext.setAccessToken(null);
      syncingAuthContext = false;
    }
  } catch {}
};

// ---- axios clients ----
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const raw = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Attach Authorization if we have token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  const headers = { ...(config.headers || {}) } as Record<string, unknown>;

  // do not overwrite Authorization if caller set it
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  config.headers = headers as typeof config.headers;
  return config;
});

// ---- refresh single-flight ----
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let subscribers: Array<(token: string | null) => void> = [];
let refreshCooldownUntil = 0;
const REFRESH_COOLDOWN_MS = 30_000;

function subscribe(cb: (token: string | null) => void) { subscribers.push(cb); }
function broadcast(token: string | null) { subscribers.forEach(cb => cb(token)); subscribers = []; }

async function doRefresh(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  const token = getAccessToken();
  if (!token) {
    broadcast(null);
    return null;
  }

  if (Date.now() < refreshCooldownUntil) {
    broadcast(null);
    return null;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      // IMPORTANT: endpoint without leading slash (canonical)
      const { data } = await raw.post("auth/refresh", {}, { headers: { "x-skip-auth-retry": "true" } });
      const token: string | null = data?.access_token || null;

      if (token) {
        setAccessToken(token);
      } else {
        refreshCooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;
      }

      broadcast(token);
      return token;
    } catch {
      refreshCooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;
      broadcast(null);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.response.use(
  (res) => {
    try {
      const deprecatedHeader =
        (res.headers && (res.headers["x-deprecated"] || res.headers["X-Deprecated"])) ?? null
      if (deprecatedHeader === "true") {
        const url = `${res.config?.method || "GET"} ${res.config?.url || ""}`
        const globalAny = globalThis as { __deprecatedWarned?: Set<string> }
        if (!globalAny.__deprecatedWarned) globalAny.__deprecatedWarned = new Set<string>()
        if (!globalAny.__deprecatedWarned.has(url)) {
          globalAny.__deprecatedWarned.add(url)
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.warn("[Deprecated API]", url, res.headers["x-deprecated-message"] || "")
          }
        }
      }
    } catch {}
    return res
  },
  async (error: AxiosError) => {
    const original = (error.config || {}) as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    if (status !== 401) return Promise.reject(error);

    const url = String(original.url || "");
    const isAuthEndpoint = /auth\/(login|register|resend-verification|verify-email|password-reset|sessions|logout|logout-all|revoke)/.test(
      url
    );
    const isRefreshCall = url.includes("auth/refresh");
    const alreadyRetried = original._retry === true;

    const headers = (original.headers || {}) as Record<string, string>;
    const skipHeader = headers["x-skip-auth-retry"] === "true";

    // If refresh itself failed, or already retried, don't loop
    if (isAuthEndpoint || isRefreshCall || alreadyRetried || skipHeader) {
      if (!isAuthEndpoint) {
        clearTokens();
      }
      return Promise.reject(error);
    }

    original._retry = true;

    // Try refresh only when we have a stored access token (even if expired).
    const newToken = await new Promise<string | null>((resolve) => {
      subscribe(resolve);
      doRefresh().catch(() => resolve(null));
    });

    if (newToken) {
      original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
      return api(original);
    }

    clearTokens();
    return Promise.reject(error);
  }
);
