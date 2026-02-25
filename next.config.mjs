/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  assetPrefix: isProd ? 'https://d1mzs3dojvfqpz.cloudfront.net' : undefined,
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'canvas'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '55mb',
    },
    proxyClientMaxBodySize: '55mb',
  },
};

export default nextConfig;