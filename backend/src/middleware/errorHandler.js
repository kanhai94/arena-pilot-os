import { StatusCodes } from 'http-status-codes';

const mapKnownError = (err) => {
  if (err.name === 'CastError') {
    return { statusCode: StatusCodes.BAD_REQUEST, message: `Invalid ${err.path}` };
  }

  if (err.name === 'ValidationError') {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Validation failed',
      details: Object.values(err.errors || {}).map((item) => ({ path: item.path, message: item.message }))
    };
  }

  if (err.code === 11000) {
    return {
      statusCode: StatusCodes.CONFLICT,
      message: 'Duplicate key violation',
      details: err.keyValue || null
    };
  }

  return null;
};

export const notFoundHandler = (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.id || null
  });
};

export const errorHandler = (err, req, res, next) => {
  const known = mapKnownError(err);

  const statusCode = known?.statusCode || err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const message = known?.message || err.message || 'Internal Server Error';
  const details = known?.details || err.details || null;

  req.log?.error({ err, statusCode }, 'Unhandled error');

  res.status(statusCode).json({
    success: false,
    message,
    requestId: req.id || null,
    ...(details ? { details } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
};
