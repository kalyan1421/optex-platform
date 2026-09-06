// Origin the /api/* rewrite proxies to. Defaults to the `pnpm dev:api` port
// (1111); override with API_PROXY_ORIGIN when the API is elsewhere, e.g.
// http://127.0.0.1:4000 for the Docker container or an internal service URL.
// 127.0.0.1 rather than localhost to avoid Node IPv6 resolution quirks.
// Trailing slash stripped: a value like "https://api.example.com/" turns the
// rewrite destination below into "https://api.example.com//api/:path*" — a
// double slash Nest's router treats as a different, nonexistent path, so
// every proxied request silently 404s with no build-time or runtime warning.
const API_PROXY_ORIGIN = (
  process.env.API_PROXY_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:1111'
).replace(/\/+$/, '');

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
/** HTTPS-only hardening is skipped in dev, where the server speaks plain http. */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  // Emits .next/standalone: a self-contained server bundle with only the
  // node_modules it actually imports. Without it the Docker runtime stage has
  // to carry the whole pnpm workspace, which for this monorepo is most of the
  // image. Has no effect on `next dev` or on a non-Docker `next start`.
  output: 'standalone',

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
              // Product images come from Supabase Storage. `https:` alone misses
              // local Docker Supabase, which serves storage over plain http on
              // :54321, so every uploaded product thumbnail was CSP-blocked in
              // dev and rendered as a broken image. apps/web already appends
              // the origin here; this config was never brought in line.
              `img-src 'self' data: blob: https: ${supabaseOrigin()}`.trim(),
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
              'frame-src https://www.google.com/maps/ https://maps.google.com',
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              // Production-only: over plain http (local dev) this upgrades
              // same-origin requests to https, and Next's RSC prefetches then
              // die with ERR_SSL_PROTOCOL_ERROR against a dev server that
              // speaks no TLS. Next falls back to a full browser navigation,
              // so the app still works but every client-side link reloads the
              // page. Deployments are https end-to-end, where the directive
              // does its real job.
              ...(isProd ? ['upgrade-insecure-requests'] : []),
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
