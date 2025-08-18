const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  console.error('🚨 Error:', {
    message: err.message,
    stack: err.stack,
    route: req.originalUrl,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = errorHandler;
