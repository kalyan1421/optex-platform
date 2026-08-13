import { getTestDb } from './lib/test-db';

/**
 * Deletes every throwaway `@optex-test.local` auth user — the one
 * `global-setup.ts` creates each run, plus any spec file's own fixtures.
 * Each admin account is otherwise never cleaned up: nothing else in this
 * suite owns it, since it exists purely to authenticate every other test.
 *
 * `listUsers()` paginates at 50 per page by default and does not filter by
 * email — has to be walked to completion, or only the first page's worth
 * ever gets deleted and the rest accumulate silently across runs.
 */
export default async function globalTeardown(): Promise<void> {
  const db = getTestDb();

  let page = 1;
  const staleIds: string[] = [];
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users;
    staleIds.push(...users.filter((u) => u.email?.endsWith('@optex-test.local')).map((u) => u.id));
    if (users.length < 200) break;
    page += 1;
  }

  for (const id of staleIds) {
    await db.auth.admin.deleteUser(id);
  }
}
