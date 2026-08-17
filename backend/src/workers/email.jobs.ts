import { registerWorker } from './queue.js';
import { sendInviteEmail } from '../services/email.service.js';

export interface InviteEmailPayload {
  toEmail: string;
  workspaceName: string;
  inviteToken: string;
  inviterName: string;
}

export const registerEmailWorkers = (): void => {
  registerWorker('email.send_invite', async (payload: InviteEmailPayload) => {
    await sendInviteEmail(payload.toEmail, payload.workspaceName, payload.inviteToken, payload.inviterName);
  });
};