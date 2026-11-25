/**
 * rateLimiter.js
 * ──────────────
 * In-memory sliding window rate limiter middleware.
 * Mitigates brute-force attacks and credential stuffing on authentication endpoints.
 * Zero external dependencies, self-cleans stale IP records.
 */
const createRateLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 20, // 20 attempts per window
  message = 'Too many requests from this IP address. Please try again later.',
} = {}) => {
  const ipRequests = new Map();

  // Periodic garbage collection every 5 minutes to prevent unbounded memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipRequests.entries()) {
      if (now - record.resetTime > windowMs) {
        ipRequests.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    // Skip rate limiting during automated test suite execution if requested
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']) {
      return next();
    }

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      req.ip ||
      'unknown-ip';

    const now = Date.now();
    let record = ipRequests.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      ipRequests.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        success: false,
        error: {
          message,
          statusCode: 429,
          retryAfterSeconds: resetSeconds,
        },
      });
    }

    next();
  };
};

// Preset auth rate limiter: 30 attempts per 15 minutes
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
};
