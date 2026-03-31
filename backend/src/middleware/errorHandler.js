import { logError } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  logError(err.message, {
    stack: err.stack,
    requestId: req.requestId,
    path: req.originalUrl,
    method: req.method
  });
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
    requestId: req.requestId
  });
}
