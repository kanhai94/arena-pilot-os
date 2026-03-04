import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid url').default('redis://redis:6379'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_DIR: z.string().default('logs'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  REQUEST_BODY_LIMIT: z.string().default('1mb'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(40),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  EMAIL_USER: z.string().email().optional(),
  EMAIL_PASS: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_HOST: z.string().default('smtp.gmail.com'),
  EMAIL_PORT: z.coerce.number().int().positive().default(587),
  EMAIL_SECURE: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('false'),
  EMAIL_FROM_NAME: z.string().default('ArenaPilot OS'),
  BREVO_API_KEY: z.string().optional(),
  BREVO_API_URL: z.string().url().default('https://api.brevo.com/v3/smtp/email'),
  OTP_SUBJECT_SIGNUP: z.string().default('Verify your Sports Academy account'),
  OTP_SUBJECT_FORGOT: z.string().default('Reset your Sports Academy account password'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(10).optional(),
  SUPER_ADMIN_NAME: z.string().default('Super Admin'),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
  ACADEMY_CODE_PREFIX: z.string().regex(/^[A-Za-z0-9]+$/, 'ACADEMY_CODE_PREFIX must be alphanumeric').default('kan'),
  ACADEMY_CODE_SEPARATOR: z.string().regex(/^[-_]*$/, 'ACADEMY_CODE_SEPARATOR must be "-" or "_" or empty').default('-'),
  ACADEMY_CODE_PAD: z.coerce.number().int().min(2).max(8).default(2)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
