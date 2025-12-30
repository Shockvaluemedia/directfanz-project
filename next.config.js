const withPWA = require('next-pwa');

const pwa = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
    {
      urlPattern: /.*\.(?:png|jpg|jpeg|svg|gif|webp)/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /.*\.(?:js|css)/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
      },
    },
    {
      urlPattern: /^\/api\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
      },
    },
  ],
  buildExcludes: [/middleware-manifest\.json$/],
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily skip TypeScript checking for development
  typescript: {
    ignoreBuildErrors: true,
  },
  // Temporarily skip ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize React Fast Refresh
  reactStrictMode: true,

  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    // Enable debugging for development issues
    optimizePackageImports: ['@heroicons/react'],
  },

  // Configure webpack to handle Node.js built-ins
  webpack: (config, { isServer, dev }) => {
    // For client-side builds, provide fallbacks for Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer',
        fs: false,
        path: false,
        os: false,
      };
    }

    // Optimize webpack for better performance and smaller bundles
    if (!dev) {
      // Enable tree shaking
      config.optimization.usedExports = true;
      
      // Better chunk splitting
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          common: {
            minChunks: 2,
            name: 'common',
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };
    }

    // Reduce webpack cache serialization warnings
    config.optimization.concatenateModules = true;
    
    return config;
  },

  // Enable CDN caching for static assets
  assetPrefix: process.env.NODE_ENV === 'production' ? process.env.CDN_URL : undefined,

  // Configure image optimization and CDN
  images: {
    domains: ['localhost', 'your-s3-bucket.s3.amazonaws.com', 'images.unsplash.com'],
    // Add CDN domain if configured
    ...(process.env.CDN_DOMAIN && {
      domains: ['localhost', 'your-s3-bucket.s3.amazonaws.com', 'images.unsplash.com'],
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
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400', // 24 hours
          },
        ],
      },
    ];
  },

  // Enable standalone output for Docker and ECS
  output: 'standalone',

  // Configure for AWS deployment
  ...(process.env.NODE_ENV === 'production' && {
    // Optimize for ECS deployment
    poweredByHeader: false,
    generateEtags: false,
    
    // Configure for ALB health checks
    async rewrites() {
      return [
        {
          source: '/health',
          destination: '/api/health?source=alb',
        },
        {
          source: '/healthz',
          destination: '/api/health?source=alb',
        },
      ];
    },
  }),
};

// Injected content via Sentry wizard below
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = pwa(
  withSentryConfig(
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
  )
);
