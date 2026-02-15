/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    // Ignore during builds for now - we'll fix linting issues later
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore type errors during builds for now
    ignoreBuildErrors: true,
  },

  // Experimental features for better performance
/*  experimental: {
    serverComponentsExternalPackages: ['axios'],
  },*/
  serverExternalPackages: ['axios'],

  async rewrites() {
    // КРИТИЧЕСКИ ВАЖНО: Разные настройки для dev и prod
    if (process.env.NODE_ENV === 'development') {
      // В dev режиме НЕ перенаправляем, используем локальный backend
      return []
    }

    // В production используем явный origin, если задан, иначе падаем на домен
    const apiOrigin =
      process.env.NEXT_PUBLIC_API_ORIGIN ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_DOMAIN ||
      process.env.API_DOMAIN ||
      'https://n8n-api.itstep.org'

    const normalizedOrigin = apiOrigin.endsWith("/")
      ? apiOrigin.slice(0, -1)
      : apiOrigin

    const destination =
      normalizedOrigin.startsWith('http://') || normalizedOrigin.startsWith('https://')
        ? `${normalizedOrigin}/api/:path*`
        : `https://${normalizedOrigin}/api/:path*`

    return [
      {
        source: "/api/:path*",
        destination
      }
    ]
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },

  // Webpack optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!dev && !isServer) {
      // Production optimizations
      config.optimization.splitChunks.cacheGroups.commons = {
        name: 'commons',
        chunks: 'all',
        minChunks: 2,
      }
    }
    return config
  },
}

module.exports = nextConfig
