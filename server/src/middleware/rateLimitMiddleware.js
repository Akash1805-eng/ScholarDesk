'use strict';
const rateLimit = require('express-rate-limit');

const windowMs15min = 15 * 60 * 1000;
const windowMs1min  = 60 * 1000;

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: windowMs15min,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: windowMs15min,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many authentication attempts. Please wait 15 minutes.' },
  skipSuccessfulRequests: false,
});

// OTP-specific limiter (tighter window)
const otpLimiter = rateLimit({
  windowMs: windowMs1min,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many OTP requests. Please wait 1 minute.' },
});

// Admin import limiter
const importLimiter = rateLimit({
  windowMs: windowMs15min,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many import requests. Please wait before retrying.' },
});

module.exports = { generalLimiter, authLimiter, otpLimiter, importLimiter };
