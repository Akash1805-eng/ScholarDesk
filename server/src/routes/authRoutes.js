'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { authLimiter, otpLimiter } = require('../middleware/rateLimitMiddleware');
const { authenticate } = require('../middleware/authMiddleware');

// ── Registration flow ────────────────────────────────────────────────────────
// POST /api/auth/register/request-otp & alias /register
router.post('/register/request-otp', authLimiter, auth.register);
router.post('/register', authLimiter, auth.register);

// POST /api/auth/register/verify-otp & alias /verify-otp
router.post('/register/verify-otp', authLimiter, auth.verifyRegistrationOtp);
router.post('/verify-otp', authLimiter, auth.verifyRegistrationOtp);

// ── Password reset flow ──────────────────────────────────────────────────────
// POST /api/auth/forgot-password/request-otp & alias /forgot-password
router.post('/forgot-password/request-otp', authLimiter, auth.forgotPassword);
router.post('/forgot-password', authLimiter, auth.forgotPassword);

// POST /api/auth/forgot-password/verify-otp & alias /verify-reset-otp
router.post('/forgot-password/verify-otp', authLimiter, auth.verifyResetOtp);
router.post('/verify-reset-otp', authLimiter, auth.verifyResetOtp);

router.post('/reset-password', authLimiter, auth.resetPassword);

// ── Common OTP actions ───────────────────────────────────────────────────────
router.post('/resend-otp', otpLimiter, auth.resendOtp);

// ── Session management ───────────────────────────────────────────────────────
router.post('/login', authLimiter, auth.login);
router.post('/logout', authenticate, auth.logout);
router.get('/me', authenticate, auth.me);

module.exports = router;
