import { taskStatusTransitions } from '../../db/schema/tasks.js';

/** The status a finished task sits in. */
export const DONE_STATUS = 'done';

/**
 * Append one row to the status history.
 *
 * Intentionally has no try/catch. `logAuditAction` swallows its own failures,
 * which is right for an audit trail and wrong here: a dropped row silently
 * skews every cycle-time and throughput number computed afterwards. Letting
 * this throw rolls back the surrounding transaction, so the status change and
 * its history row either both land or neither does.
 *
 * Always call inside the same `tx` as the status update.
 */
export const recordStatusTransition = async (
  tx: any,
  params: {
    taskId: string;
    projectId: string | null;
    fromStatus: string | null;
    toStatus: string;
    actorId: string | null;
    changedAt?: Date;
  },
): Promise<void> => {
  await tx.insert(taskStatusTransitions).values({
    taskId: params.taskId,
    projectId: params.projectId,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    actorId: params.actorId,
    changedAt: params.changedAt ?? new Date(),
  });
};

/**
 * What `tasks.completed_at` should become for a status move.
 *
 * Entering `done` stamps it; leaving `done` clears it, so a reopened task stops
 * counting as delivered. Returns undefined when the move does not cross the
 * done boundary, meaning "leave the column alone".
 */
export const completedAtFor = (
  fromStatus: string | null,
  toStatus: string,
  at: Date = new Date(),
): Date | null | undefined => {
  const wasDone = fromStatus === DONE_STATUS;
  const isDone = toStatus === DONE_STATUS;
  if (isDone && !wasDone) return at;
  if (!isDone && wasDone) return null;
  return undefined;
};
