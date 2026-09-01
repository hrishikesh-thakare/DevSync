/**
 * Production migration runner.
 *
 * `drizzle-kit migrate` cannot do this job on a deployed host: drizzle-kit is a
 * devDependency, so it is absent after `npm ci --omit=dev`, and it reads
 * `drizzle.config.ts` with tsx, which is also a devDependency. That left a
 * deployed API with no way to reach its own schema.
 *
 * `drizzle-orm/postgres-js/migrator` ships in the runtime dependency we already
 * have. It applies the same journal and the same `.sql` files, records them in
 * the same `__drizzle_migrations` table, and is safe to run on every boot —
 * already-applied migrations are skipped.
 *
 *   npm run db:deploy      # standalone, before or during release
 */
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, queryClient } from '../config/db.js';
import { assertEnv } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * `tsc` copies no `.sql`, so the compiled `dist/db/` has no migrations beside
 * it. Look there first anyway (a Docker build may stage them in), then fall
 * back to the source tree, which is present on every host that builds from the
 * repo.
 */
const resolveMigrationsFolder = (): string => {
  const candidates = [
    path.join(here, 'migrations'),
    path.resolve(process.cwd(), 'src/db/migrations'),
    path.resolve(process.cwd(), 'backend/src/db/migrations'),
  ];

  const found = candidates.find((dir) => existsSync(path.join(dir, 'meta', '_journal.json')));
  if (!found) {
    throw new Error(
      `Could not locate the migrations folder. Looked in:\n${candidates.map((c) => `  - ${c}`).join('\n')}`
    );
  }
  return found;
};

export const runMigrations = async (): Promise<void> => {
  const migrationsFolder = resolveMigrationsFolder();
  console.log(`🗄️  Applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log('✅ Migrations up to date');
};

// Run standalone when invoked directly, not when imported by the server.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  assertEnv();
  runMigrations()
    .then(() => queryClient.end({ timeout: 5 }))
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('❌ Migration failed:', err);
      await queryClient.end({ timeout: 5 }).catch(() => {});
      process.exit(1);
    });
}
