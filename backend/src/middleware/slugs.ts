import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db.js';
import { workspaces } from '../db/schema/workspaces.js';
import { projects } from '../db/schema/projects.js';
import { tasks } from '../db/schema/tasks.js';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Resolves a workspace slug (e.g., 'acme-corp') to a workspace UUID.
 * Injects req.params.workspaceId so existing controllers and middleware function seamlessly.
 */
export const resolveSlug = async (req: Request, res: Response, next: NextFunction, slug: string): Promise<void> => {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);
    const condition = isUuid ? eq(workspaces.workspaceId, slug) : eq(workspaces.slug, slug);

    const [ws] = await db
      .select({ id: workspaces.workspaceId })
      .from(workspaces)
      .where(and(condition, isNull(workspaces.deletedAt)))
      .limit(1);

    if (!ws) {
      res.status(404).json({ error: 'Workspace not found.' });
      return;
    }

    // Mutate req.params to include the resolved UUID
    req.params.workspaceId = ws.id;
    next();
  } catch (err) {
    console.error('resolveSlug error:', err);
    res.status(500).json({ error: 'Internal server error resolving workspace.' });
  }
};

/**
 * Resolves a project key (e.g., 'PROJ') to a project UUID.
 * Must be used in conjunction with a workspace resolver if checking constraints,
 * but globally unique keys per workspace allow direct lookup here.
 */
export const resolveProjectKey = async (req: Request, res: Response, next: NextFunction, key: string): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string | undefined; // Assuming resolveSlug ran first

    const conditions = [eq(projects.key, key.toUpperCase())];
    if (workspaceId) {
      conditions.push(eq(projects.workspaceId, workspaceId));
    }

    const [proj] = await db
      .select({ id: projects.projectId })
      .from(projects)
      .where(and(...conditions))
      .limit(1);

    if (!proj) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    req.params.projectId = proj.id;
    next();
  } catch (err) {
    console.error('resolveProjectKey error:', err);
    res.status(500).json({ error: 'Internal server error resolving project.' });
  }
};

/**
 * Resolves a task key (e.g., 'PROJ-15') to a task UUID.
 */
export const resolveTaskKey = async (req: Request, res: Response, next: NextFunction, taskKey: string): Promise<void> => {
  try {
    const projectId = req.params.projectId as string | undefined; // Assuming resolveProjectKey ran first

    const conditions = [];
    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId));
    }

    // Check if taskKey is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(taskKey)) {
      conditions.push(eq(tasks.taskId, taskKey));
    } else {
      conditions.push(eq(tasks.taskKey, taskKey.toUpperCase()));
    }

    const [task] = await db
      .select({ id: tasks.taskId })
      .from(tasks)
      .where(and(...conditions))
      .limit(1);

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    req.params.taskId = task.id;
    res.locals.taskId = task.id;
    next();
  } catch (err) {
    console.error('resolveTaskKey error:', err);
    res.status(500).json({ error: 'Internal server error resolving task.' });
  }
};
