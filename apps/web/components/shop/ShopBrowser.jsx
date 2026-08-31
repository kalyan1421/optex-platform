'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';
import StarRating from '@/components/ui/StarRating';
import CompareToggle from '@/components/compare/CompareToggle';
import WishlistToggle from '@/components/wishlist/WishlistToggle';
import {
  useProductFacets,
  ProductFilterSidebar,
  SortSelect,
  Pagination,
  useResetPageOnFilterChange,
  sortProducts,
} from '@/components/shop/ProductFilters';

/** 12 = 4 rows of the 3-up grid the Shop design specifies (918px / 290px cards). */
const PAGE_SIZE = 12;

/**
 * The interactive half of /shop: facets, sort, pagination and add-to-cart.
 *
 * Split out of the page so `app/shop/page.jsx` can be a Server Component. The
 * catalogue now arrives as props, already fetched and cached on the server, so
 * the product grid is in the initial HTML — which is the point of Wave 4. This
 * component owns only what genuinely needs the browser: which facet is
 * selected, which page you are on, and the cart.
 *
 * There is no loading state any more. There is nothing to wait for.
 */
export default function ShopBrowser({ products, categories }) {
  const [sortBy, setSortBy] = useState('featured');
  const [page, setPage] = useState(1);
  const { addToCart } = useCart();

  const { filtered, activeFilters, clearFilters, selection, sidebarProps } = useProductFacets(
    products,
    categories,
  );

  // Any filter change invalidates the current page — page 4 of an unfiltered
  // catalogue is usually past the end of a filtered one.
  useResetPageOnFilterChange(selection, setPage);

  const visible = sortProducts(filtered, sortBy);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Clamp rather than trust `page`: the reset effect runs after render, so for
  // one frame `page` can still point past the end of a newly filtered list.
  const safePage = Math.min(page, pageCount);
  const pageItems = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="mx-auto mb-12 w-full max-w-[1240px] px-6 lg:mb-[100px] lg:mt-[40px] lg:px-[16px]">
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-[40px]">
        <ProductFilterSidebar {...sidebarProps} />

        {/* Product Grid Area (Width: 918px) */}
        <section className="mt-10 flex flex-col lg:mt-0 lg:w-[918px] lg:gap-[24px]">
          {/* Top Header */}
          <div className="flex items-center justify-between lg:h-[36px] lg:w-[918px]">
            <span
              className="flex items-center whitespace-nowrap text-[#717182] lg:h-[24px]"
              style={{ fontFamily: 'Arimo, sans-serif', fontSize: '16px', lineHeight: '24px' }}
            >
              {visible.length === 0
                ? 'No products'
                : pageCount > 1
                  ? `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, visible.length)} of ${visible.length} products`
                  : `Showing ${visible.length} ${visible.length === 1 ? 'product' : 'products'}`}
            </span>

            {/* The design leaves an empty slot at this corner; sort fills it. */}
            <SortSelect value={sortBy} onChange={setSortBy} />
          </div>

          {visible.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-[32px] border-[0.8px] border-[#D4D4D4] px-6 py-[80px] text-center lg:w-[918px]">
              <h2 className="font-poppins mb-[8px] text-[22px] font-semibold text-[#0A0A0A]">
                No frames match these filters
              </h2>
              <p className="font-inter mb-[24px] max-w-[420px] text-[16px] text-[#717182]">
                {products.length === 0
                  ? 'Our collection is being updated. Please check back shortly.'
                  : 'Try widening your search — removing the price band usually helps most.'}
              </p>
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-inter flex h-[44px] items-center justify-center rounded-[26843500px] bg-[#2E3192] px-[28px] text-[15px] font-semibold text-white transition-colors hover:bg-[#1e2361]"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:w-[918px] lg:grid-cols-3 lg:gap-[24px]">
            {pageItems.map((product) => (
              <div
                key={product.id}
                className="group relative flex w-full flex-col overflow-hidden border-[#D4D4D4] bg-[#FFFFFF] transition-shadow duration-300 hover:shadow-lg lg:h-[480px] lg:w-[290px]"
                style={{
                  borderRadius: '32px',
                  borderWidth: '0.8px',
                }}
              >
                {/* Image Box */}
                <div className="relative flex w-full shrink-0 items-center justify-center bg-[#F5F5F5] lg:h-[288.4px]">
                  <CompareToggle
                    product={product}
                    image={getProductImageUrl(product)}
                    className="absolute left-[16px] top-[16px] z-10"
                  />
                  <WishlistToggle
                    productId={product.id}
                    className="absolute left-[56px] top-[16px] z-10"
                  />
                  {/* Frame-shape pill — omitted rather than guessed when the
                  product has no shape set, so the card never labels an
                  eyeglass frame "Sunglasses". */}
                  {product.frame_shape && (
                    <div className="absolute right-[16px] top-[16px] z-10 flex items-center justify-center rounded-[20px] bg-white px-[12px] py-[6px] shadow-sm">
                      <span className="font-inter text-[12px] font-medium capitalize text-[#2E3192]">
                        {product.frame_shape}
                      </span>
                    </div>
                  )}

                  <Link
                    href={`/product/${product.slug}`}
                    className="relative block h-full w-full overflow-hidden"
                  >
                    <Image
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1024px) 22vw, 45vw"
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </Link>
                </div>

                {/* Content Area */}
                <div className="flex flex-col lg:mx-[24.8px] lg:mt-[24px] lg:w-[240.4px]">
                  {/* Row 1: Title & Brand */}
                  <div className="flex items-start justify-between lg:h-[27px] lg:w-[240.4px]">
                    <h3 className="font-poppins truncate font-semibold text-[#000000] transition-colors group-hover:text-[#2E3192] lg:w-[135px] lg:text-[18px] lg:leading-[27px] lg:tracking-[-0.2px]">
                      {product.name}
                    </h3>
                    <span
                      className="text-right uppercase text-[#2E3192] lg:h-[21px] lg:w-[57px]"
                      style={{
                        fontFamily: 'Arimo, sans-serif',
                        fontSize: '14px',
                        lineHeight: '21px',
                      }}
                    >
                      {product.brand || '—'}
                    </span>
                  </div>

                  {/* F-11: the rating, finally visible outside the PDP. Renders
                      nothing for an unrated product — a row of empty stars reads
                      as "rated badly" rather than "not yet rated". */}
                  <StarRating
                    rating={product.rating_avg}
                    count={product.rating_count}
                    className="lg:mt-[6px]"
                  />

                  {/* Row 2: Description */}
                  <div className="lg:mt-[8px] lg:h-[42px] lg:w-[240.4px]">
                    <p
                      className="font-inter line-clamp-2 text-[#717182]"
                      style={{ fontSize: '14px', lineHeight: '21px' }}
                    >
                      {product.description ||
                        'Premium quality sunglasses designed for maximum comfort and style.'}
                    </p>
                  </div>

                  {/* Row 3: Price & Action */}
                  <div className="flex items-center justify-between lg:mt-[24px] lg:h-[41px] lg:w-[240.4px]">
                    {/* Price Block */}
                    <div className="flex items-baseline gap-[4px] text-[#2E3192] lg:mt-[0.8px] lg:h-[33px] lg:w-[101px]">
                      <span
                        className="text-[12px] font-bold uppercase"
                        style={{ fontFamily: 'Poppins, sans-serif', lineHeight: '33px' }}
                      >
                        KSH.
                      </span>
                      <span
                        className="text-[22px] font-bold"
                        style={{ fontFamily: 'Poppins, sans-serif', lineHeight: '33px' }}
                      >
                        {Number(product.price_kes).toLocaleString()}
                      </span>
                    </div>

                    {/* Button */}
                    <button
                      type="button"
                      disabled={
                        product.available_stock !== null && Number(product.available_stock) <= 0
                      }
                      onClick={() =>
                        addToCart({
                          id: product.id,
                          title: product.name,
                          price: String(product.price_kes),
                          image: getProductImageUrl(product),
                          quantity: 1,
                        })
                      }
                      className="flex items-center justify-center bg-[#E53935] text-white transition-all hover:bg-[#D32F2F] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#9CA3AF] lg:h-[41px] lg:w-[121.375px] lg:rounded-[24px]"
                    >
                      <span
                        className="flex items-center justify-center whitespace-nowrap text-center text-[14px] font-semibold lg:h-[21px] lg:w-[82px]"
                        style={{ fontFamily: 'Poppins, sans-serif', lineHeight: '21px' }}
                      >
                        {product.available_stock !== null && Number(product.available_stock) <= 0
                          ? 'Out of stock'
                          : 'Add to Cart'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
        </section>
      </div>
    </div>
  );
}
