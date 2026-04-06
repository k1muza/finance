import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent @react-pdf/renderer from being bundled for the browser
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
