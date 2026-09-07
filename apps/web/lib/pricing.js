/**
 * Money constants the storefront has to agree with the server about.
 *
 * WHY THIS FILE EXISTS. The flat delivery fee was written out twice — once in
 * `place_order` (0008_api_hardening.sql: 300 for delivery, 0 for pickup) and
 * once in `app/checkout/page.jsx` — and the cart page, which never got a copy,
 * printed "Shipping FREE" and left it out of the total. The cart therefore
 * quoted KES 300 less than the order it was about to place: a KSH 24,000 frame
 * showed 27,840 in the basket and billed 28,140 at checkout.
 *
 * One exported constant instead of a second literal, so the next surface that
 * needs the fee imports it rather than re-deriving it. The server stays the
 * authority — it recomputes the total on `place_order` and does not trust these
 * numbers — but what a customer is shown before they commit has to match.
 */

/**
 * Flat delivery fee in KES, mirroring `place_order`'s `v_shipping`.
 *
 * Applies to `deliveryOption: 'delivery'`, which is the only option the
 * storefront currently offers; branch pickup is zero-rated server-side but has
 * no checkout control yet.
 */
export const DELIVERY_FEE_KES = 300;

/**
 * Shipping charged for a delivery option, matching the server's CASE.
 *
 * @param {'delivery'|'pickup'} [deliveryOption]
 * @returns {number} Fee in KES.
 */
export function shippingFeeKes(deliveryOption = 'delivery') {
  return deliveryOption === 'pickup' ? 0 : DELIVERY_FEE_KES;
}
