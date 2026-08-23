import { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { projectLabels } from '../../db/schema/labels.js';
import { tasks } from '../../db/schema/tasks.js';
import { eq, and, sql } from 'drizzle-orm';
import { logAuditAction } from '../audit/audit.controller.js';
import { projects } from '../../db/schema/projects.js';

const DEFAULT_LABEL_COLOR = '#64748b';

// Normalize a label name: trim, collapse inner whitespace, lowercase.
// Lowercasing is what reconciles "Frontend" vs "frontend" into one label.
const normalizeLabelName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const getWorkspaceId = async (projectId: string) => {
  const [project] = await db.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, projectId));
  return project?.workspaceId ?? undefined;
};

// Ensure a set of label names exist for a project (called on task create/update).
// Returns the canonical (already registered) names so callers can reconcile casing.
export const ensureProjectLabels = async (tx: any, projectId: string, labels: string[]): Promise<string[]> => {
  const names = [...new Set(labels.map(normalizeLabelName).filter(Boolean))];
  if (names.length === 0) return [];

  const existing = await tx
    .select({ name: projectLabels.name })
    .from(projectLabels)
    .where(and(eq(projectLabels.projectId, projectId), sql`lower(${projectLabels.name}) IN (${names.map(n => n.toLowerCase())})`));

  const existingLower = new Set(existing.map((l: any) => l.name.toLowerCase()));
  const missing = names.filter(n => !existingLower.has(n));

  if (missing.length > 0) {
    await tx.insert(projectLabels).values(missing.map(name => ({ projectId, name, color: DEFAULT_LABEL_COLOR })));
  }

  // Return canonical names (reconcile casing: use stored name for matches)
  const result: string[] = [];
  for (const n of names) {
    const match = existing.find((l: any) => l.name.toLowerCase() === n);
    result.push(match ? match.name : n);
  }
  return result;
};

// ─── LIST LABELS ─────────────────────────────────────────────────────────────
// GET /api/projects/:projectId/labels
export const listLabels = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId || res.locals.projectId;

    // `usageCount` used to be a correlated subquery, so the whole task table was
    // re-scanned once per label — O(labels × tasks). At 404 labels over 1,181
    // tasks that measured 930ms for a single page load. Counting every label in
    // one pass and joining turns it into one scan plus a hash join.
    const labels = await db.execute(sql`
      WITH usage AS (
        SELECT lower(elem #>> '{}') AS label_name, count(*)::int AS n
        FROM tasks, jsonb_array_elements(tasks.labels) elem
        WHERE tasks.project_id = ${projectId} AND tasks.deleted_at IS NULL
        GROUP BY 1
      )
      SELECT
        l.label_id   AS "labelId",
        l.name       AS "name",
        l.color      AS "color",
        l.created_at AS "createdAt",
        COALESCE(u.n, 0) AS "usageCount"
      FROM project_labels l
      LEFT JOIN usage u ON u.label_name = lower(l.name)
      WHERE l.project_id = ${projectId}
      ORDER BY l.name
    `);

    // A raw `db.execute` hands back driver-native values, so `created_at`
    // arrives as a Postgres timestamp string rather than the ISO form Drizzle's
    // query builder produces. Normalise it so this endpoint and `POST /labels`
    // describe a label the same way.
    res.json({
      labels: labels.map((l: Record<string, unknown>) => ({
        ...l,
        createdAt: l.createdAt ? new Date(l.createdAt as string).toISOString() : null,
      })),
    });
  } catch (err) {
    console.error('List labels error:', err);
    res.status(500).json({ error: 'Server error listing labels.' });
  }
};

// ─── CREATE LABEL ────────────────────────────────────────────────────────────
// POST /api/projects/:projectId/labels
export const createLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId || res.locals.projectId;
    const name = normalizeLabelName(req.body.name);
    const color = req.body.color || DEFAULT_LABEL_COLOR;

    const [existing] = await db
      .select({ labelId: projectLabels.labelId, name: projectLabels.name })
      .from(projectLabels)
      .where(and(eq(projectLabels.projectId, projectId), sql`lower(${projectLabels.name}) = ${name}`))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: `Label "${existing.name}" already exists.` });
      return;
    }

    const [label] = await db.insert(projectLabels).values({ projectId, name, color }).returning();

    await logAuditAction({
      actorId: req.user!.userId,
      action: 'project_label.created',
      entityType: 'project_label',
      entityId: label.labelId,
      workspaceId: await getWorkspaceId(projectId),
      newValues: { name: label.name, color: label.color, project_id: projectId },
    });

    res.status(201).json({ label });
  } catch (err) {
    console.error('Create label error:', err);
    res.status(500).json({ error: 'Server error creating label.' });
  }
};

// ─── UPDATE LABEL (rename propagates to tasks) ───────────────────────────────
// PATCH /api/projects/:projectId/labels/:labelId
export const updateLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId || res.locals.projectId;
    const { labelId } = req.params as Record<string, string>;

    const [label] = await db
      .select()
      .from(projectLabels)
      .where(and(eq(projectLabels.labelId, labelId), eq(projectLabels.projectId, projectId)))
      .limit(1);

    if (!label) {
      res.status(404).json({ error: 'Label not found.' });
      return;
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (req.body.name !== undefined) {
      const newName = normalizeLabelName(req.body.name);
      const [conflict] = await db
        .select({ labelId: projectLabels.labelId })
        .from(projectLabels)
        .where(and(eq(projectLabels.projectId, projectId), sql`lower(${projectLabels.name}) = ${newName}`, sql`${projectLabels.labelId} <> ${labelId}`))
        .limit(1);
      if (conflict) {
        res.status(409).json({ error: `A label named "${newName}" already exists.` });
        return;
      }
      updateData.name = newName;
    }
    if (req.body.color !== undefined) updateData.color = req.body.color;

    const [updated] = await db
      .update(projectLabels)
      .set(updateData)
      .where(eq(projectLabels.labelId, labelId))
      .returning();

    // Rename propagation: rewrite the label name inside every task's labels array,
    // case-insensitively so "Frontend"/"FRONTEND" variants reconcile to the new name
    if (updateData.name !== undefined && updateData.name !== label.name) {
      await db.execute(sql`
        UPDATE tasks SET labels = (
          SELECT coalesce(jsonb_agg(CASE WHEN lower(elem #>> '{}') = lower(${label.name}::text) THEN to_jsonb(${updateData.name}::text) ELSE elem END), '[]'::jsonb)
          FROM jsonb_array_elements(labels) elem
        ), updated_at = now()
        WHERE project_id = ${projectId} AND deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(labels) e WHERE lower(e #>> '{}') = lower(${label.name}::text))
      `);
    }

    await logAuditAction({
      actorId: req.user!.userId,
      action: 'project_label.updated',
      entityType: 'project_label',
      entityId: labelId,
      workspaceId: await getWorkspaceId(projectId),
      newValues: { name: updated.name, color: updated.color },
      oldValues: { name: label.name, color: label.color },
    });

    res.json({ label: updated });
  } catch (err) {
    console.error('Update label error:', err);
    res.status(500).json({ error: 'Server error updating label.' });
  }
};

// ─── DELETE LABEL (removed from all tasks) ───────────────────────────────────
// DELETE /api/projects/:projectId/labels/:labelId
export const deleteLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId || res.locals.projectId;
    const { labelId } = req.params as Record<string, string>;

    const [label] = await db
      .select()
      .from(projectLabels)
      .where(and(eq(projectLabels.labelId, labelId), eq(projectLabels.projectId, projectId)))
      .limit(1);

    if (!label) {
      res.status(404).json({ error: 'Label not found.' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(projectLabels).where(eq(projectLabels.labelId, labelId));

      // Remove the label from every task that uses it (case-insensitively)
      await tx.execute(sql`
        UPDATE tasks SET labels = (
          SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(labels) elem
          WHERE lower(elem #>> '{}') <> lower(${label.name}::text)
        ), updated_at = now()
        WHERE project_id = ${projectId} AND deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(labels) e WHERE lower(e #>> '{}') = lower(${label.name}::text))
      `);

      await logAuditAction({
        actorId: req.user!.userId,
        action: 'project_label.deleted',
        entityType: 'project_label',
        entityId: labelId,
        workspaceId: await getWorkspaceId(projectId),
        oldValues: { name: label.name, color: label.color },
        tx,
      });
    });

    res.json({ message: 'Label deleted.' });
  } catch (err) {
    console.error('Delete label error:', err);
    res.status(500).json({ error: 'Server error deleting label.' });
  }
};