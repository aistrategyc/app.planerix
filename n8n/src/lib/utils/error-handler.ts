// ✅ Утилиты для обработки ошибок

import { AxiosError } from 'axios'
import type { APIError } from '@/types/api'

export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public status: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

const coerceDetailToString = (detail: unknown): string => {
  if (typeof detail === "string") return detail
  if (detail === null || detail === undefined) return ""
  if (typeof detail === "number" || typeof detail === "boolean") return String(detail)
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

export function parseAPIError(error: unknown): APIError {
  if (error instanceof AxiosError) {
    const response = error.response?.data as
      | { type?: string; title?: string; detail?: unknown; status?: number }
      | undefined
    
    // Если есть стандартный API error format
    if (response?.type && response?.title && response?.detail) {
      return {
        type: response.type,
        title: response.title,
        detail: coerceDetailToString(response.detail) || "Server error",
        status: response.status || error.response?.status || 500
      }
    }
    
    // Если есть detail field (FastAPI format)
    if (response?.detail) {
      let detail: string = coerceDetailToString(response.detail) || "Server error"
      
      if (Array.isArray(response.detail)) {
        const msgs = response.detail
          .map((entry) => {
            if (entry && typeof entry === 'object') {
              const candidate = entry as { msg?: unknown; message?: unknown }
              if (typeof candidate.msg === 'string') return candidate.msg
              if (typeof candidate.message === 'string') return candidate.message
            }
            return null
          })
          .filter((msg): msg is string => Boolean(msg))
        detail = msgs.length ? msgs.join(', ') : 'Validation error'
      } else if (typeof response.detail === 'object' && response.detail !== null) {
        const detailObj = response.detail as { detail?: unknown; title?: unknown }
        const nestedDetail = typeof detailObj.detail === "string" ? detailObj.detail : undefined
        const nestedTitle = typeof detailObj.title === "string" ? detailObj.title : undefined
        detail = nestedDetail || nestedTitle || detail
      }
      
      return {
        type: 'api-error',
        title: getErrorTitle(error.response?.status),
        detail: detail,
        status: error.response?.status || 500
      }
    }
    
    // Generic axios error
    return {
      type: 'network-error',
      title: getErrorTitle(error.response?.status),
      detail: error.message || 'Network error occurred',
      status: error.response?.status || 500
    }
  }
  
  // Generic error
  return {
    type: 'unknown-error',
    title: 'Unknown Error',
    detail: error instanceof Error ? error.message : 'An unknown error occurred',
    status: 500
  }
}

function getErrorTitle(status?: number): string {
  switch (status) {
    case 400: return 'Bad Request'
    case 401: return 'Unauthorized'
    case 403: return 'Forbidden'
    case 404: return 'Not Found'
    case 409: return 'Conflict'
    case 422: return 'Validation Error'
    case 429: return 'Too Many Requests'
    case 500: return 'Internal Server Error'
    default: return 'Error'
  }
}

export function getErrorMessage(error: unknown): string {
  return parseAPIError(error).detail
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    const status = error.response?.status
    // Retry на network errors и 5xx статусах, но не на 4xx
    return !status || status >= 500
  }
  return false
}
