const Joi = require('joi');
const fs = require('fs');

// Validation schema for image files
const imageFileSchema = Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string().required(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/jpg').required(),
    destination: Joi.string().required(),
    filename: Joi.string().required(),
    path: Joi.string().required(),
    size: Joi.number().max(10 * 1024 * 1024).required() // 10MB max
});

/**
 * Middleware to validate uploaded image files
 */
const validateImageFile = (req, res, next) => {
    try {
        // Check if file exists
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                code: 'MISSING_FILE'
            });
        }

        // Validate file structure
        const { error } = imageFileSchema.validate(req.file);
        if (error) {
            // Clean up uploaded file if validation fails
            if (req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(400).json({
                error: 'Invalid file format or size',
                details: error.details.map(detail => detail.message),
                code: 'INVALID_FILE'
            });
        }

        // Additional file validation
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            // Clean up uploaded file
            if (req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(400).json({
                error: 'Invalid file type. Only JPEG and PNG images are allowed',
                code: 'INVALID_FILE_TYPE'
            });
        }

        // Check file size
        const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
        if (req.file.size > maxSize) {
            // Clean up uploaded file
            if (req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(400).json({
                error: `File too large. Maximum size allowed is ${Math.round(maxSize / (1024 * 1024))}MB`,
                code: 'FILE_TOO_LARGE'
            });
        }

        // Check if file actually exists on disk
        if (!fs.existsSync(req.file.path)) {
            return res.status(500).json({
                error: 'File upload failed',
                code: 'UPLOAD_FAILED'
            });
        }

        next();
    } catch (error) {
        // Clean up uploaded file if error occurs
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        console.error('File validation error:', error);
        res.status(500).json({
            error: 'File validation failed',
            message: error.message,
            code: 'VALIDATION_ERROR'
        });
    }
};

/**
 * Validation schema for query parameters
 */
const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
});

/**
 * Middleware to validate pagination parameters
 */
const validatePagination = (req, res, next) => {
    const { error, value } = paginationSchema.validate(req.query);
    
    if (error) {
        return res.status(400).json({
            error: 'Invalid pagination parameters',
            details: error.details.map(detail => detail.message),
            code: 'INVALID_PAGINATION'
        });
    }
    
    req.query = { ...req.query, ...value };
    next();
};

/**
 * Validation schema for UUID parameters
 */
const uuidSchema = Joi.string().uuid().required();

/**
 * Middleware to validate UUID parameters
 */
const validateUUID = (paramName) => {
    return (req, res, next) => {
        const { error } = uuidSchema.validate(req.params[paramName]);
        
        if (error) {
            return res.status(400).json({
                error: `Invalid ${paramName} format`,
                details: error.details.map(detail => detail.message),
                code: 'INVALID_UUID'
            });
        }
        
        next();
    };
};

module.exports = {
    validateImageFile,
    validatePagination,
    validateUUID
}; 