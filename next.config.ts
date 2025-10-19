import type { NextConfig } from 'next';
import process from 'process';

const nextConfig: NextConfig = {
  experimental: {
    browserDebugInfoInTerminal: process.env.NODE_ENV === 'development',
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
