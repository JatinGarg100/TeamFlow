const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Authentication Middleware
 * -------------------------
 * Verifies JWT token from either:
 * 1. HttpOnly cookie ('token')
 * 2. Authorization header ('Bearer <token>')
 *
 * Attaches the authenticated user document to req.user (excluding passwordHash).
 */
const requireAuth = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check cookies first (preferred for browser security)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Check Authorization Bearer header (supports API clients / fetch headers)
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required. Please sign in to continue.',
          statusCode: 401,
        },
      });
    }

    // Verify token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Server security configuration error: JWT_SECRET is missing.',
          statusCode: 500,
        },
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired session token. Please sign in again.',
          statusCode: 401,
        },
      });
    }

    // Retrieve user from database
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'The user account for this session no longer exists.',
          statusCode: 401,
        },
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireAuth,
};
