/**
 * Deletes accumulated e2e test users.
 *
 * Every full Playwright run creates fixture accounts with `Date.now()`-suffixed
 * emails (`forgot-pw-7020-1788799373445@demo.com`) and never tears them down, so
 * the users table grows by roughly 75 rows per run. Two weeks of runs had put
 * ~1,020 of them in the database against 29 real accounts.
 *
 * Three conditions define "debris", and all three must hold:
 *   1. the local part carries a 10+ digit timestamp
 *   2. it is NOT a named account (`alice@demo.com` and friends)
 *   3. it is NOT a Northwind demo teammate
 *
 * Deleting a user cascades `workspace_members`, `refresh_tokens` and
 * `auth_tokens`, and SET NULLs authored rows. Verified before writing this:
 * these accounts hold 0 tasks and 0 messages in `e2e-test-workspace` and
 * `northwind-labs`, so the only cascade that touches a kept workspace is the
 * removal of junk membership rows.
 *
 * Dry run (default):  npx tsx src/db/purge-e2e-users.ts
 * Actually delete:    npx tsx src/db/purge-e2e-users.ts --yes
 */
import 'dotenv/config';
import postgres from 'postgres';

const COMMIT = process.argv.includes('--yes');

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
  try {
    // A single predicate, defined once and reused, so the preview and the
    // delete can never drift apart.
    //
    // Columns are qualified with `users.` deliberately: `workspaces` also has a
    // `deleted_at`, so the ownership query below — which joins both tables —
    // fails with "column reference deleted_at is ambiguous" on bare names.
    // Every query here therefore refers to the users table as `users`, never
    // via a short alias.
    const isDebris = sql`
      users.deleted_at IS NULL
      AND users.email ~ '[0-9]{10,}'
      AND users.email !~ '^[a-z]+@demo\.com$'
      AND users.email NOT LIKE '%@northwind.dev'
    `;

    const [{ n: target }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM users WHERE ${isDebris}
    `;
    const [{ n: keep }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM users
      WHERE users.deleted_at IS NULL AND NOT (${isDebris})
    `;

    // Refuse to run if the predicate would take an account that must survive.
    const [{ n: tripwire }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM users
      WHERE ${isDebris}
        AND (users.email IN ('alice@demo.com','bob@demo.com','carol@demo.com','dave@demo.com','eve@demo.com')
             OR users.email LIKE '%@northwind.dev')
    `;
    if (tripwire > 0) {
      throw new Error(`Refusing to run: predicate matches ${tripwire} protected account(s).`);
    }

    // Content in workspaces that must not be disturbed.
    const [{ n: owned }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM workspaces w
      JOIN users ON users.user_id = w.owner_id WHERE ${isDebris}
    `;

    console.log(`debris users to delete : ${target}`);
    console.log(`accounts kept          : ${keep}`);
    console.log(`workspaces they own    : ${owned}${owned ? '  ← these would be left owner-less' : ''}`);

    const sample = await sql<{ email: string }[]>`
      SELECT email FROM users WHERE ${isDebris} ORDER BY random() LIMIT 5
    `;
    console.log('sample                 :', sample.map((r) => r.email).join(', '));

    if (!COMMIT) {
      console.log('\nDRY RUN — nothing deleted. Re-run with --yes to commit.');
      return;
    }

    const deleted = await sql`DELETE FROM users WHERE ${isDebris} RETURNING user_id`;
    console.log(`\ndeleted ${deleted.length} users`);

    const [{ n: remaining }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM users WHERE deleted_at IS NULL
    `;
    console.log(`users remaining        : ${remaining}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error('Purge failed:', e.message ?? e);
  process.exit(1);
});
