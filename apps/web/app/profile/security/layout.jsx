/**
 * Metadata for a transactional route (audit F-18) — see `../layout.jsx`,
 * which this mirrors rather than inherits from: Next.js metadata objects
 * merge per-field across nested layouts, and `robots` is easy to lose
 * silently in that merge, so it is restated here rather than assumed.
 */
export const metadata = {
  title: 'Security & Password — Optex Opticians',
  description: 'Change the password you use to sign in to your Optex Opticians account.',
  robots: { index: false, follow: true },
};

export default function Layout({ children }) {
  return children;
}
