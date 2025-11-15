import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Aumentar limite de upload para 100MB
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // Configurar limite de body para API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  // IMPORTANTE: Desabilitar compressão para uploads grandes
  compress: false,
};

export default nextConfig;
