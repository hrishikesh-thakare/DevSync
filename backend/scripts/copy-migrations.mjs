/**
 * `tsc` only emits what it compiles, so the `.sql` files and the drizzle journal
 * that live beside the schema in `src/db/migrations` never reach `dist/`. The
 * migrator needs them at runtime, so copy the folder verbatim after a build.
 */
import { cp, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'src', 'db', 'migrations');
const to = path.join(root, 'dist', 'db', 'migrations');

try {
  await access(from);
} catch {
  console.error(`copy-migrations: nothing at ${from}`);
  process.exit(1);
}

await cp(from, to, { recursive: true });
console.log(`copy-migrations: ${from} -> ${to}`);
