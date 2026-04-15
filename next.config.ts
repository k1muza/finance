import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent @react-pdf/renderer from being bundled for the browser
  serverExternalPackages: ['@react-pdf/renderer'],
  async redirects() {
    return [
      {
        source: '/dashboard/finance/income',
        destination: '/dashboard/finance/cashbook',
        permanent: true,
      },
      {
        source: '/dashboard/finance/expenditure',
        destination: '/dashboard/finance/cashbook',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
