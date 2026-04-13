function errorHandler(err, req, res, next) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message || 'Unknown error');
    
    if (err.stack && process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }
    
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';
    
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

module.exports = errorHandler;
