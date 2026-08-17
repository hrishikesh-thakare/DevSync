import { randomUUID } from 'node:crypto';

/**
 * Lightweight in-process background job queue.
 *
 * Jobs are processed asynchronously on a small concurrency pool so slow
 * work (SMTP delivery, GitHub webhook event processing) never blocks the
 * request handler that enqueued them. Failed jobs are retried with
 * exponential backoff up to a per-job attempt limit.
 *
 * NOTE: In-memory only — jobs are lost if the process exits. Swap this
 * module for BullMQ/ioredis if durable queues are needed.
 */

type JobHandler = (payload: any) => Promise<void> | void;

interface Job {
  id: string;
  name: string;
  payload: any;
  attempts: number;
  maxAttempts: number;
  backoffMs: number;
  handler: JobHandler;
}

const handlers = new Map<string, JobHandler>();
const queue: Job[] = [];
let running = 0;
let drained = false;

const MAX_CONCURRENCY = 4;

export const registerWorker = (name: string, handler: JobHandler): void => {
  handlers.set(name, handler);
};

export const enqueueJob = (
  name: string,
  payload: any,
  opts: { maxAttempts?: number; backoffMs?: number; delayMs?: number } = {}
): void => {
  const handler = handlers.get(name);
  if (!handler) {
    console.warn(`[queue] no worker registered for job '${name}' — dropping job`);
    return;
  }

  const job: Job = {
    id: randomUUID(),
    name,
    payload,
    attempts: 0,
    maxAttempts: opts.maxAttempts ?? 3,
    backoffMs: opts.backoffMs ?? 2000,
    handler,
  };

  queue.push(job);
  if (opts.delayMs) {
    setTimeout(() => drain(), opts.delayMs);
  } else {
    drain();
  }
};

const drain = (): void => {
  if (drained) return;

  while (running < MAX_CONCURRENCY && queue.length > 0) {
    const job = queue.shift()!;
    running++;
    void processJob(job).finally(() => {
      running--;
      drain();
    });
  }
};

const processJob = async (job: Job): Promise<void> => {
  job.attempts++;
  try {
    await job.handler(job.payload);
  } catch (err) {
    console.error(`[queue] job '${job.name}' (${job.id}) attempt ${job.attempts}/${job.maxAttempts} failed:`, err);

    if (job.attempts < job.maxAttempts) {
      const backoff = job.backoffMs * 2 ** (job.attempts - 1);
      setTimeout(() => {
        queue.push(job);
        drain();
      }, backoff);
    } else {
      console.error(`[queue] job '${job.name}' (${job.id}) failed permanently after ${job.maxAttempts} attempts`);
    }
  }
};

export const getQueueStats = (): { pending: number; running: number; workers: number } => ({
  pending: queue.length,
  running,
  workers: handlers.size,
});

export const shutdownQueue = (): void => {
  drained = true;
  queue.length = 0;
};