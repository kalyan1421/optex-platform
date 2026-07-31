import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabase } from '@optex/db/server';
import { listProducts } from '@optex/db';
import { formatKes } from '@optex/ui';
import { getProductImageUrl } from '@/lib/product-image';

export async function generateMetadata({ params }) {
  const cookieStore = cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data: category } = await supabase
    .from('categories')
    .select('name, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!category) {
    return { title: 'Category | Optex Opticians' };
  }

  return {
    title: `${category.name} | Optex Opticians`,
    description: `Shop our ${category.name} collection — premium eyewear at Optex Opticians Kenya.`,
  };
}

export default async function CategoryPage({ params }) {
  const cookieStore = cookies();
  const supabase = createServerSupabase(cookieStore);

  // Fetch category
  const { data: category } = await supabase
    .from('categories')
    .select('id, name, slug, description')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!category) {
    notFound();
  }

  // Fetch active products for this category
  const products = await listProducts(supabase, {
    categorySlug: params.slug,
    limit: 60,
  });

  const categoryLabels = {
    eyeglasses: 'PRESCRIPTION',
    sunglasses: 'SUN PROTECTION',
    kids: "CHILDREN'S EYEWEAR",
    'contact-lenses': 'VISION CORRECTION',
    'computer-glasses': 'DIGITAL WELLNESS',
    'reading-glasses': 'NEAR VISION',
  };

  const categoryImages = {
    eyeglasses:
      'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?q=80&w=2070&auto=format',
    sunglasses:
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=2070&auto=format',
    kids: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=2070&auto=format',
    'contact-lenses':
      'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=2070&auto=format',
    'computer-glasses':
      'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?q=80&w=2070&auto=format',
    'reading-glasses':
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format',
  };

  const heroImage = categoryImages[params.slug] || categoryImages.eyeglasses;
  const categoryLabel = categoryLabels[params.slug] || 'EYEWEAR';

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative flex h-[300px] items-center justify-center overflow-hidden sm:h-[340px] lg:h-[380px]">
        <div
          className="absolute inset-0 z-0 scale-105 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-[#1A1A2E]/75"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/60 to-transparent"></div>
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-[#E53935]">
            {categoryLabel}
          </p>
          <h1 className="mb-4 text-[36px] font-black tracking-tight text-white drop-shadow-2xl sm:text-[48px]">
            {category.name}
          </h1>
          {category.description ? (
            <p className="mx-auto max-w-lg text-[14px] font-medium leading-relaxed text-white/80 sm:text-[16px]">
              {category.description}
            </p>
          ) : (
            <p className="text-[14px] font-medium text-white/70">
              {products.length} product{products.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>
      </section>

      {/* Breadcrumb */}
      <div className="page-container">
        <div className="flex items-center border-b border-gray-100 py-5 text-[13px]">
          <Link href="/" className="text-gray-400 transition-colors hover:text-[#2A3182]">
            Home
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <Link href="/shop" className="text-gray-400 transition-colors hover:text-[#2A3182]">
            Shop
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <span className="font-bold text-gray-900">{category.name}</span>
        </div>
      </div>

      {/* Products Grid */}
      <main className="page-container py-10 sm:py-12">
        {/* Header row */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[24px] font-black text-gray-900 sm:text-[28px]">{category.name}</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">
              {products.length} product{products.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/shop"
            className="flex items-center gap-1 self-start text-[13px] font-bold text-[#2A3182] hover:underline sm:self-auto"
          >
            View all products
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="rounded-[24px] bg-[#f8f9fa] py-20 text-center">
            <div className="mb-4 text-[40px]">👓</div>
            <p className="mb-2 text-[17px] font-bold text-gray-700">No products found</p>
            <p className="mb-6 text-[14px] text-gray-400">
              We&rsquo;re restocking this category. Check back soon!
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-[#2A3182] px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#1e2361]"
            >
              Browse all products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      {/* Related Categories */}
      <section className="mt-4 bg-[#f8f9fa] py-12">
        <div className="page-container">
          <h3 className="mb-6 text-[18px] font-black text-gray-900">Browse Other Categories</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { slug: 'eyeglasses', name: 'Eyeglasses' },
              { slug: 'sunglasses', name: 'Sunglasses' },
              { slug: 'contact-lenses', name: 'Contact Lenses' },
              { slug: 'kids', name: 'Kids' },
              { slug: 'computer-glasses', name: 'Computer Glasses' },
              { slug: 'reading-glasses', name: 'Reading Glasses' },
            ]
              .filter((c) => c.slug !== params.slug)
              .map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-[13px] font-bold text-gray-700 transition-all hover:border-[#2A3182] hover:text-[#2A3182] hover:shadow-sm"
                >
                  {cat.name}
                </Link>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product }) {
  const image = getProductImageUrl(product);

  return (
    <div className="group flex flex-col rounded-[25px] border border-[#ddd] bg-white p-2.5 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl">
      <Link href={`/product/${product.slug}`}>
        <div className="relative aspect-square overflow-hidden rounded-[20px] bg-[#f8f9fa]">
          {/* Badge */}
          <div className="absolute right-2.5 top-2.5 z-10">
            <div className="rounded-full border border-[#ddd] bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur-sm">
              <span className="text-[9px] font-black uppercase tracking-tighter text-[#2A3182]">
                {product.frame_shape ?? product.brand ?? 'Optex'}
              </span>
            </div>
          </div>
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3 pt-3.5">
        {product.brand && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-300">
            {product.brand}
          </p>
        )}
        <Link href={`/product/${product.slug}`}>
          <h3 className="mb-2 line-clamp-2 text-[14px] font-bold leading-tight text-gray-900 transition-colors group-hover:text-[#2A3182]">
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#ddd] pt-2.5">
          <p className="text-[16px] font-black tracking-tight text-[#2A3182]">
            {formatKes(Number(product.price_kes))}
          </p>
          <Link
            href={`/product/${product.slug}`}
            className="whitespace-nowrap rounded-full bg-[#E53935] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-red-600 active:scale-95"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
