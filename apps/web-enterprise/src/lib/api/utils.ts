// apps/web-enterprise/src/lib/api/utils.ts
// Unified API response handling and error utilities

import { AxiosResponse } from 'axios';

// =============================
// Response Types
// =============================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages?: number;
}

export interface SingleResponse<T> {
  data?: T;
  message?: string;
}

export interface ErrorResponse {
  detail: string | Array<{ msg: string; type: string }>;
  message?: string;
  type?: string;
  status?: number;
}

// =============================
// Response Extractors
// =============================

/**
 * Extract data from various response formats
 */
export function extractResponseData<T>(response: AxiosResponse<unknown>): T {
  const { data } = response;

  // Handle paginated responses with .items
  if (data && typeof data === 'object' && 'items' in data) {
    return data.items as T;
  }

  // Handle wrapped responses with .data
  if (data && typeof data === 'object' && 'data' in data) {
    return data.data as T;
  }

  // Return raw data
  return data as T;
}

/**
 * Extract single item from response (handle both direct and wrapped)
 */
export function extractSingleItem<T>(response: AxiosResponse<unknown>): T {
  const { data } = response;

  // Handle wrapped responses
  if (data && typeof data === 'object' && 'data' in data) {
    return data.data as T;
  }

  // Return raw data
  return data as T;
}

/**
 * Extract list/array from response
 */
export function extractList<T>(response: AxiosResponse<unknown>): T[] {
  const { data } = response;

  // Handle paginated responses
  if (data && typeof data === 'object' && 'items' in data) {
    return data.items as T[];
  }

  // Handle direct arrays
  if (Array.isArray(data)) {
    return data as T[];
  }

  // Handle wrapped arrays
  if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
    return data.data as T[];
  }

  // Fallback: return empty array
  console.warn('Could not extract list from response, returning empty array:', data);
  return [] as T[];
}

// =============================
// Error Extraction
// =============================

export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const anyError = error as {
      response?: { data?: unknown }
      message?: unknown
    };

    // Handle Axios error response
    const responseData = anyError?.response?.data;
    if (responseData) {
      // Handle FastAPI validation errors
      if (typeof responseData === 'object' && responseData !== null && 'detail' in responseData) {
        const detail = (responseData as { detail?: unknown }).detail;
        if (Array.isArray(detail)) {
          const firstError = detail[0] as { msg?: unknown } | undefined;
          if (firstError && typeof firstError.msg === 'string') {
            return firstError.msg;
          }
        }

        // Handle simple error detail
        if (typeof detail === 'string') {
          return detail;
        }
      }

      // Handle message field
      if (typeof responseData === 'object' && responseData !== null && 'message' in responseData) {
        const message = (responseData as { message?: unknown }).message;
        if (typeof message === 'string') {
          return message;
        }
      }
    }

    // Handle direct error message
    if (typeof anyError.message === 'string') {
      return anyError.message;
    }
  }

  return 'Unexpected error occurred';
}

// =============================
// API Call Wrapper
// =============================

/**
 * Wrapper for API calls with standardized error handling
 */
export async function apiCall<T>(
  apiPromise: Promise<AxiosResponse<unknown>>,
  options: {
    extractType?: 'single' | 'list' | 'raw';
    errorContext?: string;
  } = {}
): Promise<T> {
  const { extractType = 'raw', errorContext = 'API call' } = options;

  try {
    const response = await apiPromise;

    switch (extractType) {
      case 'single':
        return extractSingleItem<T>(response);
      case 'list':
        return extractList<T>(response) as unknown as T;
      case 'raw':
      default:
        return extractResponseData<T>(response);
    }
  } catch (error) {
    const message = extractErrorMessage(error);
    console.error(`${errorContext} failed:`, message, error);
    throw new Error(message);
  }
}

// =============================
// Request Helpers
// =============================

export function buildQueryParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// =============================
// Type Guards
// =============================

export function isPaginatedResponse<T>(data: unknown): data is PaginatedResponse<T> {
  if (!data || typeof data !== "object") return false
  const obj = data as Record<string, unknown>
  return Array.isArray(obj.items) && typeof obj.total === "number"
}

export function isErrorResponse(data: unknown): data is ErrorResponse {
  if (!data || typeof data !== "object") return false
  const obj = data as Record<string, unknown>
  return "detail" in obj || "message" in obj
}
