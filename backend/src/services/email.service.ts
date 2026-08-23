import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// ─── Gate 1: is real mail allowed to leave this machine at all? ──────────────
//
// This condition used to be `env.NODE_ENV !== 'test'`, which looks safe and is
// not. The e2e seed drives the *live HTTP API* against a development server
// rather than an in-process test harness, so NODE_ENV was 'development' and the
// guard never applied. Every seeded registration enqueues a verification email
// (auth.controller.ts), and a single seed run mails hundreds of `@demo.com`
// addresses that do not exist. On 2026-08-19 that hit ~600 bounced messages in
// one day and got the sending Gmail account suspended for spam.
//
// Sending now requires a deliberate decision rather than the absence of one.
const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
const sendingAllowed = env.NODE_ENV === 'production' || env.SMTP_ALLOW_DEV;

let transporter: nodemailer.Transporter | null = null;

if (smtpConfigured && sendingAllowed) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT || '587', 10),
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  console.log(`[email] Live SMTP enabled via ${env.SMTP_HOST} as ${env.SMTP_USER}.`);
} else if (smtpConfigured) {
  console.log(
    '[email] SMTP is configured but sending is off outside production. ' +
      'Links will be logged to this console. Set SMTP_ALLOW_DEV=true to send for real.',
  );
} else {
  console.log('[email] No SMTP configured — links will be logged to this console.');
}

// ─── Gate 2: is this address one that can actually receive mail? ─────────────
//
// Every one of the 1,205 seeded accounts used `@demo.com`. That is a real
// registered domain with no mailboxes behind it, so each message hard-bounced,
// and a pile of hard bounces from one sender is the exact signature providers
// treat as spam. Reserved and obviously-fake domains are therefore never mailed
// even when sending is switched on — the message is logged instead.
const UNDELIVERABLE_DOMAINS = new Set([
  'demo.com',
  'example.com',
  'example.net',
  'example.org',
  'test.com',
  'localhost',
]);

// RFC 2606 / RFC 6761 reserve these for documentation and testing; they can
// never resolve to a real mail host.
const UNDELIVERABLE_SUFFIXES = ['.test', '.example', '.invalid', '.local', '.localhost'];

const isDeliverable = (toEmail: string): boolean => {
  const domain = toEmail.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  if (UNDELIVERABLE_DOMAINS.has(domain)) return false;
  return !UNDELIVERABLE_SUFFIXES.some((suffix) => domain.endsWith(suffix));
};

// ─── Gate 3: how many have gone out today? ───────────────────────────────────
//
// Last line of defence against a loop or an unattended script. The counter is
// per-process, which is enough: it only has to stop one runaway run, and the
// process is what would be doing the running away.
const DAILY_CAP = env.SMTP_MAX_PER_DAY || (env.NODE_ENV === 'production' ? 500 : 25);

let sentCount = 0;
let sentOn = '';

const withinDailyCap = (): boolean => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== sentOn) {
    sentOn = today;
    sentCount = 0;
  }
  return sentCount < DAILY_CAP;
};

export const sendInviteEmail = async (toEmail: string, workspaceName: string, inviteToken: string, inviterName: string) => {
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${frontendUrl}/register?inviteToken=${inviteToken}`;

  // Routed through `deliver` like every other message. It used to call
  // `transporter.sendMail` directly, which meant it bypassed the recipient and
  // rate gates entirely — the one path that most needs them, since invites go
  // to addresses nobody has verified.
  await deliver(
    toEmail,
    `You have been invited to join ${workspaceName} on DevSync`,
    `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">You're Invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join their workspace <strong>"${workspaceName}"</strong> on DevSync.</p>
        <p>Click the button below to register and join the workspace.</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Accept Invitation
        </a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
          If the button doesn't work, you can copy and paste this link into your browser:<br>
          <a href="${inviteLink}">${inviteLink}</a>
        </p>
      </div>
    `,
    `${inviterName} has invited you to join their workspace "${workspaceName}". Join here: ${inviteLink}`,
  );
};

const mockLog = (toEmail: string, subject: string, link: string): void => {
  console.log('--------------------------------------------------');
  console.log(`MOCK EMAIL SENT TO: ${toEmail}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`LINK: ${link}`);
  console.log('--------------------------------------------------');
};

const deliver = async (toEmail: string, subject: string, html: string, text: string): Promise<void> => {
  // A skipped send is a deliberate outcome, not a failure — never throw here,
  // or the job queue retries it three times and registration reports an error
  // for something that worked.
  if (!transporter) {
    mockLog(toEmail, subject, text);
    return;
  }

  if (!isDeliverable(toEmail)) {
    console.log(`[email] Skipped ${toEmail} — reserved or non-deliverable domain.`);
    mockLog(toEmail, subject, text);
    return;
  }

  if (!withinDailyCap()) {
    console.warn(
      `[email] Daily cap of ${DAILY_CAP} reached — not sending to ${toEmail}. ` +
        'Raise SMTP_MAX_PER_DAY if this is legitimate traffic.',
    );
    mockLog(toEmail, subject, text);
    return;
  }

  sentCount += 1;
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM || '"DevSync" <noreply@devsync.local>',
      to: toEmail,
      subject,
      text,
      html,
    });
    console.log(`Email sent to ${toEmail}`);
  } catch (error) {
    console.error(`Failed to send email to ${toEmail}:`, error);
    throw new Error('Failed to send email.');
  }
};

export const sendPasswordResetEmail = async (toEmail: string, resetToken: string): Promise<void> => {
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  await deliver(
    toEmail,
    'Reset your DevSync password',
    `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">Reset your password</h2>
        <p>You requested a password reset for your DevSync account. This link expires in 30 minutes.</p>
        <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Reset Password
        </a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
          If you didn't request this, you can safely ignore this email.
          <br><a href="${resetLink}">${resetLink}</a>
        </p>
      </div>
    `,
    `Reset your DevSync password: ${resetLink}`
  );
};

export const sendVerificationEmail = async (toEmail: string, verificationToken: string): Promise<void> => {
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
  const verifyLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

  await deliver(
    toEmail,
    'Verify your DevSync email',
    `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">Verify your email</h2>
        <p>Welcome to DevSync! Confirm your email address to complete your account setup.</p>
        <a href="${verifyLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Verify Email
        </a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
          This link expires in 24 hours.
          <br><a href="${verifyLink}">${verifyLink}</a>
        </p>
      </div>
    `,
    `Verify your DevSync email: ${verifyLink}`
  );
};
