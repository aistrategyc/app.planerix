/** @type {import('next').NextConfig} */

// Environment-aware configuration
const isDevelopment = process.env.NODE_ENV === 'development'

// Configure origins based on environment
const APP_ORIGIN = isDevelopment
  ? 'http://localhost:3002'  // Development web-enterprise port
  : process.env.NEXT_PUBLIC_APP_URL || 'https://app.planerix.com'

const API_ORIGIN = isDevelopment
  ? 'http://localhost:8001'  // Development API port
  : process.env.NEXT_PUBLIC_API_URL || 'https://api.planerix.com'

// Content Security Policy
const csp = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self' ${API_ORIGIN};
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  compress: !isDevelopment, // Only compress in production

  eslint: {
    // Only ignore during builds in development
    ignoreDuringBuilds: isDevelopment,
  },

  typescript: {
    // Only ignore type errors during builds in development
    ignoreBuildErrors: isDevelopment,
  },

  async redirects() {
    return [
      { source: '/login', destination: `${APP_ORIGIN}/login`, permanent: false },
      { source: '/register', destination: `${APP_ORIGIN}/register`, permanent: false },
      { source: '/app', destination: `${APP_ORIGIN}`, permanent: false },
      { source: '/dashboard', destination: `${APP_ORIGIN}/dashboard`, permanent: false },
    ]
  },

  async headers() {
    const headers = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
    ]

    // Add HSTS only in production
    if (!isDevelopment) {
      headers.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      })
    }

    // Add CSP
    headers.push({
      key: 'Content-Security-Policy',
      value: csp.replace(/\s{2,}/g, ' ').trim()
    })

    return [
      {
        source: '/(.*)',
        headers,
      },
    ]
  },

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: isDevelopment ? 0 : 60,
  },

  // Development-specific settings
  ...(isDevelopment && {
    experimental: {
      turbo: {
        loaders: {
          '.svg': ['@svgr/webpack'],
        },
      },
    },
  }),
}

module.exports = nextConfig