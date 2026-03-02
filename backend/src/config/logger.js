import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import { env } from './env.js';

const logDir = path.resolve(process.cwd(), env.LOG_DIR);
if (env.NODE_ENV === 'production' || env.NODE_ENV === 'staging') {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaText}`;
  })
);

const baseTransports = [
  new winston.transports.Console({
    level: env.LOG_LEVEL,
    format: env.NODE_ENV === 'development' ? consoleFormat : logFormat
  })
];

if (env.NODE_ENV === 'production' || env.NODE_ENV === 'staging') {
  baseTransports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: logFormat
    })
  );
}

const baseLogger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports: baseTransports
});

const normalizeLogArgs = (args) => {
  if (args.length === 0) {
    return { message: '', meta: {} };
  }

  const [first, second, third] = args;

  if (first instanceof Error) {
    return {
      message: second || first.message,
      meta: { err: first, ...(typeof third === 'object' && third ? third : {}) }
    };
  }

  if (typeof first === 'object' && first !== null) {
    if (typeof second === 'string') {
      return { message: second, meta: first };
    }
    return { message: 'log', meta: first };
  }

  if (typeof first === 'string') {
    return {
      message: first,
      meta: typeof second === 'object' && second !== null ? second : {}
    };
  }

  return { message: String(first), meta: {} };
};

export const createScopedLogger = (scope = {}) => {
  const write = (level, ...args) => {
    const { message, meta } = normalizeLogArgs(args);
    baseLogger.log(level, message, { ...scope, ...meta });
  };

  return {
    debug: (...args) => write('debug', ...args),
    info: (...args) => write('info', ...args),
    warn: (...args) => write('warn', ...args),
    error: (...args) => write('error', ...args),
    fatal: (...args) => write('error', ...args),
    child: (childScope) => createScopedLogger({ ...scope, ...childScope })
  };
};

export const logger = createScopedLogger();

const requestTransports = [new winston.transports.Console({ format: logFormat })];
if (env.NODE_ENV === 'production' || env.NODE_ENV === 'staging') {
  requestTransports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'requests.log'),
      format: logFormat
    })
  );
}

export const requestWinstonLogger = winston.createLogger({
  level: 'http',
  format: logFormat,
  transports: requestTransports
});
