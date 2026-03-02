export class AppError extends Error {
  constructor(message, statusCode = 500, details = null, options = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.errorCode = options.errorCode || null;
    this.upgradeRequired = options.upgradeRequired === true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
