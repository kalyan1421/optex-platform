/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@optex/ui', '@optex/db', '@optex/config', '@optex/validators', '@optex/api-client'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
}

module.exports = nextConfig
