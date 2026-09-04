import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The queue holds invite emails and GitHub webhook processing. Its retry and
 * backoff behaviour has never been directly exercised — it only ever ran behind
 * an e2e test that asserted the eventual side effect, which passes just as
 * happily when a job succeeds first try as when it succeeds on the third.
 */
const load = async () => {
  vi.resetModules();
  process.env.DATABASE_URL ||= 'postgres://localhost:5432/none';
  process.env.JWT_SECRET ||= 'test-secret-that-is-at-least-32-chars-long';
  return import('./queue.js');
};

/** Lets queued microtasks settle without leaning on real timers. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('queue', () => {
  it('runs a registered handler with its payload', async () => {
    const { registerWorker, enqueueJob } = await load();
    const handler = vi.fn().mockResolvedValue(undefined);

    registerWorker('test.job', handler);
    enqueueJob('test.job', { id: 7 });
    await flush();

    expect(handler).toHaveBeenCalledWith({ id: 7 });
  });

  it('drops a job with no registered worker instead of throwing', async () => {
    const { enqueueJob, getQueueStats } = await load();
    expect(() => enqueueJob('nobody.listens', {})).not.toThrow();
    expect(getQueueStats().pending).toBe(0);
  });

  it('retries a failing job up to maxAttempts with exponential backoff', async () => {
    const { registerWorker, enqueueJob } = await load();
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error('smtp timeout'))
      .mockRejectedValueOnce(new Error('smtp timeout'))
      .mockResolvedValueOnce(undefined);

    registerWorker('flaky.job', handler);
    enqueueJob('flaky.job', {}, { maxAttempts: 3, backoffMs: 100 });

    await flush();
    expect(handler).toHaveBeenCalledTimes(1);

    // First retry after backoffMs.
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    expect(handler).toHaveBeenCalledTimes(2);

    // Second retry doubles it.
    await vi.advanceTimersByTimeAsync(200);
    await flush();
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('gives up after maxAttempts rather than retrying forever', async () => {
    const { registerWorker, enqueueJob } = await load();
    const handler = vi.fn().mockRejectedValue(new Error('permanent'));

    registerWorker('doomed.job', handler);
    enqueueJob('doomed.job', {}, { maxAttempts: 2, backoffMs: 50 });

    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not let one failing job block the others', async () => {
    const { registerWorker, enqueueJob } = await load();
    const failing = vi.fn().mockRejectedValue(new Error('nope'));
    const succeeding = vi.fn().mockResolvedValue(undefined);

    registerWorker('bad.job', failing);
    registerWorker('good.job', succeeding);

    enqueueJob('bad.job', {}, { maxAttempts: 1 });
    enqueueJob('good.job', {});
    await flush();

    expect(succeeding).toHaveBeenCalledTimes(1);
  });

  it('reports pending and worker counts', async () => {
    const { registerWorker, getQueueStats } = await load();
    registerWorker('a', vi.fn());
    registerWorker('b', vi.fn());
    expect(getQueueStats().workers).toBe(2);
  });

  it('stops accepting work after shutdown', async () => {
    const { registerWorker, enqueueJob, shutdownQueue, getQueueStats } = await load();
    const handler = vi.fn().mockResolvedValue(undefined);
    registerWorker('late.job', handler);

    await shutdownQueue();
    enqueueJob('late.job', {});
    await flush();

    expect(handler).not.toHaveBeenCalled();
    expect(getQueueStats().pending).toBe(0);
  });

  it('finishes queued work during shutdown instead of discarding it', async () => {
    // The regression this guards: shutdown used to set its flag and then
    // `queue.length = 0`, throwing away every pending job while the server
    // logged "Job queue drained". In practice that silently dropped invitation
    // and password-reset emails the user had already been told were sent, and
    // GitHub webhook events that had already been answered 200.
    const { registerWorker, enqueueJob, shutdownQueue } = await load();

    const started: string[] = [];
    const finished: string[] = [];
    registerWorker('slow.job', async ({ id }: { id: string }) => {
      started.push(id);
      await new Promise((resolve) => setTimeout(resolve, 20));
      finished.push(id);
    });

    // More jobs than MAX_CONCURRENCY (4), so some are still sitting in the
    // array — unstarted — at the moment shutdown is called.
    for (let i = 0; i < 10; i++) enqueueJob('slow.job', { id: `job-${i}` });

    await shutdownQueue();

    expect(finished).toHaveLength(10);
    expect(new Set(finished).size).toBe(10);
  });

  it('gives up on shutdown rather than hanging on a wedged handler', async () => {
    const { registerWorker, enqueueJob, shutdownQueue } = await load();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    registerWorker('wedged.job', () => new Promise(() => {}));
    enqueueJob('wedged.job', {});

    // A handler that never settles must not block the process from exiting.
    await shutdownQueue(150);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('shutdown timed out'));
    errorSpy.mockRestore();
  });
});
