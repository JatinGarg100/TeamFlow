/**
 * Not Found (404) Middleware
 * --------------------------
 * Catches any incoming HTTP request that does not match an existing route
 * and returns a clear, consistent JSON error response.
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      statusCode: 404,
    },
  });
};

module.exports = notFoundHandler;
