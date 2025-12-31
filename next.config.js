// Temporarily disable PWA to fix 503 error
// const withPWA = require('next-pwa');
// const pwa = withPWA({ ... });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable TypeScript checking for production builds
  typescript: {
    ignoreBuildErrors: false,
  },
  // Enable ESLint during builds
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src', 'pages'],
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

// Temporarily disable Sentry to fix 503 error
// const { withSentryConfig } = require('@sentry/nextjs');

module.exports = nextConfig;
