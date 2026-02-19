// Temporarily disable PWA to fix 503 error
// const withPWA = require('next-pwa');
// const pwa = withPWA({ ... });

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  output: 'standalone',
};

module.exports = nextConfig;
