import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { CompareProvider } from '@/context/CompareContext';
import { WishlistProvider } from '@/context/WishlistContext';
import AosInit from '@/components/AosInit';
import MainLayout from '@/components/layout/MainLayout';
import CompareTray from '@/components/compare/CompareTray';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata = {
  // Without metadataBase, per-page `alternates.canonical` and OpenGraph URLs
  // render relative ("/shop"), which search engines cannot resolve — a
  // relative canonical is treated as no canonical at all. Set from
  // NEXT_PUBLIC_SITE_URL so preview deployments point at themselves rather
  // than at production.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://optexopticians.co.ke'),
  title: 'Optex Opticians',
  description: 'Premium eyewear in Kenya — frames, lenses, sunglasses, and eye care.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@400;600&family=Poppins:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700;800&family=Arimo:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              '@context': 'https://schema.org',
              '@type': ['LocalBusiness', 'MedicalOrganization'],
              name: 'Optex Opticians',
              description:
                "Kenya's premium eyewear retailer. Prescription glasses, sunglasses, contact lenses & eye care services.",
              url: 'https://optexopticians.co.ke',
              telephone: '+254 700 897 007',
              email: 'optexopticals@gmail.com',
              address: {
                '@type': 'PostalAddress',
                streetAddress: "Krishna Park, next to Doctor's Park, 3rd Parklands",
                addressCountry: 'KE',
                addressLocality: 'Nairobi',
                addressRegion: 'Nairobi County',
              },
              openingHoursSpecification: [
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                  opens: '09:00',
                  closes: '18:00',
                },
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: 'Saturday',
                  opens: '09:00',
                  closes: '17:00',
                },
              ],
              priceRange: 'KES 1,500 – KES 25,000',
              currenciesAccepted: 'KES',
              paymentAccepted: 'M-Pesa, Visa, Mastercard, Cash',
              image: 'https://optexopticians.co.ke/images/og-image.png',
              sameAs: [],
            }),
          }}
        />
      </head>
      <body>
        <AosInit />
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <CompareProvider>
                <MainLayout>{children}</MainLayout>
                <CompareTray />
              </CompareProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
