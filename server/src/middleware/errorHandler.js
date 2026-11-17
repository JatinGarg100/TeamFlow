/**
 * Central Error-Handling Middleware
 * ----------------------------------
 * Intercepts any unhandled or forwarded errors across the Express pipeline.
 * Formats standard error responses without exposing internal secrets or database connection strings.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'Internal Server Error';

  // Multer File Upload Errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size limit exceeded. Maximum allowed size is 5 MB.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded. Maximum 5 files per request.';
    } else {
      message = `Upload error: ${err.message}`;
    }
  }

  // Express-Validator Bad Request (if passed to next with err.errors)
  if (err.array && typeof err.array === 'function') {
    statusCode = 400;
    message = err.array()[0]?.msg || 'Validation failed';
  }

  // Mongoose Validation Error (e.g. required field missing)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = `Validation Failed: ${errors.join(', ')}`;
  }

  // Mongoose Duplicate Key Error (e.g. unique email or org slug)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicateField = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${duplicateField} already exists.`;
  }

  // Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID format for parameter: ${err.path}`;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please sign in again.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired. Please sign in again.';
  }

  // Log error details for server maintainers (sanitized: only method, url, status, and message)
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.originalUrl} - ${statusCode} - ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      // Only include stack trace in non-production environments
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};

module.exports = errorHandler;
