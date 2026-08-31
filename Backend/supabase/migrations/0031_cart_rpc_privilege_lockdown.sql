-- Lock down the SECURITY DEFINER cart quantity RPC.
-- The API performs the ownership check before calling it, but PostgREST also
-- exposes database functions directly. This function must not be callable by
-- anon/authenticated clients because it accepts a cart_item id as input.

revoke execute on function public.increment_cart_item_qty(uuid, integer) from public;
revoke execute on function public.increment_cart_item_qty(uuid, integer) from anon;
revoke execute on function public.increment_cart_item_qty(uuid, integer) from authenticated;

grant execute on function public.increment_cart_item_qty(uuid, integer) to service_role;
