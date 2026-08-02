// Temporarily disable PWA to fix 503 error
// const withPWA = require('next-pwa');
// const pwa = withPWA({ ... });

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: false,
  output: 'standalone',
  webpack: (config, { isServer }) => {
    // Fix for SendGrid fs module issue
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
