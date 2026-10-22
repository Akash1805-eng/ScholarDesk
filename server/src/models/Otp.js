'use strict';
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    // Normalized recipient email
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // 'registration' | 'password_reset'
    purpose: {
      type: String,
      enum: ['registration', 'password_reset'],
      required: true,
    },
    // Secure hash of the OTP (never store plain text)
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    // Server-authoritative expiry
    expiresAt: {
      type: Date,
      required: true,
    },
    // Count of failed verification attempts
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    // True after a successful verification
    used: {
      type: Boolean,
      default: false,
    },
    // Timestamp when the OTP was dispatched to the email provider
    dispatchedAt: {
      type: Date,
      default: null,
    },
    // Resend tracking
    lastResentAt: {
      type: Date,
      default: null,
    },
    resendCount: {
      type: Number,
      default: 0,
    },
    // Optional: additional context stored at creation time
    // (e.g. registerNumber for registration challenge)
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: one active OTP per email+purpose
otpSchema.index({ email: 1, purpose: 1 });

// TTL index: MongoDB removes documents after expiresAt + buffer
// NOTE: expiry enforcement happens in code against server time;
// TTL is cleanup only and may be delayed up to 60 s.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 300 }); // cleanup 5 min after expiry

module.exports = mongoose.model('Otp', otpSchema);
