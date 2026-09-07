import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          // H-6 FIX: expire the cookie via maxAge: 0 rather than setting an
          // empty value — an empty-value cookie persists in some browsers and
          // continues to be sent with subsequent requests, preventing true logout.
          const deleteOptions = { ...options, maxAge: 0 };
          request.cookies.set({ name, value: '', ...deleteOptions });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...deleteOptions });
        },
      },
    },
  );

  // Refresh the session so it doesn't expire silently.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // P-12: gate the customer-only routes here rather than after hydration.
  //
  // This middleware used to refresh the session and nothing else, so every
  // protected page served its full HTML to an anonymous request and redirected
  // from a client effect once React had mounted. No customer data leaked — the
  // fetches all need the token — but the protected page's shell and <title>
  // rendered first, which reads as a flash of a page you are not allowed to
  // see. Doing it here means the anonymous visitor gets a 307 and never
  // receives that markup at all.
  //
  // The `redirect` param is carried so the visitor lands back where they were
  // going after signing in — that is what makes the cart → checkout → login →
  // back journey survive the gate. Named `redirect` because `app/login/page.jsx`
  // already reads that param, and already rejects anything that is not a
  // same-site relative path.
  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    login.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  return response;
}

/**
 * Routes that require a signed-in customer.
 *
 * Prefix-matched so nested paths are covered without listing each one —
 * `/orders/:id/tracking` and `/profile/addresses` are as private as their
 * parents. Kept in sync with the disallow list in `app/robots.js`, which
 * excludes the same paths for the same reason: a crawler and an anonymous
 * visitor both get a redirect here, so there is nothing to index.
 *
 * `/cart` is deliberately NOT protected — a guest cart is a supported journey
 * and gating it would break the one thing it exists for.
 */
const PROTECTED_PREFIXES = [
  '/checkout',
  '/profile',
  '/orders',
  '/order-confirmation',
  '/appointments',
  '/notifications',
];

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|images/).*)'],
};
