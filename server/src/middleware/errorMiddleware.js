'use strict';

/**
 * Centralized error handler.
 * Always returns JSON. Strips internal details in production.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isProduction = process.env.NODE_ENV === 'production';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed.',
      errors,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_KEY',
      message: `A record with this ${field} already exists.`,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Session expired or invalid. Please log in again.',
    });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      code: 'FILE_TOO_LARGE',
      message: `File exceeds the ${process.env.UPLOAD_FILE_SIZE_LIMIT_MB || 10} MB limit.`,
    });
  }

  // Application-level errors (thrown with statusCode)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code || 'APP_ERROR',
      message: err.message,
    });
  }

  // Unexpected errors
  if (!isProduction) {
    console.error('[error]', err);
  } else {
    console.error('[error]', err.message);
  }

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: isProduction
      ? 'An unexpected error occurred.'
      : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

/**
 * Helper to create an application error with an HTTP status code.
 */
function createError(message, statusCode = 400, code = 'APP_ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

module.exports = { errorHandler, createError };
