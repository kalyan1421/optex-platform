// Origin the /api/* rewrite proxies to. Defaults to the `pnpm dev:api` port
// (1111); override with API_PROXY_ORIGIN when the API is elsewhere, e.g.
// http://127.0.0.1:4000 for the Docker container or an internal service URL.
// 127.0.0.1 rather than localhost to avoid Node IPv6 resolution quirks.
const API_PROXY_ORIGIN =
  process.env.API_PROXY_ORIGIN || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:1111';

/**
 * Origin of the Supabase instance the BROWSER talks to, for the CSP below.
 * See apps/web/next.config.js for the full reasoning — in short, a bare
 * `connect-src 'self'` blocks the Supabase auth client and breaks sign-in.
 */
function supabaseOrigin() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

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
      // H-4 FIX: Supabase Storage (hosted + self-hosted)
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'http', hostname: '127.0.0.1', port: '54321' },
      { protocol: 'http', hostname: 'localhost', port: '54321' },
      // Dev / placeholder images
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      // Reference product photos from the client's catalogue spreadsheet —
      // see migration 0030_client_catalog_import.sql.
      { protocol: 'https', hostname: 'lens2cart.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_ORIGIN}/api/:path*`,
      },
    ];
  },

  // F-09 FIX: the admin panel shipped with no security headers at all, which
  // made it the sharpest edge of that finding — a frameable super-admin session
  // that can cancel orders, edit prices and read prescription files. Stricter
  // than the storefront's policy because nothing here is public.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Stricter than the storefront: an admin URL can carry an order or
          // customer id, and there is no reason for any of it to leave.
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // An admin panel has no business being indexed, whatever robots.txt
          // says — this is the header search engines actually honour.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // Same-origin for the API, plus the Supabase origin the admin
              // middleware and browser client authenticate against.
              `connect-src 'self' ${supabaseOrigin()}`.trim(),
              // Branches.tsx embeds a Google Maps iframe per branch
              // (maps.google.com/maps?...&output=embed). With no frame-src,
              // that fell back to default-src 'self' and silently blocked it
              // — same bug as apps/web/next.config.js. maps.google.com
              // redirects to www.google.com/maps/embed?..., scoped to /maps/
              // rather than the bare origin.
              "frame-src https://www.google.com/maps/ https://maps.google.com",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
