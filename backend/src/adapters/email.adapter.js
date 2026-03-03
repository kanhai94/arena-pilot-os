import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter = null;

const hasEmailConfig = Boolean(env.EMAIL_USER && env.EMAIL_PASS && env.EMAIL_FROM);

const getTransporter = () => {
  if (!hasEmailConfig) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      requireTLS: !env.EMAIL_SECURE,
      family: 4,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS.replace(/\s+/g, '')
      }
    });
  }

  return transporter;
};

export const sendOtpEmail = async ({ to, otpCode, purpose, expiryMinutes }) => {
  const mailer = getTransporter();

  if (!mailer) {
    logger.warn({ to, purpose }, 'Email config missing; OTP email not sent');
    return { sent: false };
  }

  const subject =
    purpose === 'forgotPassword'
      ? 'Reset your Sports Academy account password'
      : 'Verify your Sports Academy account';

  const actionText =
    purpose === 'forgotPassword'
      ? 'Use this OTP to reset your password'
      : 'Use this OTP to complete your account registration';

  await mailer.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text: `${actionText}: ${otpCode}. This OTP will expire in ${expiryMinutes} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin-bottom: 8px;">Sports Academy Management SaaS</h2>
        <p style="margin: 0 0 16px;">${actionText}</p>
        <div style="font-size: 28px; letter-spacing: 8px; font-weight: 700; margin: 12px 0 16px;">${otpCode}</div>
        <p style="margin: 0;">This OTP is valid for ${expiryMinutes} minutes.</p>
        <p style="margin-top: 16px; font-size: 12px; color: #475569;">If you did not request this, please ignore this email.</p>
      </div>
    `
  });

  return { sent: true };
};
