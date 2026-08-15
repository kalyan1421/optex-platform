import BranchLocatorView from '@/components/branches/BranchLocatorView';
import { publicApi } from '@/lib/api-server';

/**
 * Branch locator — Server Component (audit F-13 and F-18).
 *
 * BEFORE: a Client Component that fetched branches in a `useEffect`, straight
 * from PostgREST with the anon key. Two problems in one page. It bypassed the
 * API — the last customer-facing read still doing so — and, worse, it meant
 * the branch list did not exist in the HTML. For a local optician, "opticians
 * near me" is the query that matters most, and the page answering it served
 * crawlers an empty shell.
 *
 * NOW: branches are fetched on the server through the API and rendered into the
 * markup, with `LocalBusiness` JSON-LD per branch so search engines can read
 * addresses, phone numbers and coordinates directly. Only the map interaction
 * stays on the client.
 *
 * Revalidated hourly: branch details change a few times a year, and an hour is
 * short enough that an address correction in the admin panel appears the same
 * morning.
 */
export const revalidate = 3600;

async function loadBranches() {
  try {
    return await publicApi({ revalidate, tags: ['branches'] }).branches.list();
  } catch (err) {
    // A locator with no branches is a bad page, but a 500 is a worse one — the
    // static copy, directions text and contact route are still useful.
    console.error('[branch-locator] failed to load branches:', err);
    return [];
  }
}

/**
 * One `LocalBusiness` entry per branch. This is the structured data that puts
 * opening hours and a map pin into a search result, and it is only possible
 * because the data is now resolved on the server.
 */
function buildJsonLd(branches) {
  return {
    '@context': 'https://schema.org',
    '@graph': branches.map((b) => ({
      '@type': ['Optician', 'LocalBusiness'],
      name: `Optex Opticians — ${b.name}`,
      address: { '@type': 'PostalAddress', streetAddress: b.address, addressCountry: 'KE' },
      telephone: b.phone ?? undefined,
      geo:
        b.lat != null && b.lng != null
          ? { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng }
          : undefined,
      parentOrganization: { '@type': 'Organization', name: 'Optex Opticians' },
    })),
  };
}

export default async function BranchLocatorPage() {
  const branches = await loadBranches();

  return (
    <>
      {branches.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(branches)) }}
        />
      ) : null}
      <BranchLocatorView branches={branches} />
    </>
  );
}
