/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  assetPrefix: isProd ? 'https://d1mzs3dojvfqpz.cloudfront.net' : undefined,
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'canvas'],
  images: {
    unoptimized: isProd ? true : false,
    remotePatterns: [
  {
    protocol: 'https',
    hostname: 'images.unsplash.com',
  },
  {
    protocol: 'https',
    hostname: 'pms.tiramis.co.jp',
  },
  {
    protocol: 'https',
    hostname: 'd1mzs3dojvfqpz.cloudfront.net',
  },
  {
    protocol: 'https',
    hostname: 'pms-uploads-tiramis.s3.ap-northeast-1.amazonaws.com',
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