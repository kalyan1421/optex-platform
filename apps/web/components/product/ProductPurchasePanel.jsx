'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import WishlistToggle from '@/components/wishlist/WishlistToggle';

/**
 * The purchasable half of the PDP (SPEC-03 R2): colour, quantity, add-to-cart
 * and the wishlist toggle. Split out of the page so the surrounding gallery,
 * description and badges — none of which need a browser — can stay server
 * rendered.
 */
export default function ProductPurchasePanel({ product, mainImage }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState('black');
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
        // Do not claim a lens choice until the lens/coating configurator is
        // designed and backed by the product contract.
        variant: `Frame: ${selectedColor.charAt(0).toUpperCase() + selectedColor.slice(1)}`,
        lensOption: { frameColor: selectedColor },
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
      <div className="mb-[32px]">
        <p
          className="mb-[16px] text-[#000000]"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '16px',
            lineHeight: '24px',
            fontWeight: 600,
          }}
        >
          Select Color
        </p>
        <div className="flex items-center gap-[16px]">
          <button
            type="button"
            aria-label="Black frame color"
            aria-pressed={selectedColor === 'black'}
            onClick={() => setSelectedColor('black')}
            className={`flex items-center justify-center rounded-full transition-all ${selectedColor === 'black' ? 'h-[44px] w-[44px] border-[1.76px] border-[#2E3192] bg-[#1A1A1A]' : 'h-[40px] w-[40px] border-[1.6px] border-[#000000] bg-[#1A1A1A]'}`}
          ></button>
          <button
            type="button"
            aria-label="Blue frame color"
            aria-pressed={selectedColor === 'blue'}
            onClick={() => setSelectedColor('blue')}
            className={`flex items-center justify-center rounded-full transition-all ${selectedColor === 'blue' ? 'h-[44px] w-[44px] border-[1.76px] border-[#2E3192] bg-[#2E3192]' : 'h-[40px] w-[40px] border-[1.6px] border-[#000000] bg-[#2E3192]'}`}
          ></button>
          <button
            type="button"
            aria-label="Grey frame color"
            aria-pressed={selectedColor === 'grey'}
            onClick={() => setSelectedColor('grey')}
            className={`flex items-center justify-center rounded-full transition-all ${selectedColor === 'grey' ? 'h-[44px] w-[44px] border-[1.76px] border-[#2E3192] bg-[#717182]' : 'h-[40px] w-[40px] border-[1.6px] border-[#000000] bg-[#717182]'}`}
          ></button>
        </div>
      </div>

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

      <div className="mb-[56.8px] flex h-[63px] w-[459.6px] items-center gap-[24px]">
        <div className="flex h-[49.2px] w-[135.2px] items-center justify-between rounded-[26843500px] border-[1.6px] border-[#D4D4D4] bg-white px-[16px] py-[8px]">
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
          className="flex h-[63px] w-[300.4px] items-center justify-center gap-[10px] rounded-[26843500px] bg-[#2E3192] text-[#FFFFFF] transition-all hover:bg-[#1e2361] disabled:cursor-not-allowed disabled:opacity-60"
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
