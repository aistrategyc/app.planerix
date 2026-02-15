/**
 * Rate limiting and request management utilities for analytics
 */

import { useRef, useCallback } from 'react'

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

class RateLimiter {
  private requests: number[] = []
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  canMakeRequest(): boolean {
    const now = Date.now()

    // Remove expired requests from the window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.config.windowMs
    )

    // Check if we can make a new request
    if (this.requests.length < this.config.maxRequests) {
      this.requests.push(now)
      return true
    }

    return false
  }

  getNextAvailableTime(): number {
    if (this.requests.length === 0) return 0

    const oldestRequest = Math.min(...this.requests)
    return oldestRequest + this.config.windowMs - Date.now()
  }

  getMaxRequests(): number {
    return this.config.maxRequests
  }

  getRequestCount(): number {
    return this.requests.length
  }
}

// Global rate limiter for analytics requests
const analyticsRateLimiter = new RateLimiter({
  maxRequests: 10, // Max 10 requests
  windowMs: 60 * 1000, // Per minute
})

/**
 * Hook for rate-limited analytics requests
 */
export function useAnalyticsRateLimit() {
  const lastRequestTime = useRef<Record<string, number>>({})

  const checkRateLimit = useCallback((endpoint: string): boolean => {
    const now = Date.now()
    const lastRequest = lastRequestTime.current[endpoint] || 0
    const minInterval = 2000 // Minimum 2 seconds between same endpoint calls

    // Check endpoint-specific rate limit
    if (now - lastRequest < minInterval) {
      console.warn(`Rate limit: Too frequent requests to ${endpoint}`)
      return false
    }

    // Check global rate limit
    if (!analyticsRateLimiter.canMakeRequest()) {
      const waitTime = analyticsRateLimiter.getNextAvailableTime()
      console.warn(`Global rate limit reached. Try again in ${Math.ceil(waitTime / 1000)} seconds`)
      return false
    }

    lastRequestTime.current[endpoint] = now
    return true
  }, [])

  const getRemainingRequests = useCallback(() => {
    return analyticsRateLimiter.getMaxRequests() - analyticsRateLimiter.getRequestCount()
  }, [])

  return {
    checkRateLimit,
    getRemainingRequests,
  }
}

/**
 * Debounce utility for preventing rapid fire requests
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedCallback = useCallback(
    ((...args: Parameters<T>) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    }) as T,
    [callback, delay]
  )

  return debouncedCallback
}

/**
 * Request queue for managing analytics requests
 */
class RequestQueue {
  private queue: (() => Promise<any>)[] = []
  private processing = false
  private readonly concurrency: number
  private activeRequests = 0

  constructor(concurrency = 3) {
    this.concurrency = concurrency
  }

  async add<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await requestFn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.activeRequests >= this.concurrency) {
      return
    }

    this.processing = true

    while (this.queue.length > 0 && this.activeRequests < this.concurrency) {
      const request = this.queue.shift()
      if (request) {
        this.activeRequests++

        request()
          .finally(() => {
            this.activeRequests--
            this.processQueue()
          })
      }
    }

    this.processing = false
  }
}

const analyticsRequestQueue = new RequestQueue(3) // Max 3 concurrent requests

/**
 * Hook for queued analytics requests
 */
export function useAnalyticsQueue() {
  const queueRequest = useCallback(<T>(requestFn: () => Promise<T>): Promise<T> => {
    return analyticsRequestQueue.add(requestFn)
  }, [])

  return { queueRequest }
}
