'use strict';
const jwt = require('jsonwebtoken');

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
};

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Sign a JWT for a user session.
 * @param {object} payload - { id, role, email }
 * @param {string} [expiresIn] - Override expiry (e.g. '15m' for reset token)
 */
function signToken(payload, expiresIn = EXPIRES_IN) {
  return jwt.sign(payload, SECRET(), { expiresIn });
}

/**
 * Verify a JWT and return its decoded payload.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 */
function verifyToken(token) {
  return jwt.verify(token, SECRET());
}

/**
 * Compute safe cookie options based on environment and proxy setup.
 */
function getCookieOptions(maxAge) {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = (process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax')).toLowerCase();
  const secure = isProd || sameSite === 'none';
  const domain = (process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN !== 'localhost')
    ? process.env.COOKIE_DOMAIN
    : undefined;

  const opts = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  };
  if (maxAge !== undefined) opts.maxAge = maxAge;
  if (domain) opts.domain = domain;
  return opts;
}

/**
 * Set the JWT as an HttpOnly cookie on the response.
 */
function setCookieToken(res, token, expiresIn = EXPIRES_IN) {
  const maxAge = parseExpiryToMs(expiresIn);
  res.cookie('token', token, getCookieOptions(maxAge));
}

/**
 * Clear the authentication cookie.
 */
function clearCookieToken(res) {
  res.clearCookie('token', getCookieOptions());
}

/**
 * Parse duration strings like '7d', '15m', '1h' into milliseconds.
 */
function parseExpiryToMs(expiresIn) {
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = String(expiresIn).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 86400000; // default 7 days
  return parseInt(match[1]) * (units[match[2]] || 86400000);
}

module.exports = { signToken, verifyToken, setCookieToken, clearCookieToken };
