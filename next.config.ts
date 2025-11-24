import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Aumentar limite de upload para 100MB
    serverActions: {
      bodySizeLimit: '100mb',
    },
    // Otimizar tamanho da função
    outputFileTracingIncludes: {
      '/api/audio/upload': ['./lib/**/*'],
    },
    outputFileTracingExcludes: {
      '/api/audio/upload': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild',
        'node_modules/webpack',
      ],
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
  // Otimizar output
  output: 'standalone',
};

export default nextConfig;
