import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required by apps/web/Dockerfile.prod (runtime stage).
  output: 'standalone',
  transpilePackages: ['@ai-padrao/ui', '@ai-padrao/contracts'],
  experimental: { typedRoutes: true },
};

export default nextConfig;