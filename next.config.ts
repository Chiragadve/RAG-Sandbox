import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Proxy body size limit for large file uploads (replaces deprecated middlewareClientMaxBodySize)
    proxyClientMaxBodySize: '50mb',
  },
  // Externalize native dependencies for server-side processing
  serverExternalPackages: ['canvas', 'pdf-to-png-converter', 'tesseract.js'],
  // Next.js 16 uses Turbopack by default - empty config to silence warnings
  turbopack: {},
};


export default nextConfig;
