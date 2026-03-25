/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  reactStrictMode: true,
  output: 'standalone', // required for Docker / ECS deployment

  images: {
    remotePatterns: [
      // S3 bucket
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
      },
      // CloudFront CDN (if configured)
      ...(process.env.AWS_CLOUDFRONT_DOMAIN
        ? [{ protocol: 'https', hostname: process.env.AWS_CLOUDFRONT_DOMAIN }]
        : []),
    ],
  },
};

module.exports = nextConfig;
