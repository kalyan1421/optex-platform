import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicApi } from '@/lib/api-server';
import { formatKesNumber } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';
import ProductPurchasePanel from '@/components/product/ProductPurchasePanel';
import ProductTabs from '@/components/product/ProductTabs';
import ReviewForm from '@/components/product/ReviewForm';
import SimilarProducts from '@/components/product/SimilarProducts';

/**
 * /product/[slug] — Server Component (SPEC-03 R2, Sprint 5).
 *
 * Was a `'use client'` page that fetched the product from the browser after
 * mount and rendered its JSON-LD after hydration — invisible to crawlers and
 * to link-preview bots (WhatsApp, Facebook) that never run JavaScript. Now
 * the product, its reviews and related products are fetched on the server
 * and the response carries the full page — gallery, description, price,
 * structured data — in the initial HTML. `ProductPurchasePanel`, `ProductTabs`,
 * `ReviewForm` and `SimilarProducts` are the only parts that need a browser
 * (colour/quantity state, tab state, the review form, and cart mutations),
 * split out as small client islands.
 *
 * `publicApi` sends no cookies, so the response is cacheable and identical
 * for every visitor — the same trade `/shop` already made.
 */

async function loadProduct(slug) {
  const api = publicApi({ revalidate: 60, tags: ['catalogue', `product:${slug}`] });
  try {
    return await api.catalog.getProduct(slug);
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

async function loadExtras(productId) {
  const api = publicApi({ revalidate: 60, tags: ['catalogue', `product:${productId}`] });
  const [related, reviewsData] = await Promise.all([
    api.catalog.getRelatedProducts(productId).catch((err) => {
      console.error('[product] related products fetch failed:', err);
      return [];
    }),
    api.reviews.listForProduct(productId).catch((err) => {
      console.error('[product] reviews fetch failed:', err);
      return { reviews: [], aggregate: { averageRating: null, count: 0 } };
    }),
  ]);
  return { related, reviewsData };
}

export async function generateMetadata({ params }) {
  const product = await loadProduct(params.slug);

  if (!product) {
    return { title: 'Product | Optex Opticians' };
  }

  const description =
    product.description ||
    `${product.name} — premium eyewear from ${product.brand || 'Optex Opticians'}. Shop online with delivery across Kenya.`;
  const image = getProductImageUrl(product);

  return {
    title: `${product.name} | Optex Opticians`,
    description,
    alternates: { canonical: `/product/${params.slug}` },
    openGraph: {
      title: product.name,
      description,
      url: `/product/${params.slug}`,
      type: 'website',
      images: [{ url: image }],
    },
  };
}

function formatReviewDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function StarDisplay({ rating, max = 5 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[...Array(max)].map((_, i) => (
        <span
          key={i}
          style={{ color: i < rating ? '#E53935' : '#d1d5db', fontSize: '1.1rem', lineHeight: 1 }}
        >
          {i < rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

export default async function Page({ params }) {
  const product = await loadProduct(params.slug);
  if (!product) {
    notFound();
  }

  const { related, reviewsData } = await loadExtras(product.id);
  const similar = related.slice(0, 3);
  const { reviews, aggregate } = reviewsData;
  const mainImage = getProductImageUrl(product);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: product.name,
        description: product.description || product.name,
        brand: { '@type': 'Brand', name: product.brand || 'Optex' },
        sku: product.sku,
        image: product.images?.[0] || '',
        ...(aggregate.count > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: aggregate.averageRating,
                reviewCount: aggregate.count,
              },
            }
          : {}),
        offers: {
          '@type': 'Offer',
          price: product.price_kes,
          priceCurrency: 'KES',
          availability: product.is_active
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: { '@type': 'Organization', name: 'Optex Opticians' },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: '/shop' },
          { '@type': 'ListItem', position: 3, name: product.name },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-[100px] pt-[38px]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col px-6 lg:px-[100px]">
        {/* Breadcrumb */}
        <div className="mx-auto mb-[38px] flex w-full max-w-[1240px] items-center gap-[8px]">
          <Link
            href="/"
            className="text-[#717182] hover:text-[#2A3182]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            Home
          </Link>
          <span
            className="text-[#717182]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            /
          </span>
          <Link
            href="/shop"
            className="text-[#717182] hover:text-[#2A3182]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            Shop
          </Link>
          <span
            className="text-[#717182]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            /
          </span>
          <span
            className="text-[#000000]"
            style={{
              fontFamily: 'Arimo, sans-serif',
              fontSize: '14px',
              lineHeight: '21px',
              fontWeight: 400,
            }}
          >
            {product.name}
          </span>
        </div>

        {/* Product Section */}
        <div className="mx-auto mb-[60px] flex w-full max-w-[1240px] flex-col gap-[60px] lg:flex-row">
          {/* Image Gallery */}
          <div className="flex flex-col gap-[16px] lg:w-[590px]">
            <div className="relative w-full overflow-hidden rounded-[40px] border-[0.8px] border-[#D4D4D4] bg-[#F5F5F5] p-[0.8px] lg:h-[459.6px]">
              <Image
                src={mainImage}
                alt={product.name}
                fill
                priority
                sizes="(min-width: 1024px) 590px, 100vw"
                className="rounded-[40px] object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
            <div className="flex w-full snap-x snap-mandatory gap-[16px] overflow-x-auto">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`relative h-[102.9px] w-[102.9px] flex-shrink-0 cursor-pointer snap-center rounded-[16px] border-[0.8px] bg-[#F5F5F5] p-[0.8px] transition-opacity ${idx === 0 ? 'border-[#D4D4D4] opacity-100' : 'border-[#D4D4D4] opacity-60 hover:opacity-100'}`}
                >
                  <Image
                    src={mainImage}
                    alt={`Thumbnail ${idx + 1}`}
                    fill
                    sizes="103px"
                    className="rounded-[16px] object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex flex-col lg:w-[590px]">
            <p
              className="mb-[29px] uppercase text-[#E53935]"
              style={{
                fontFamily: 'Arimo, sans-serif',
                fontSize: '14px',
                lineHeight: '21px',
                fontWeight: 400,
                letterSpacing: '2px',
              }}
            >
              {product.brand || '—'}
            </p>
            <h1
              className="-mt-[29px] mb-[16px] pt-[29px] text-[#000000]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '48px',
                lineHeight: '60px',
                fontWeight: 700,
              }}
            >
              {product.name}
            </h1>

            <div className="mb-[29px] flex items-center gap-[16px]">
              {aggregate.count > 0 ? (
                <>
                  <div className="flex items-center text-[#FFC107]">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className="h-[18px] w-[18px]"
                        fill={i < Math.round(aggregate.averageRating) ? 'currentColor' : '#d1d5db'}
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span
                    className="text-[#717182]"
                    style={{
                      fontFamily: 'Arimo, sans-serif',
                      fontSize: '14px',
                      lineHeight: '21px',
                      fontWeight: 400,
                    }}
                  >
                    ({aggregate.count} Customer {aggregate.count === 1 ? 'Review' : 'Reviews'})
                  </span>
                </>
              ) : (
                <span
                  className="text-[#717182]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontSize: '14px',
                    lineHeight: '21px',
                    fontWeight: 400,
                  }}
                >
                  No reviews yet
                </span>
              )}
            </div>

            <div className="mb-[32px]">
              <span
                className="text-[#2E3192]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '32px',
                  lineHeight: '48px',
                  fontWeight: 700,
                }}
              >
                KSH. {formatKesNumber(product.price_kes)}
              </span>
            </div>

            <p
              className="mb-[32px] text-[#4A4A4A]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                lineHeight: '26px',
                fontWeight: 400,
              }}
            >
              {product.description ??
                'The Executive Pro combines professional aesthetics with high-performance materials. Engineered for all-day comfort, these frames feature a lightweight titanium build and adjustable nose pads for a custom fit.'}
            </p>

            <ProductPurchasePanel product={product} mainImage={mainImage} />

            {/* Info Badges */}
            <div className="flex h-[56.8px] flex-wrap items-center gap-[24px] border-t-[0.8px] border-[#D4D4D4] pt-[20px]">
              <div className="flex items-center gap-[12px]">
                <div className="relative flex h-[24px] w-[24px] items-center justify-center">
                  <svg
                    width="18"
                    height="22"
                    viewBox="0 0 18 22"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute left-[3px] top-[1px]"
                  >
                    <path
                      d="M17 12.0004C17 17.0004 13.5 19.5005 9.34 20.9505C9.12216 21.0243 8.88554 21.0207 8.67 20.9405C4.5 19.5005 1 17.0004 1 12.0004V5.00045C1 4.73523 1.10536 4.48088 1.29289 4.29334C1.48043 4.10581 1.73478 4.00045 2 4.00045C4 4.00045 6.5 2.80045 8.24 1.28045C8.45185 1.09945 8.72135 1 9 1C9.27865 1 9.54815 1.09945 9.76 1.28045C11.51 2.81045 14 4.00045 16 4.00045C16.2652 4.00045 16.5196 4.10581 16.7071 4.29334C16.8946 4.48088 17 4.73523 17 5.00045V12.0004Z"
                      stroke="#2E3192"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <svg
                    width="8"
                    height="6"
                    viewBox="0 0 8 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute left-[8px] top-[9px]"
                  >
                    <path
                      d="M1 3L3 5L7 1"
                      stroke="#2E3192"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span
                  className="text-[#4A4A4A]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontSize: '14px',
                    lineHeight: '21px',
                    fontWeight: 400,
                  }}
                >
                  2 Year Warranty
                </span>
              </div>
              <div className="flex items-center gap-[12px]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="flex-shrink-0"
                >
                  <path
                    d="M14 18V6C14 5.46957 13.7893 4.96086 13.4142 4.58579C13.0391 4.21071 12.5304 4 12 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V17C2 17.2652 2.10536 17.5196 2.29289 17.7071C2.48043 17.8946 2.73478 18 3 18H5"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M15 18H9"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 18H21C21.2652 18 21.5196 17.8946 21.7071 17.7071C21.8946 17.5196 22 17.2652 22 17V13.35C21.9996 13.1231 21.922 12.903 21.78 12.726L18.3 8.376C18.2065 8.25888 18.0878 8.16428 17.9528 8.0992C17.8178 8.03412 17.6699 8.00021 17.52 8H14"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 20C18.1046 20 19 19.1046 19 18C19 16.8954 18.1046 16 17 16C15.8954 16 15 16.8954 15 18C15 19.1046 15.8954 20 17 20Z"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 20C8.10457 20 9 19.1046 9 18C9 16.8954 8.10457 16 7 16C5.89543 16 5 16.8954 5 18C5 19.1046 5.89543 20 7 20Z"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="text-[#4A4A4A]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontSize: '14px',
                    lineHeight: '21px',
                    fontWeight: 400,
                  }}
                >
                  Free Shipping
                </span>
              </div>
              <div className="flex items-center gap-[12px]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="flex-shrink-0"
                >
                  <path
                    d="M3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3C14.516 3.00947 16.931 3.99122 18.74 5.74L21 8"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 3V8H16"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 12C21 14.3869 20.0518 16.6761 18.364 18.364C16.6761 20.0518 14.3869 21 12 21C9.48395 20.9905 7.06897 20.0088 5.26 18.26L3 16"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 16H3V21"
                    stroke="#2E3192"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="text-[#4A4A4A]"
                  style={{
                    fontFamily: 'Arimo, sans-serif',
                    fontSize: '14px',
                    lineHeight: '21px',
                    fontWeight: 400,
                  }}
                >
                  30-Day Returns
                </span>
              </div>
            </div>
          </div>
        </div>

        <ProductTabs product={product} />

        {/* Customer Reviews */}
        <section className="mx-auto mt-[12px] w-full max-w-[1240px] border-t-[0.8px] border-[#D4D4D4] pt-[40px]">
          <div className="mb-10">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.2em] text-[#E53935]">
              FEEDBACK
            </p>
            <h2 className="text-[32px] font-black text-gray-900">Customer Reviews</h2>
          </div>

          {reviews.length === 0 ? (
            <div className="mb-10 rounded-[20px] bg-[#f8f9fa] px-8 py-12 text-center">
              <p className="text-[15px] font-semibold text-gray-400">
                No reviews yet. Be the first!
              </p>
            </div>
          ) : (
            <div className="mb-12 space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-[20px] border border-[#e5e7eb] bg-white px-6 py-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2A3182] text-[13px] font-bold text-white">
                        C
                      </div>
                      <div>
                        <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold leading-tight text-gray-900">
                          Customer
                          {/* F-12: reviews carry `verified_purchase`, set once by
                              trigger when the author had actually ordered the
                              product. Showing it is the whole point of collecting
                              it — an unbadged review is not hidden or ranked
                              down, the reader is just told which is which. */}
                          {review.verified_purchase ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Verified purchase
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] font-medium text-gray-400">
                          {formatReviewDate(review.created_at)}
                        </p>
                      </div>
                    </div>
                    <StarDisplay rating={review.rating} />
                  </div>
                  <p className="text-[14px] leading-relaxed text-gray-600">{review.body}</p>
                </div>
              ))}
            </div>
          )}

          <ReviewForm productId={product.id} />
        </section>

        {/* Similar Products */}
        <div className="mx-auto mt-[60px] w-full max-w-[1240px]">
          <div className="mb-[24px] flex h-[89px] w-full items-end justify-between">
            <div className="flex w-[339.56px] flex-col gap-[8px]">
              <p
                className="uppercase text-[#E53935]"
                style={{
                  fontFamily: 'Arimo, sans-serif',
                  fontSize: '14px',
                  lineHeight: '21px',
                  fontWeight: 400,
                  letterSpacing: '2px',
                }}
              >
                RECOMMENDATION
              </p>
              <h2
                className="h-[60px] text-[#000000]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '40px',
                  lineHeight: '60px',
                  fontWeight: 700,
                }}
              >
                Similar Products
              </h2>
            </div>
            <Link
              href="/shop"
              className="mb-[12px] flex items-center gap-[7px] text-[#2E3192]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 600,
              }}
            >
              View All
              <svg
                className="h-[11.67px] w-[11.67px]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.67"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <SimilarProducts products={similar} />
        </div>
      </div>
    </div>
  );
}
