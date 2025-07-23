const fs = require('fs');

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
    constructor(message, statusCode, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    let { statusCode = 500, message, code } = err;

    console.error('Error Handler:', {
        message: err.message,
        stack: err.stack,
        statusCode,
        code: err.code,
        url: req.url,
        method: req.method
    });

    // Handle Firebase/Firestore errors
    if (err.code === 7) { // PERMISSION_DENIED
        statusCode = 403;
        message = 'Permission denied. Check Firebase configuration.';
        code = 'FIREBASE_PERMISSION_DENIED';
    }

    // Handle file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        message = 'File too large';
        code = 'FILE_TOO_LARGE';
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        statusCode = 400;
        message = 'Unexpected file field';
        code = 'UNEXPECTED_FILE';
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
        code = 'VALIDATION_ERROR';
    }

    // Handle multer errors
    if (err.code === 'MULTER_ERROR') {
        statusCode = 400;
        message = 'File upload error';
        code = 'FILE_UPLOAD_ERROR';
    }

    // Operational errors - send message to client
    if (err.isOperational) {
        res.status(statusCode).json({
            error: message,
            code: code || 'OPERATIONAL_ERROR'
        });
    } else {
        // Programming errors - don't leak error details
        console.error('Programming Error:', err);
        res.status(500).json({
            error: 'Something went wrong',
            code: 'INTERNAL_SERVER_ERROR'
        });
    }
};

/**
 * Handle async errors in route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (err, promise) => {
    console.error('Unhandled Promise Rejection:', err);
    // Close server & exit process
    process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Close server & exit process
    process.exit(1);
});

module.exports = {
    AppError,
    errorHandler
}; 