// src/lib/ui/errorToMessage.ts
interface APIErrorDetail {
  type?: string
  loc?: unknown[]
  msg?: string
  input?: unknown
  ctx?: Record<string, unknown>
}

export function errorToMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as { detail?: unknown; message?: unknown }

    if (err.detail) {
      if (typeof err.detail === 'string') return err.detail
      if (Array.isArray(err.detail)) {
        return err.detail
          .map((e: APIErrorDetail) => e.msg || JSON.stringify(e))
          .join(', ')
      }
      if (typeof err.detail === 'object') {
        const detail = err.detail as { msg?: string }
        return detail.msg || JSON.stringify(detail)
      }
    }

    if (typeof err.message === 'string') return err.message
  }

  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}
