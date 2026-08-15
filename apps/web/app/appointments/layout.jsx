/**
 * Metadata for appointment booking (audit F-18).
 *
 * "Book an eye test" is a high-intent local search, and the page serving it had
 * no title of its own.
 */
export const metadata = {
  title: 'Book an Eye Test — Optex Opticians Kenya',
  description:
    'Book an eye examination, frame fitting or consultation at your nearest Optex Opticians branch. Choose a date and time that suits you.',
  alternates: { canonical: '/appointments' },
  openGraph: {
    title: 'Book an Eye Test at Optex Opticians',
    description: 'Eye examinations, frame fittings and consultations at any Optex branch in Kenya.',
    url: '/appointments',
    type: 'website',
  },
};

export default function AppointmentsLayout({ children }) {
  return children;
}
