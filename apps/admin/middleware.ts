import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isStaffRole } from './lib/roles';

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
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|images/).*)'],
};
