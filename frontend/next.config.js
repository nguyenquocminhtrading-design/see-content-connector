/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL || 'http://localhost:4000';
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    // Ensure backend URL has a scheme
    let effectiveBackend = backend;
    if (!backend.startsWith('http://') && !backend.startsWith('https://')) {
      // In development, we use http; in production, we use https
      effectiveBackend = process.env.NODE_ENV === 'development'
        ? `http://${backend}`
        : `https://${backend}`;
    }
    // Proxy /api/* to the Express backend so the frontend can use relative URLs.
    return [{ source: '/api/:path*', destination: `${effectiveBackend}/api/:path*` }];
  },
};
module.exports = nextConfig;