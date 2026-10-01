import type { NextConfig } from 'next';

const config: NextConfig = {
  // Let browser tests run alongside the developer's existing local server.
  distDir: process.env.PLAYWRIGHT_TEST_SERVER === 'true' ? '.next/browser-tests' : '.next',
};
export default config;
