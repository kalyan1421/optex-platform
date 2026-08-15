/**
 * Metadata for the contact page (audit F-18). Client Component below, so the
 * export has to live in a server layout.
 */
export const metadata = {
  title: 'Contact Optex Opticians — Talk to Our Team',
  description:
    'Get in touch with Optex Opticians. Call, email or send us a message about frames, prescriptions, orders or eye care appointments.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Optex Opticians',
    description: 'Call, email or message us about frames, prescriptions, orders or appointments.',
    url: '/contact',
    type: 'website',
  },
};

export default function ContactLayout({ children }) {
  return children;
}
