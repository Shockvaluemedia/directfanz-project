const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  reactStrictMode: true,
  // Prevent bundling of server-only packages that use dynamic require
  serverExternalPackages: [
    'fluent-ffmpeg',
    'ffmpeg-static',
    'ffprobe-static',
    'sharp',
    '@sentry/node',
    '@opentelemetry/instrumentation',
    'require-in-the-middle',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
};

module.exports = withPWA(nextConfig);
