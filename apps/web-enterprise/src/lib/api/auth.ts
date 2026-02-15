// apps/web-enterprise/src/lib/api/auth.ts
import { api, clearTokens, getAccessToken } from "@/lib/api/config"
import { CompanyAPI } from "@/lib/api/company"

// =============================
// Types
// =============================

export type TokenResponse = {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
}

export type MessageResponse = { message: string }

export type LoginRequest = {
  email: string
  password: string
}

export type RegisterSchema = {
  email: string
  password: string
  username: string
  first_name?: string
  last_name?: string
  terms_accepted: boolean
}

export type PasswordResetRequestSchema = { email: string }
export type PasswordResetConfirmSchema = { token: string; new_password: string }
export type PasswordResetCancelSchema = { token: string }

export type UserMe = {
  id: string
  email: string
  full_name?: string | null
  is_active?: boolean
}

export type SessionInfo = {
  id: string
  ip?: string | null
  user_agent?: string | null
  created_at?: string | null
  last_seen_at?: string | null
  is_current?: boolean
  [k: string]: unknown
}

// =============================
// Error utils
// =============================

type ApiErrorShape = {
  response?: { data?: { detail?: unknown; message?: string } }
  message?: string
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "string") return err
  if (err && typeof err === "object") {
    const anyErr = err as ApiErrorShape
    const d = anyErr?.response?.data
    if (typeof d?.detail === "string") return d.detail
    if (d?.detail && Array.isArray(d.detail) && d.detail.length) {
      const first = d.detail[0] as { msg?: string }
      if (typeof first?.msg === "string") return first.msg
    }
    if (typeof d?.message === "string") return d.message
    if (typeof anyErr?.message === "string") return anyErr.message
  }
  return "Unexpected error"
}

// =============================
// Core auth actions
// =============================

export async function register(payload: RegisterSchema): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/register", payload)
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  try {
    const { data } = await api.post<TokenResponse>("auth/login", credentials)
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

export async function refresh(): Promise<TokenResponse> {
  try {
    const { data } = await api.post<TokenResponse>("auth/refresh")
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

export async function logout(): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/logout")
    clearTokens()
    return data
  } catch (err) {
    clearTokens()
    throw new Error(extractErrorMessage(err))
  }
}

export async function logoutAll(): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/logout-all")
    clearTokens()
    return data
  } catch (err) {
    clearTokens()
    throw new Error(extractErrorMessage(err))
  }
}

export async function revokeRefresh(): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/revoke")
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

export async function revokeAllRefresh(): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/revoke-all")
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

export async function validateRefresh(): Promise<{ valid: boolean } & Record<string, unknown>> {
  try {
    const { data } = await api.get("auth/validate")
    return data as { valid: boolean } & Record<string, unknown>
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

// =============================
// Email verification
// =============================

export async function resendVerification(email: string): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/resend-verification", { email })
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

export async function verifyEmail(token: string, email: string): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/verify-email", null, { params: { token, email } })
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}
export { verifyEmail as verifyEmailToken }
export { verifyEmail as verifyEmailByToken }

// =============================
// Password reset
// =============================

export async function requestPasswordReset(payload: PasswordResetRequestSchema): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/password-reset/request", payload)
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

export async function confirmPasswordReset(payload: PasswordResetConfirmSchema): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/password-reset/confirm", payload)
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

export async function cancelPasswordReset(payload: PasswordResetCancelSchema): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("auth/password-reset/cancel", payload)
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

// =============================
// Sessions
// =============================

export async function getSessions(): Promise<SessionInfo[]> {
  try {
    const { data } = await api.get<SessionInfo[]>("auth/sessions")
    return data
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

// =============================
// Me (через membership)
// =============================

export async function getMe(): Promise<UserMe> {
  try {
    const membership = await CompanyAPI.getCurrentMembership()
    const user = membership?.user
    if (!user) throw new Error("No active membership found")
    return {
      id: user.id,
      email: user.email || "",
      full_name: user.full_name ?? null,
      is_active: user.is_active,
    }
  } catch (err) {
    throw new Error(extractErrorMessage(err))
  }
}

// =============================
// Tiny helpers
// =============================

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken())
}

// =============================
// Compatibility service
// =============================

export const apiService = {
  auth: {
    login,
    logout,
    register,
    refresh,
    getMe,
    isAuthenticated,
    requestPasswordReset,
    confirmPasswordReset,
    verifyEmail,
    resendVerification,
  },
}
