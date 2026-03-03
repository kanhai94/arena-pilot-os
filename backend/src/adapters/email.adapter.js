/* global fetch, AbortController, setTimeout, clearTimeout */
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter = null;

const hasEmailConfig = Boolean(env.EMAIL_USER && env.EMAIL_PASS && env.EMAIL_FROM);
const hasBrevoApiConfig = Boolean(env.BREVO_API_KEY && env.EMAIL_FROM);

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

const sendViaBrevoApi = async ({ to, subject, actionText, otpCode, expiryMinutes }) => {
  if (!hasBrevoApiConfig) {
    return { sent: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(env.BREVO_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: env.EMAIL_FROM_NAME,
          email: env.EMAIL_FROM
        },
        to: [{ email: to }],
        subject,
        textContent: `${actionText}: ${otpCode}. This OTP will expire in ${expiryMinutes} minutes.`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
            <h2 style="margin-bottom: 8px;">Sports Academy Management SaaS</h2>
            <p style="margin: 0 0 16px;">${actionText}</p>
            <div style="font-size: 28px; letter-spacing: 8px; font-weight: 700; margin: 12px 0 16px;">${otpCode}</div>
            <p style="margin: 0;">This OTP is valid for ${expiryMinutes} minutes.</p>
            <p style="margin-top: 16px; font-size: 12px; color: #475569;">If you did not request this, please ignore this email.</p>
          </div>
        `
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        { statusCode: response.status, body, to },
        'Brevo API email delivery failed'
      );
      return { sent: false };
    }

    return { sent: true };
  } finally {
    clearTimeout(timeout);
  }
};

export const sendOtpEmail = async ({ to, otpCode, purpose, expiryMinutes }) => {
  const mailer = getTransporter();

  const subject =
    purpose === 'forgotPassword'
      ? env.OTP_SUBJECT_FORGOT
      : env.OTP_SUBJECT_SIGNUP;

  const actionText =
    purpose === 'forgotPassword'
      ? 'Use this OTP to reset your password'
      : 'Use this OTP to complete your account registration';

  if (mailer) {
    try {
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
    } catch (smtpError) {
      logger.error({ err: smtpError, to, purpose }, 'SMTP email delivery failed; attempting Brevo API fallback');
    }
  }

  const fallbackResult = await sendViaBrevoApi({ to, subject, actionText, otpCode, expiryMinutes });
  if (fallbackResult.sent) {
    return fallbackResult;
  }

  logger.warn({ to, purpose }, 'Email delivery failed for both SMTP and Brevo API');
  return { sent: false };
};
