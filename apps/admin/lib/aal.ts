/**
 * Reads the `aal` claim straight out of a Supabase access token — the same
 * claim `apps/api/src/supabase/supabase.service.ts`'s `decodeAal()` reads,
 * kept in sync deliberately: both sides must agree on what "stepped up"
 * means. Safe without re-verifying the signature here, since this only ever
 * runs on a token Supabase's own client has already loaded from a live
 * session.
 *
 * Uses `atob`, not `Buffer` — `middleware.ts` runs on the Edge runtime by
 * default (no `export const runtime = 'nodejs'` here), which does not
 * guarantee a `Buffer` global. `atob` is a Web Platform API available in
 * both the Edge runtime and the browser.
 */
export function decodeAal(token: string): 'aal1' | 'aal2' | undefined {
  const payloadSegment = token.split('.')[1];
  if (!payloadSegment) return undefined;
  try {
    // base64url -> base64: swap the two alphabet characters that differ, and
    // pad back to a multiple of 4 (atob requires standard padded base64).
    const base64 = payloadSegment
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(base64)) as { aal?: unknown };
    return payload.aal === 'aal1' || payload.aal === 'aal2' ? payload.aal : undefined;
  } catch {
    return undefined;
  }
}
