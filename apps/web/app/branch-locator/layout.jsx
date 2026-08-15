/**
 * Metadata for the branch locator (audit F-18).
 *
 * The page itself is a Client Component, which cannot export `metadata` — hence
 * this server layout wrapping it. Of all the pages missing metadata this one
 * mattered most: "opticians near me" is the query an optician competes on, and
 * the page answering it was inheriting the generic site title.
 */
export const metadata = {
  title: 'Find an Optex Branch — Opticians in Nairobi & Across Kenya',
  description:
    'Locate your nearest Optex Opticians branch. Addresses, phone numbers, opening hours and directions for every store in Kenya.',
  alternates: { canonical: '/branch-locator' },
  openGraph: {
    title: 'Find an Optex Opticians Branch',
    description: 'Addresses, opening hours and directions for every Optex branch in Kenya.',
    url: '/branch-locator',
    type: 'website',
  },
};

export default function BranchLocatorLayout({ children }) {
  return children;
}
