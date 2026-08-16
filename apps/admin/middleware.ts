import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isStaffRole } from './lib/roles';
import { decodeAal } from './lib/aal';

/** Reachable by a signed-in super_admin regardless of AAL — see the redirect below. */
const MFA_ROUTES = ['/mfa-setup', '/mfa-challenge'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
          // H-6 FIX: expire via maxAge: 0 to ensure the cookie is truly deleted.
          const deleteOptions = { ...options, maxAge: 0 };
          request.cookies.set({ name, value: '', ...deleteOptions });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...deleteOptions });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === '/login';
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  if (!isLoginPage && !isApiRoute) {
    // C-1 FIX: Read role from app_metadata, which is only writable via the
    // service-role Admin API. user_metadata is user-writable and must NOT be
    // trusted for authorization decisions.
    //
    // CR-01 R1: this only gates "is this one of the 7 known staff roles" —
    // NOT what a role can see or do, which is entirely data-driven
    // (`role_permissions`, read via `GET /auth/me` and enforced page-by-page
    // by `PermissionGate`). A `doctor` login reaches every route past this
    // check and then sees an empty sidebar / access-denied everywhere, which
    // is correct: the role exists, it just has zero permissions until the
    // consultation module (R5) ships.
    const role = (user?.app_metadata as Record<string, unknown> | null)?.role;
    if (!isStaffRole(role)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // R1 1e: super_admin must complete an aal2 step-up before reaching
    // anything but the MFA pages themselves — mirrors PermissionsGuard's
    // server-side enforcement (apps/api/src/auth/permissions.guard.ts), which
    // is the check that actually matters; this one exists so a super_admin
    // hits a purpose-built setup/challenge screen instead of a wall of 403s
    // from every page they land on.
    const isMfaRoute = MFA_ROUTES.some((r) => request.nextUrl.pathname.startsWith(r));
    if (role === 'super_admin' && !isMfaRoute) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const aal = session ? decodeAal(session.access_token) : undefined;
      if (aal !== 'aal2') {
        return NextResponse.redirect(new URL('/mfa-challenge', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|images/).*)'],
};
