'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import WishlistToggle from '@/components/wishlist/WishlistToggle';

/**
 * The purchasable half of the PDP (SPEC-03 R2): quantity, add-to-cart and the
 * wishlist toggle. Split out of the page so the surrounding gallery,
 * description and badges — none of which need a browser — can stay server
 * rendered.
 *
 * NO COLOUR SELECTOR, DELIBERATELY. This panel used to render three hardcoded
 * swatches — black, blue, grey — on every product in the catalogue, so the
 * Classic Aviator, described in its own copy as "brushed gold", sold in three
 * colours it does not come in. The pick was not cosmetic either: it was written
 * into the cart line as `variant: "Frame: Black"` and `lensOption.frameColor`,
 * and travelled with the order, so fulfilment was handed a colour that was
 * never in the catalogue.
 *
 * Colour is not a product attribute in this schema — `products` has no colour
 * column and there is no variants table. Each colourway is its own SKU and its
 * own row ("… Classic Eyeglasses — Brown/Blue"), which is why the swatches
 * could only ever have been decorative. A real picker means a variants table
 * and a migration; until that exists, showing no choice is honest and showing
 * three is not.
 */
export default function ProductPurchasePanel({ product, mainImage }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addError, setAddError] = useState('');
  const availableStock =
    product.available_stock === null || product.available_stock === undefined
      ? null
      : Number(product.available_stock);
  const unavailable = availableStock !== null && availableStock <= 0;

  // Awaited and guarded by `addingToCart` — a bare fire-and-forget call here
  // let a fast double-click/tap queue two adds before the first landed, and
  // navigating to /cart before the request settled raced the cart's own
  // server read against it.
  async function handleAddToCart() {
    if (addingToCart) return;
    setAddingToCart(true);
    setAddError('');
    try {
      await addToCart({
        id: product.id,
        title: product.name,
        price: String(product.price_kes),
        image: mainImage,
        quantity,
        // No `variant` and no `lensOption`: the product row IS the variant
        // here, and neither a frame colour nor a lens choice can be claimed
        // until there is a configurator backed by the product contract.
        brand: product.brand,
      });
      router.push('/cart');
    } catch (error) {
      setAddError(error?.message ?? 'Could not add this product to your cart.');
    } finally {
      setAddingToCart(false);
    }
  }

  return (
    <>
      <div className="mb-[18px] text-sm font-medium" aria-live="polite">
        {unavailable ? (
          <p className="m-0 text-red-700">Currently out of stock.</p>
        ) : availableStock !== null && availableStock <= 5 ? (
          <p className="m-0 text-amber-700">Only {availableStock} left in stock.</p>
        ) : availableStock === null ? (
          <p className="m-0 text-[#717182]">Availability is confirmed at checkout.</p>
        ) : null}
        {addError && <p className="m-0 mt-2 text-red-700">{addError}</p>}
      </div>

      {/* P-03: this row was `w-[459.6px]` with a `w-[300.4px]` button inside —
          fixed pixel widths with no responsive override. At a 375px viewport
          the button's right edge landed at 484px, so Add to Cart sat off-screen
          and the whole page scrolled sideways. `w-full` with the old figure as
          `max-w` keeps the desktop layout pixel-identical (135.2 + 24 gap +
          300.4 = 459.6, which is what `flex-1` resolves to at that width) while
          letting the row shrink on a phone. */}
      <div className="mb-[56.8px] flex h-[63px] w-full max-w-[459.6px] items-center gap-[24px]">
        <div className="flex h-[49.2px] w-[135.2px] shrink-0 items-center justify-between rounded-[26843500px] border-[1.6px] border-[#D4D4D4] bg-white px-[16px] py-[8px]">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="flex w-[24px] items-center justify-center bg-white/0 text-[#0A0A0A] transition-colors hover:bg-[#141776]/10"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '20px' }}
          >
            -
          </button>
          <span
            className="flex w-[24px] justify-center text-[#0A0A0A]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '18px',
              lineHeight: '27px',
            }}
          >
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity(Math.min(availableStock ?? 100, quantity + 1))}
            disabled={unavailable || (availableStock !== null && quantity >= availableStock)}
            className="flex w-[24px] items-center justify-center bg-white/0 text-[#0A0A0A] transition-colors hover:bg-[#141776]/10"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '20px' }}
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={addingToCart || unavailable}
          aria-busy={addingToCart}
          className="flex h-[63px] min-w-0 flex-1 items-center justify-center gap-[10px] rounded-[26843500px] bg-[#2E3192] text-[#FFFFFF] transition-all hover:bg-[#1e2361] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
            fontSize: '18px',
            lineHeight: '27px',
          }}
        >
          <svg
            className="h-[20px] w-[20px]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="1.67"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z"
            />
          </svg>
          Add to Cart
        </button>
      </div>

      <div className="mb-[32px]">
        <WishlistToggle productId={product.id} variant="inline" />
      </div>
    </>
  );
}
