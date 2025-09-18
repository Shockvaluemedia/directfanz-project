/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize React Fast Refresh
  reactStrictMode: true,
  
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    // Enable debugging for development issues
    optimizePackageImports: ['@heroicons/react']
  },
  
  // Configure webpack to handle Node.js built-ins
  webpack: (config, { isServer }) => {
    // For client-side builds, provide fallbacks for Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer',
      };
    }
    return config;
  },
  
  // Enable CDN caching for static assets
  assetPrefix: process.env.NODE_ENV === 'production' ? process.env.CDN_URL : undefined,
  
  // Configure image optimization and CDN
  images: {
    domains: ['localhost', 'your-s3-bucket.s3.amazonaws.com'],
    // Add CDN domain if configured
    ...(process.env.CDN_DOMAIN && {
      domains: ['localhost', 'your-s3-bucket.s3.amazonaws.com', process.env.CDN_DOMAIN]
    }),
    // Optimize images
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Enable static file compression
  compress: true,
  
  // Configure HTTP caching headers
  async headers() {
    return [
      {
        // Cache static assets with a long TTL
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache images with a medium TTL
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
  
  // Enable standalone output for Docker
  output: 'standalone',
}

// Injected content via Sentry wizard below
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: false,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: '/monitoring',

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  }
);