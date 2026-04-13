import cors from 'cors'; 
import express from 'express';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './config/env.js';
import { runtimeConfig } from './config/runtime.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { studentRouter } from './modules/students/student.routes.js';
import { batchRouter } from './modules/batches/batch.routes.js';
import { classRouter } from './modules/classes/class.routes.js';
import { subjectRouter } from './modules/subjects/subject.routes.js';
import { attendanceRouter } from './modules/attendance/attendance.routes.js';
import { feeRouter } from './modules/fees/fee.routes.js';
import { notificationRouter } from './modules/notifications/notification.routes.js';
import { automationRouter } from './modules/automations/automation.routes.js';
import { integrationRouter } from './modules/integrations/integration.routes.js';
import { teamRouter } from './modules/team/team.routes.js';
import { teacherRouter } from './modules/teachers/teacher.routes.js';
import { subscriptionRouter } from './modules/subscription/subscription.routes.js';
import { tenantRouter } from './modules/tenant/tenant.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { platformRouter } from './modules/platform/platform.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
//kanhai kumar

const allowedOrigins = env.CORS_ORIGIN.split(',').map((item) => item.trim());
const corsOptions = {
   origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error('CORS origin not allowed');
    error.statusCode = 403;
    return callback(error);
  },
  credentials: runtimeConfig.cors.allowCredentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
};

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);

  app.use(requestLogger);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: runtimeConfig.security.enableHsts
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
          }
        : false,
      referrerPolicy: { policy: 'no-referrer' }
    })
  );
  app.disable('x-powered-by');
  app.use(cors(corsOptions));
  app.use(mongoSanitize({ replaceWith: '_' }));
  app.use(
    express.json({
      limit: env.REQUEST_BODY_LIMIT,
      verify: (req, _res, buf) => {
        if (buf && buf.length > 0) {
          req.rawBody = buf.toString('utf8');
        }
      }
    })
  );
  app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));

  app.use('/api/v1', apiRateLimiter);
  app.use('/api/v1/auth', authRateLimiter);

  app.use('/health', healthRouter);
  app.use('/api/v1/health', healthRouter);
  app.use('/platform', platformRouter);
  app.use('/api/v1/platform', platformRouter);
  app.get('/healthz', (req, res) => res.status(200).json({ success: true, data: { status: 'ok' } }));

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/billing', billingRouter);
  app.use('/api/v1/subscription', subscriptionRouter);
  app.use('/api/v1/tenant', tenantRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/students', studentRouter);
  app.use('/api/v1/batches', batchRouter);
  app.use('/api/v1/classes', classRouter);
  app.use('/api/v1/subjects', subjectRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/fees', feeRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/automations', automationRouter);
  app.use('/api/v1/integrations', integrationRouter);
  app.use('/api/v1/team-members', teamRouter);
  app.use('/api/v1/teachers', teacherRouter);
  app.use('/api/v1/dashboard', dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
