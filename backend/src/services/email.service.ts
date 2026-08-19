import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter: nodemailer.Transporter | null = null;

// Initialize transporter
// Test environments never send real mail (even if SMTP is configured): the
// e2e suite relies on the mock fallback, and Gmail would rate-limit fast.
if (env.NODE_ENV !== 'test' && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT || '587', 10),
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

export const sendInviteEmail = async (toEmail: string, workspaceName: string, inviteToken: string, inviterName: string) => {
  const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${frontendUrl}/register?inviteToken=${inviteToken}`;

  const mailOptions = {
    from: env.SMTP_FROM || '"DevSync" <noreply@devsync.local>',
    to: toEmail,
    subject: `You have been invited to join ${workspaceName} on DevSync`,
    text: `${inviterName} has invited you to join their workspace "${workspaceName}".\n\nClick here to join: ${inviteLink}`,
    html: `
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
  };

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${toEmail}`);
    } catch (error) {
      console.error(`Failed to send email to ${toEmail}:`, error);
      throw new Error('Failed to send email.');
    }
  } else {
    // Fallback for local development if SMTP is not configured
    console.log('--------------------------------------------------');
    console.log(`MOCK EMAIL SENT TO: ${toEmail}`);
    console.log(`SUBJECT: ${mailOptions.subject}`);
    console.log(`INVITE LINK: ${inviteLink}`);
    console.log('--------------------------------------------------');
  }
};

const mockLog = (toEmail: string, subject: string, link: string): void => {
  console.log('--------------------------------------------------');
  console.log(`MOCK EMAIL SENT TO: ${toEmail}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`LINK: ${link}`);
  console.log('--------------------------------------------------');
};

const deliver = async (toEmail: string, subject: string, html: string, text: string): Promise<void> => {
  if (!transporter) {
    mockLog(toEmail, subject, text);
    return;
  }
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
