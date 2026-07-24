/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@optex/ui', '@optex/db', '@optex/config', '@optex/validators', '@optex/api-client'],
  images: {
    remotePatterns: [
      // H-4 FIX: Supabase Storage (hosted + self-hosted)
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'http',  hostname: '127.0.0.1', port: '54321' },
      { protocol: 'http',  hostname: 'localhost',  port: '54321' },
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
        destination: 'http://127.0.0.1:4000/api/:path*',
      },
    ];
  },
}

export default nextConfig
