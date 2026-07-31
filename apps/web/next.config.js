/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@optex/ui',
    '@optex/db',
    '@optex/config',
    '@optex/validators',
    '@optex/api-client',
  ],
  images: {
    remotePatterns: [
      // H-4 FIX: Supabase Storage — wildcard covers both hosted projects
      // (*.supabase.co) and self-hosted / custom CDN domains.
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      // Local Docker Supabase (storage-api on port 54321 via Kong)
      { protocol: 'http', hostname: '127.0.0.1', port: '54321' },
      { protocol: 'http', hostname: 'localhost', port: '54321' },
      // Dev / placeholder images
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Use 127.0.0.1 to avoid Node IPv6 resolution quirks with Docker
        destination: 'http://127.0.0.1:4000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
