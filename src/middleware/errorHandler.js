const { logger } = require('../config/database');

class ErrorHandler {
  /**
   * Global error handling middleware
   */
  handleError(err, req, res, next) {
    logger.error('Global error handler:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
    
    // MongoDB errors
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable',
        message: 'Unable to connect to database'
      });
    }
    
    // Validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: err.message
      });
    }
    
    // API errors
    if (err.response && err.response.status) {
      return res.status(err.response.status).json({
        success: false,
        error: 'External API error',
        message: err.response.data?.message || 'WhatsApp API error'
      });
    }
    
    // Default error
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  }
  
  /**
   * 404 Not Found handler
   */
  notFound(req, res) {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: `Cannot ${req.method} ${req.path}`
    });
  }
  
  /**
   * Async route handler wrapper
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

module.exports = new ErrorHandler();