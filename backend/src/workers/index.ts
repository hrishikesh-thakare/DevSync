import { registerEmailWorkers } from './email.jobs.js';
import { registerGithubWorkers } from './github.jobs.js';

export { enqueueJob, getQueueStats, shutdownQueue, registerWorker } from './queue.js';

export const registerWorkers = (): void => {
  registerEmailWorkers();
  registerGithubWorkers();
};