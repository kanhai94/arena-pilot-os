import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const baseOptions = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  // In local development, rate limiting blocks normal UI/API iteration.
  // Keep strict limiting enabled for staging/production.
  skip: (req) => env.NODE_ENV === 'development' || req.path === '/health' || req.path === '/healthz'
};

export const apiRateLimiter = rateLimit({
  ...baseOptions,
  max: env.RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

export const authRateLimiter = rateLimit({
  ...baseOptions,
  max: env.RATE_LIMIT_AUTH_MAX,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  }
});
