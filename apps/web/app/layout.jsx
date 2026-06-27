import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'
import AosInit from '@/components/AosInit'
import MainLayout from '@/components/layout/MainLayout'

export const metadata = {
  title: 'Optex Opticians',
  description: 'Premium eyewear in Kenya — frames, lenses, sunglasses, and eye care.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": ["LocalBusiness", "MedicalOrganization"],
              "name": "Optex Opticians",
              "description": "Kenya's premium eyewear retailer. Prescription glasses, sunglasses, contact lenses & eye care services.",
              "url": "https://optexopticians.co.ke",
              "telephone": "+254 700 000 000",
              "email": "hello@optexopticians.co.ke",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "KE",
                "addressLocality": "Nairobi",
                "addressRegion": "Nairobi County"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": -1.2921,
                "longitude": 36.8219
              },
              "openingHoursSpecification": [
                { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "18:00" },
                { "@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday", "opens": "09:00", "closes": "17:00" }
              ],
              "priceRange": "KES 1,500 – KES 25,000",
              "currenciesAccepted": "KES",
              "paymentAccepted": "M-Pesa, Visa, Mastercard, Cash",
              "image": "https://optexopticians.co.ke/images/og-image.png",
              "sameAs": []
            })
          }}
        />
      </head>
      <body>
        <AosInit />
        <AuthProvider>
          <CartProvider>
            <MainLayout>
              {children}
            </MainLayout>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
