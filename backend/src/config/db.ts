import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env.js';
import * as authSchema from '../db/schema/auth.js';
import * as workspacesSchema from '../db/schema/workspaces.js';
import * as projectsSchema from '../db/schema/projects.js';
import * as tasksSchema from '../db/schema/tasks.js';
import * as sprintsSchema from '../db/schema/sprints.js';
import * as channelsSchema from '../db/schema/channels.js';
import * as githubSchema from '../db/schema/github.js';
import * as notificationsSchema from '../db/schema/notifications.js';
import * as auditSchema from '../db/schema/audit.js';
import * as labelsSchema from '../db/schema/labels.js';

const schema = {
  ...authSchema,
  ...workspacesSchema,
  ...projectsSchema,
  ...tasksSchema,
  ...sprintsSchema,
  ...channelsSchema,
  ...githubSchema,
  ...notificationsSchema,
  ...auditSchema,
  ...labelsSchema,
};

/**
 * A pooled connection string (Supabase's transaction pooler on :6543, PgBouncer
 * generally) multiplexes many clients onto few server connections, so a session
 * that issues `PREPARE` cannot rely on getting the same backend again — the
 * prepared statement postgres-js creates by default is gone by the time it is
 * executed. Detect the pooler from the URL and turn prepared statements off.
 */
const detectPooled = (url: string): boolean => {
  try {
    const { hostname, port, searchParams } = new URL(url);
    return (
      port === '6543' ||
      hostname.includes('pooler.') ||
      hostname.includes('pgbouncer') ||
      searchParams.get('pgbouncer') === 'true'
    );
  } catch {
    return false;
  }
};

/** Managed Postgres requires TLS; a local dev server generally has none. */
const detectSsl = (url: string): boolean => {
  try {
    const { hostname, searchParams } = new URL(url);
    const mode = searchParams.get('sslmode');
    if (mode) return mode !== 'disable';
    return !['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch {
    return env.NODE_ENV === 'production';
  }
};

const isPooled = detectPooled(env.DATABASE_URL);
const useSsl = env.DB_SSL ?? detectSsl(env.DATABASE_URL);

// Connection for queries (pool mode)
const queryClient = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_MAX,
  idle_timeout: env.DB_IDLE_TIMEOUT,
  connect_timeout: env.DB_CONNECT_TIMEOUT,
  prepare: env.DB_PREPARE ?? !isPooled,
  // `require` verifies the connection is encrypted without demanding a locally
  // trusted CA chain, which is what managed providers hand out.
  ssl: useSsl ? 'require' : false,
  onnotice: env.NODE_ENV === 'production' ? () => {} : undefined,
});

export const db = drizzle(queryClient, { schema });

// Export for use in drizzle-kit migrations
export { queryClient };
