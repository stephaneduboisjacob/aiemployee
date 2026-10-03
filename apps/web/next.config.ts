import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@aios/ui'],
  output: 'standalone',
};

export default nextConfig;
