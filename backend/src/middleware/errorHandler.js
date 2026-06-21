import config from '../config/index.js';

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      message: err.isOperational ? err.message : 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
    },
  };

  if (config.env === 'development') {
    response.error.stack = err.stack;
    console.error(err);
  }

  res.status(statusCode).json(response);
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
