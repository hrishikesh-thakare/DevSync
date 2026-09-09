import { randomUUID } from 'node:crypto';

/**
 * Lightweight in-process background job queue.
 *
 * Jobs are processed asynchronously on a small concurrency pool so slow
 * work (SMTP delivery, GitHub webhook event processing) never blocks the
 * request handler that enqueued them. Failed jobs are retried with
 * exponential backoff up to a per-job attempt limit.
 *
 * NOTE: In-memory only — jobs enqueued but not yet finished are lost if the
 * process is killed rather than shut down cleanly. `shutdownQueue` waits for
 * what is already queued, which covers a normal deploy; it does not survive a
 * crash. Swap this module for BullMQ/ioredis if that guarantee is needed.
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
// Two flags rather than one: `accepting` closes the door to new work, while
// `stopped` closes the drain loop. A single flag could not express "refuse new
// jobs but finish the ones you have", which is what a clean shutdown needs.
let accepting = true;
let stopped = false;

const MAX_CONCURRENCY = 4;

export const registerWorker = (name: string, handler: JobHandler): void => {
  handlers.set(name, handler);
};

export const enqueueJob = (
  name: string,
  payload: any,
  opts: { maxAttempts?: number; backoffMs?: number; delayMs?: number } = {}
): void => {
  // After shutdown the drain loop is closed, so a pushed job would sit in the
  // array forever and keep the shutdown snapshot looking non-empty. Refuse it
  // at the door instead.
  if (!accepting) {
    console.warn(`[queue] shutting down — dropping job '${name}'`);
    return;
  }

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
  if (stopped) return;

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

/** Queue depth, for tests and for anything that wants to observe shutdown. */
export const getQueueStats = (): { pending: number; running: number; workers: number } => ({
  pending: queue.length,
  running,
  workers: handlers.size,
});

/**
 * Stops accepting new jobs and waits for the queued ones to finish.
 *
 * This used to set the flag and then `queue.length = 0` — discarding every
 * pending job while `index.ts` logged "Job queue drained". On a deploy that
 * silently threw away invitation, password-reset and verification emails the
 * user had already been told were sent, plus any GitHub webhook event still in
 * flight (those are answered `200` on receipt, and GitHub never retries a 200).
 *
 * `timeoutMs` bounds the wait so a wedged handler cannot block shutdown
 * forever; whatever is still pending when it expires is reported, not hidden.
 */
export const shutdownQueue = async (timeoutMs = 10_000): Promise<void> => {
  accepting = false;

  const deadline = Date.now() + timeoutMs;
  while ((queue.length > 0 || running > 0) && Date.now() < deadline) {
    drain();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const abandoned = queue.length + running;
  if (abandoned > 0) {
    console.error(`[queue] shutdown timed out with ${abandoned} job(s) unfinished`);
  }

  stopped = true;
  queue.length = 0;
};