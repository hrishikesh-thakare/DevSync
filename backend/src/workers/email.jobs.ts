import { registerWorker } from './queue.js';
import { sendInviteEmail, sendPasswordResetEmail, sendVerificationEmail } from '../services/email.service.js';

export interface InviteEmailPayload {
  toEmail: string;
  workspaceName: string;
  inviteToken: string;
  inviterName: string;
}

export interface PasswordResetEmailPayload {
  toEmail: string;
  resetToken: string;
}

export interface VerificationEmailPayload {
  toEmail: string;
  verificationToken: string;
}

export const registerEmailWorkers = (): void => {
  registerWorker('email.send_invite', async (payload: InviteEmailPayload) => {
    await sendInviteEmail(payload.toEmail, payload.workspaceName, payload.inviteToken, payload.inviterName);
  });

  registerWorker('email.send_password_reset', async (payload: PasswordResetEmailPayload) => {
    await sendPasswordResetEmail(payload.toEmail, payload.resetToken);
  });

  registerWorker('email.send_verification', async (payload: VerificationEmailPayload) => {
    await sendVerificationEmail(payload.toEmail, payload.verificationToken);
  });
};