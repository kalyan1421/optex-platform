// Origin the /api/* rewrite proxies to. Defaults to the `pnpm dev:api` port
// (1111); override with API_PROXY_ORIGIN when the API is elsewhere, e.g.
// http://127.0.0.1:4000 for the Docker container or an internal service URL.
// 127.0.0.1 rather than localhost to avoid Node IPv6 resolution quirks.
// Trailing slash stripped: a value like "https://api.example.com/" turns the
// rewrite destination below into "https://api.example.com//api/:path*" — a
// double slash Nest's router treats as a different, nonexistent path, so
// every proxied request silently 404s with no build-time or runtime warning.
const API_PROXY_ORIGIN = (
  process.env.API_PROXY_ORIGIN || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:1111'
).replace(/\/+$/, '');

/**
 * Origin of the Supabase instance the BROWSER talks to, for the CSP below.
 *
 * The storefront's Supabase client (auth session, token refresh, storage reads)
 * runs in the browser and connects to `NEXT_PUBLIC_SUPABASE_URL` — a different
 * origin to this app: Kong on :54321 locally, `*.supabase.co` in production. A
 * bare `connect-src 'self'` blocks every one of those requests, which silently
 * breaks sign-in and made the checkout e2e specs hang on a page that never
 * settled. Derived rather than hardcoded so each environment allows its own.
 */
function supabaseOrigin() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    // A malformed URL must not take the whole build down; the app will fail
    // loudly elsewhere if Supabase is genuinely misconfigured.
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
      // Reference product photos from the client's catalogue spreadsheet
      // (Optex_Client_Input_Form_filled.xlsx) — real photography is still
      // pending, see migration 0030_client_catalog_import.sql.
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

  // F-09 FIX: the API sets security headers via helmet, but those only cover
  // API responses — the storefront itself shipped with none at all. Everything
  // below is a header the browser enforces on our behalf and that costs nothing
  // to send.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Nothing here should ever be framed. The storefront has no reason to
          // be embedded, and a frameable checkout is a clickjacking target.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stops a browser second-guessing our Content-Type — the sniffing
          // that turns a user-uploaded file into executable script.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Send the origin cross-site, the full URL same-origin. Order ids and
          // tracking tokens live in our paths and must not leak to third
          // parties in a Referer header.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The storefront asks for none of these; deny them by default so a
          // future dependency cannot quietly start.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
          // Two years, subdomains included. Kenyan mobile networks are a common
          // place for downgrade interception, and this site takes payments.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-inline'/'unsafe-eval' are required by Next's own
              // bootstrap and dev refresh. Removing them needs the nonce-based
              // setup, which is a separate change — this is the policy that can
              // ship today without breaking the app, not the endpoint.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Tailwind and Next inject style tags at runtime. The Google
              // Fonts stylesheet is loaded from `app/layout.jsx` — omitting
              // fonts.googleapis.com here silently drops every custom face and
              // the whole site renders in Times New Roman.
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Product images come from Supabase Storage; data: covers inlined
              // placeholders and blob: the client-side previews. `https:` alone
              // misses local Docker Supabase, which serves storage over plain
              // http on :54321 — the explicit origin covers that dev case too.
              `img-src 'self' data: blob: https: ${supabaseOrigin()}`.trim(),
              // The face files themselves come from the gstatic host, which is
              // a different origin to the stylesheet above.
              "font-src 'self' data: https://fonts.gstatic.com",
              // Same-origin for the API (the /api rewrite proxies onward), plus
              // the Supabase origin the browser client authenticates against.
              `connect-src 'self' ${supabaseOrigin()}`.trim(),
              // The branch locator and the contact page both embed a Google
              // Maps iframe (maps.google.com/maps?...&output=embed). With no
              // frame-src, that fell back to default-src 'self' and silently
              // blocked both maps. maps.google.com redirects to
              // www.google.com/maps/embed?..., and CSP re-checks frame-src
              // against the post-redirect URL, so that origin is needed too —
              // scoped to /maps/ rather than the bare origin so this doesn't
              // also allow framing unrelated www.google.com surfaces.
              "frame-src https://www.google.com/maps/ https://maps.google.com",
              // The counterpart to X-Frame-Options, for browsers that prefer it.
              "frame-ancestors 'none'",
              // Nothing on this site posts to another origin.
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

module.exports = nextConfig;
