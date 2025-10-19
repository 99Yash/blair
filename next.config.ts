import type { NextConfig } from 'next';
import process from 'process';

const nextConfig: NextConfig = {
  experimental: {
    browserDebugInfoInTerminal: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
