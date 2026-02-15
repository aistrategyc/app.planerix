'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import { clearTokens, getAccessToken, isAccessTokenExpired, setAccessToken as persistAccessToken } from "@/lib/api/config";
import { CompanyAPI, type MembershipWithUser } from "@/lib/api/company";
import { login as apiLogin, refresh as apiRefresh, logout as apiLogout, register as apiRegister, resendVerification as apiResendVerification } from "@/lib/api/auth";

// ---- types ----

export interface User {
  id: string;
  email: string;
  username?: string | null;
  full_name?: string | null;
  role?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  avatar_url?: string | null;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  terms_accepted: boolean;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;

  refreshAuth: () => Promise<boolean>;
  resendVerification: (email: string) => Promise<void>;

  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

// ---- helpers ----

function mapMembershipToUser(membership: MembershipWithUser | null): User | null {
  if (!membership?.user) return null;
  return {
    id: membership.user.id,
    email: membership.user.email || "",
    username: membership.user.username || null,
    full_name: membership.user.full_name || null,
    avatar_url: membership.user.avatar_url || null,
    role: membership.role,
    is_active: membership.user.is_active,
    is_verified: membership.user.is_verified,
  };
}

// ---- provider ----

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // prevent repeated init + refresh storms
  const bootstrappedRef = useRef(false);

  // refresh throttling
  const refreshCooldownUntilRef = useRef(0);
  const refreshCooldownMs = 30_000;

  const isAuthenticated = Boolean(accessToken);

  const clearError = useCallback(() => setError(null), []);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    if (token) {
      persistAccessToken(token, { syncAuth: false });
    } else {
      clearTokens({ syncAuth: false });
    }
  }, []);

  const fetchUser = useCallback(async () => {
    if (!accessToken) return;
    if (isAccessTokenExpired(accessToken)) {
      setUser(null);
      setAccessToken(null);
      return;
    }

    try {
      const membership = await CompanyAPI.getCurrentMembership();
      const mapped = mapMembershipToUser(membership);

      if (mapped) {
        setUser(mapped);
        return;
      }

      // membership not available → treat as unauthenticated
      setUser(null);
      return;
    } catch (err) {
      console.error("Failed to fetch user:", err);
      const status = (err as { response?: { status?: number } })?.response?.status;

      // only hard-drop on auth errors
      if (status === 401 || status === 403) {
        setUser(null);
        setAccessToken(null);
        return;
      }

      // network/other error: keep token, user unknown (can retry later)
      setUser(null);
    }
  }, [accessToken, setAccessToken]);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    // throttle
    if (Date.now() < refreshCooldownUntilRef.current) return false;

    const savedToken = getAccessToken();
    if (!savedToken) return false;

    try {
      const data = await apiRefresh();
      if (data?.access_token) {
        setAccessToken(data.access_token);
        // fetchUser may still fail on network; that's fine
        await fetchUser();
        return true;
      }

      refreshCooldownUntilRef.current = Date.now() + refreshCooldownMs;
      setUser(null);
      setAccessToken(null);
      return false;
    } catch (err) {
      console.error("Refresh failed:", err);
      refreshCooldownUntilRef.current = Date.now() + refreshCooldownMs;
      setUser(null);
      setAccessToken(null);
      return false;
    }
  }, [fetchUser, setAccessToken]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiLogin({ email, password });

      if (!data?.access_token) {
        setError("Login failed");
        setUser(null);
        setAccessToken(null);
        return false;
      }

      setAccessToken(data.access_token);

      try {
        const membership = await CompanyAPI.getCurrentMembership();
        const mapped = mapMembershipToUser(membership);
        setUser(mapped);
      } catch (e) {
        console.error("Failed to fetch membership after login:", e);
        setUser(null);
      }

      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error occurred";
      console.error("Network error:", e);
      setError(msg);
      setUser(null);
      setAccessToken(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [setAccessToken]);

  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiRegister(data);
      // no auto-login; email verification flow
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    await apiResendVerification(email);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (e) {
      console.error("Logout request failed:", e);
    } finally {
      CompanyAPI.clearOrgCache();
      setUser(null);
      setAccessToken(null);
    }
  }, [setAccessToken]);

  // ---- init auth state (ONE-SHOT, no storm) ----
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const initAuth = async () => {
      setIsLoading(true);

      try {
        // 1) If we have a non-expired local token → try fetchUser first (no refresh)
        if (typeof window !== "undefined") {
          const savedToken = getAccessToken();
          const pathname = window.location.pathname;
          const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

          if (savedToken && !isAccessTokenExpired(savedToken)) {
            setAccessToken(savedToken);
            await fetchUser();
            return;
          }

          // If we have a saved token but it's expired -> refresh (unless on auth pages).
          if (savedToken) {
            if (isAuthPage) {
              setAccessToken(null);
              return;
            }
            await refreshAuth();
            return;
          }

          // No saved token: try refresh using cookie (if present) unless on auth pages.
          if (!isAuthPage) {
            await refreshAuth();
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [fetchUser, refreshAuth, setAccessToken]);

  // Sync user when token exists but user not loaded (safe, not stormy)
  useEffect(() => {
    if (accessToken && !user) {
      fetchUser();
    }
  }, [accessToken, user, fetchUser]);

  // Expose minimal auth controls for axios config helpers
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as Window & { __authContext?: Pick<AuthContextType, "setAccessToken" | "logout"> };

    win.__authContext = { setAccessToken, logout };

    return () => {
      if (win.__authContext?.setAccessToken === setAccessToken) {
        delete win.__authContext;
      }
    };
  }, [setAccessToken, logout]);

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshAuth,
    resendVerification,
    setUser,
    setAccessToken,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
