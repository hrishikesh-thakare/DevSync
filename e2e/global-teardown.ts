/**
 * DevSync E2E Global Teardown
 *
 * Runs once after all tests. Local-only: every full run creates
 * `Date.now()`-suffixed fixture users (`forgot-pw-...@demo.com`,
 * `sessions-...@demo.com`, ...) that the specs themselves never tear down, so
 * running locally against the shared dev Supabase project accumulates roughly
 * 75 dead accounts per run — two weeks of runs once left ~1,020 of them
 * sitting in production data.
 *
 * CI cannot leak this way: `.github/workflows/e2e-tests.yml` runs against a
 * throwaway Postgres 16 container with placeholder Supabase credentials
 * (`SUPABASE_URL=http://localhost:3001`), destroyed with the runner. So this
 * only needs to act locally, and skips outright under CI — both because
 * there is nothing to clean there and because that job's environment has no
 * reason to carry `DATABASE_URL` for a script living in a different package.
 *
 * Shells out to the backend's own purge script rather than duplicating the
 * predicate here or adding a `postgres` dependency to this package purely for
 * cleanup — one script, reused, not two copies of the same predicate to keep
 * in sync. See `backend/src/db/purge-e2e-users.ts` for what it actually does
 * and the three-part predicate that keeps it from ever touching a named
 * account or a Northwind teammate.
 *
 * Best-effort: a teardown failure is logged, never thrown. A cleanup script
 * failing should not report your test run as failed.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export default async function globalTeardown() {
  if (process.env.CI) return;

  const backendDir = path.resolve(import.meta.dirname, '../backend');
  console.log('  🧹 Purging accumulated e2e test users (local run only)...');

  try {
    // `shell: true` is required on Windows — `npx` resolves to `npx.cmd`
    // there, which execFileSync cannot locate on its own (fails ENOENT).
    const output = execFileSync('npx tsx src/db/purge-e2e-users.ts --yes', {
      cwd: backendDir,
      encoding: 'utf8',
      stdio: 'pipe',
      shell: true,
    });
    for (const line of output.trim().split('\n')) console.log('    ' + line);
  } catch (err: any) {
    // Missing DATABASE_URL, network blip, whatever — never fail the run over
    // housekeeping. Surface it so it's not silently invisible either.
    console.warn('  ⚠️  e2e user purge skipped:', err?.message ?? err);
  }
}
