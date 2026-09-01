import { registerEmailWorkers } from './email.jobs.js';
import { registerGithubWorkers } from './github.jobs.js';
import { registerCleanupWorkers, stopCleanupWorkers } from './cleanup.jobs.js';

export { enqueueJob, getQueueStats, shutdownQueue, registerWorker } from './queue.js';
export { cleanupExpiredTokens, stopCleanupWorkers } from './cleanup.jobs.js';

export const registerWorkers = (): void => {
  registerEmailWorkers();
  registerGithubWorkers();
  registerCleanupWorkers();
};

export const stopWorkers = (): void => {
  stopCleanupWorkers();
};
