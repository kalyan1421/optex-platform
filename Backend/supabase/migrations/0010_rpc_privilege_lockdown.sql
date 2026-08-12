-- 0010_rpc_privilege_lockdown.sql
--
-- Closes CODE-REVIEW C-3.
--
-- `place_order` and `increment_promo_uses` were created without an explicit
-- grant, so they inherited Postgres's default of EXECUTE to PUBLIC. PostgREST
-- exposes every function in the `public` schema as an RPC endpoint, which meant
-- any caller holding an anon or authenticated JWT could invoke them directly:
--
--   POST /rest/v1/rpc/place_order
--   { "p_customer_id": "<somebody else's id>", "p_payment_method": "cod", ... }
--
-- `place_order` takes the customer id as a parameter rather than deriving it
-- from the JWT, so a signed-in customer could place an order against another
-- customer's cart — reading that cart's contents back in the response — and
-- `increment_promo_uses` could be called in a loop to burn a promo code's
-- remaining uses, or past its own limit.
--
-- Migration 0009 dropped the customer-writable RLS policies, but RLS does not
-- constrain a SECURITY DEFINER function: it runs as its owner. Only the EXECUTE
-- privilege does.
--
-- Both functions are called exclusively by apps/api, which connects with the
-- service-role key, so service_role keeps EXECUTE and nothing in the app
-- changes. Revoking from PUBLIC alone would be enough today, but anon and
-- authenticated are revoked explicitly as well: a later `GRANT ... TO PUBLIC`
-- elsewhere would silently re-open the hole, and these two lines make the
-- intent legible to whoever writes that grant.

revoke execute on function public.place_order(uuid, text, jsonb, text, text) from public;
revoke execute on function public.place_order(uuid, text, jsonb, text, text) from anon;
revoke execute on function public.place_order(uuid, text, jsonb, text, text) from authenticated;

revoke execute on function public.increment_promo_uses(text) from public;
revoke execute on function public.increment_promo_uses(text) from anon;
revoke execute on function public.increment_promo_uses(text) from authenticated;

grant execute on function public.place_order(uuid, text, jsonb, text, text) to service_role;
grant execute on function public.increment_promo_uses(text) to service_role;
