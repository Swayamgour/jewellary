const ApiError = require('../utils/apiError');
const env = require('../config/env');

// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Mongoose Bad ObjectId / CastError
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = ApiError.badRequest(message, 'INVALID_ID');
  }

  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = `Duplicate value entered for ${field}: ${err.keyValue[field]}`;
    error = ApiError.conflict(message, 'DUPLICATE_KEY');
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((val) => ({
      field: val.path,
      message: val.message
    }));
    error = ApiError.unprocessableEntity('Database validation failed', 'MONGO_VALIDATION_ERROR', details);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid authentication token', 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Authentication token expired', 'TOKEN_EXPIRED');
  }

  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    message: error.message || 'Internal server error',
    error: {
      code: error.code || 'INTERNAL_ERROR',
      details: error.details || []
    }
  };

  if (env.NODE_ENV === 'development' && !(error instanceof ApiError)) {
    response.stack = err.stack;
  }

  if (statusCode >= 500) {
    console.error(`[Server Error] ${err.message}`, err.stack);
  }

  return res.status(statusCode).json(response);
};

module.exports = errorHandler;
