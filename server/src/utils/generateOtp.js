'use strict';
const crypto = require('crypto');

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Returns the plain code and its SHA-256 HMAC digest.
 */
function generateOtp() {
  // Generate a random number in [100000, 999999]
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0);
  const otp = String(100000 + (num % 900000));
  return otp;
}

/**
 * Hash an OTP using HMAC-SHA256 with the JWT secret as the key.
 * Using a keyed hash prevents rainbow-table attacks even if the DB is leaked.
 */
function hashOtp(otp) {
  const secret = process.env.JWT_SECRET || 'fallback-secret-change-this';
  return crypto.createHmac('sha256', secret).update(otp).digest('hex');
}

/**
 * Securely compare a plain OTP with a stored hash using constant-time comparison.
 */
function verifyOtpHash(plainOtp, storedHash) {
  const computedHash = hashOtp(plainOtp);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

module.exports = { generateOtp, hashOtp, verifyOtpHash };
