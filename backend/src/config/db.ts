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

// Connection for queries (pool mode)
const queryClient = postgres(env.DATABASE_URL);

export const db = drizzle(queryClient, { schema });

// Export for use in drizzle-kit migrations
export { queryClient };
