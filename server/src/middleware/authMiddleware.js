'use strict';
const { verifyToken } = require('../utils/generateToken');
const User = require('../models/User');

/**
 * Authenticate a request using the HttpOnly JWT cookie.
 * Attaches req.user = { id, role, email } on success.
 */
async function authenticate(req, res, next) {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.',
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Session expired or invalid. Please log in again.',
      });
    }

    // Check if the token was issued before a password change (session revocation)
    if (decoded.iat) {
      const user = await User.findById(decoded.id).select('passwordChangedAt isActive role email verificationStatus');
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is not active.',
        });
      }

      if (user.passwordChangedAt) {
        const changedAtMs = user.passwordChangedAt.getTime();
        const tokenIssuedMs = decoded.iat * 1000;
        if (tokenIssuedMs < changedAtMs) {
          return res.status(401).json({
            success: false,
            code: 'SESSION_REVOKED',
            message: 'Session was revoked. Please log in again.',
          });
        }
      }

      req.user = {
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        verificationStatus: user.verificationStatus,
      };
    } else {
      req.user = {
        id: decoded.id,
        role: decoded.role,
        email: decoded.email,
      };
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Ensure the authenticated user is a student.
 * Student accounts are active immediately after OTP verification.
 */
function requireApprovedStudent(req, res, next) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Students only.' });
  }
  next();
}

module.exports = { authenticate, requireApprovedStudent };
