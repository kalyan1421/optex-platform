/**
 * Metadata for a transactional route (audit F-18).
 *
 * Deliberately `noindex`: this page is personal to the signed-in customer or is
 * a step in a funnel. It still needs a real title so the browser tab, history
 * and any shared link are legible — the finding was the missing title, not a
 * missing indexing opportunity.
 */
export const metadata = {
  title: 'Checkout — Optex Opticians',
  description: 'Complete your Optex Opticians order.',
  robots: { index: false, follow: true },
};

export default function Layout({ children }) {
  return children;
}
