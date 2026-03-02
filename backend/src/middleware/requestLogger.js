import crypto from 'node:crypto';
import { createScopedLogger, requestWinstonLogger } from '../config/logger.js';

export const requestLogger = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const start = process.hrtime.bigint();

  req.id = requestId;
  req.log = createScopedLogger({ requestId, path: req.originalUrl, method: req.method });
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    requestWinstonLogger.http('request_completed', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null
    });
  });

  next();
};
