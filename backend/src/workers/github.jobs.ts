import { registerWorker } from './queue.js';
import { processGithubWebhookEvent } from '../modules/github/github.controller.js';

export interface GithubWebhookJobPayload {
  projectId: string;
  event: string;
  payload: any;
  defaultBranch: string | null;
}

export const registerGithubWorkers = (): void => {
  registerWorker('github.webhook_event', async (job: GithubWebhookJobPayload) => {
    await processGithubWebhookEvent(job.projectId, job.event, job.payload, job.defaultBranch);
  });
};