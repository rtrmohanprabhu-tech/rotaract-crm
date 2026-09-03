/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit / googleapis / sharp must stay on the Node runtime and out of the bundler.
  serverExternalPackages: ['pdfkit', 'sharp', 'googleapis', '@prisma/client', 'bcryptjs'],
  experimental: {
    serverActions: {
      // Board members upload photos straight from their phones.
      bodySizeLimit: '25mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
    ],
  },
};

export default nextConfig;
