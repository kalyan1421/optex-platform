/**
 * Splits a single "full name" string into the `firstName`/`lastName` shape
 * checkout's form uses. Kept in one place because getting this wrong two
 * different ways (e.g. one splitting on the first space, the other on the
 * last) would silently disagree on names with a middle name.
 */
export function splitFullName(fullName) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  const [firstName, ...rest] = parts;
  return { firstName, lastName: rest.join(' ') };
}
