/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const proxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, '');

    if (!proxyTarget) {
      return [];
    }

    return [
      {
        source: '/api/v1/:path*',
        destination: `${proxyTarget}/api/v1/:path*`
      },
      {
        source: '/healthz',
        destination: `${proxyTarget}/healthz`
      }
    ];
  }
};

module.exports = nextConfig;
