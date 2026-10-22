'use strict';
/**
 * Email service using the SendGrid Node.js SDK (@sendgrid/mail).
 *
 * Environment variables:
 *   SENDGRID_API_KEY            — SendGrid API key (required for active delivery)
 *   EMAIL_FROM                  — Verified sender address (e.g. "Scholarship Desk <ivaanakash9865@gmail.com>")
 *   OTP_EXPIRY_SECONDS          — OTP expiry in seconds (default: 30)
 *   NODE_ENV                    — 'production' | 'development' | 'test'
 *
 * Behaviour:
 *   - Strictly validates configuration before sending:
 *     Missing API key -> 503 EMAIL_NOT_CONFIGURED
 *     Missing or invalid sender address -> 503 EMAIL_NOT_CONFIGURED / EMAIL_INVALID_SENDER
 *   - Returns { accepted: true, messageId } ONLY when SendGrid SDK accepts the message (HTTP 202).
 *   - Never fakes success when SendGrid fails.
 *   - Redacts SENDGRID_API_KEY from server logs.
 *   - In development mode (NODE_ENV=development), provides a safe console preview of outgoing OTPs
 *     while in production real OTPs are never logged.
 */

const sgMail = require('@sendgrid/mail');

const OTP_EXPIRY_SECONDS = parseInt(process.env.OTP_EXPIRY_SECONDS || '30', 10);

/**
 * Clean surrounding quotes if present in environment variable.
 */
function cleanEnvString(val) {
  if (!val) return '';
  let str = val.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

/**
 * Validate email service configuration.
 * Throws a descriptive error with HTTP 503 status code if missing or invalid.
 */
function validateConfig(options = {}) {
  const isTest = process.env.NODE_ENV === 'test';
  if (isTest && !options.force) {
    return;
  }

  const apiKey = cleanEnvString(process.env.SENDGRID_API_KEY);
  const from = cleanEnvString(process.env.EMAIL_FROM);

  if (!apiKey || apiKey === 'your_sendgrid_api_key') {
    const err = new Error('Email service is not configured. SENDGRID_API_KEY is missing.');
    err.statusCode = 503;
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  if (!from) {
    const err = new Error('Email service is not configured. EMAIL_FROM sender address is missing.');
    err.statusCode = 503;
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  // Sender format validation: support "Name <email@domain.com>" or "email@domain.com"
  const match = from.match(/<([^>]+)>/) || [null, from];
  const emailOnly = (match[1] || '').trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailOnly)) {
    const err = new Error('Email service is misconfigured. EMAIL_FROM sender address is invalid.');
    err.statusCode = 503;
    err.code = 'EMAIL_INVALID_SENDER';
    throw err;
  }
}

/**
 * Get formatted sender address for SendGrid.
 */
function getSender() {
  const from = cleanEnvString(process.env.EMAIL_FROM);
  if (from) return from;
  return 'Scholarship Desk <ivaanakash9865@gmail.com>';
}

/**
 * Sanitize error message to ensure API key is never leaked in logs.
 */
function sanitizeMessage(msg) {
  const apiKey = cleanEnvString(process.env.SENDGRID_API_KEY);
  if (!msg) return 'Unknown email service error';
  let str = typeof msg === 'string' ? msg : JSON.stringify(msg);
  if (apiKey) {
    str = str.split(apiKey).join('***REDACTED***');
  }
  return str;
}

/**
 * Send an email using SendGrid Mail SDK.
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text]
 * @returns {Promise<{accepted: boolean, messageId?: string, error?: string, rawError?: string}>}
 */
async function sendEmail({ to, subject, html, text }) {
  const isTest = process.env.NODE_ENV === 'test' || process.env.EMAIL_TEST_MODE === 'true';
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Validate configuration before attempting to send
  validateConfig();

  const apiKey = cleanEnvString(process.env.SENDGRID_API_KEY);
  const from = getSender();

  // Test mode without real network request
  if (isTest) {
    console.log(`[email:TEST-MODE] To: ${to} | Subject: ${subject}`);
    return { accepted: true, messageId: `sg-test-${Date.now()}` };
  }

  try {
    sgMail.setApiKey(apiKey);

    const msg = {
      to,
      from,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    };

    const [response] = await sgMail.send(msg);

    // SendGrid returns HTTP 202 on success
    if (response && response.statusCode >= 200 && response.statusCode < 300) {
      const messageId = response.headers?.['x-message-id'] || `sg-${Date.now()}`;
      if (!isProd) {
        console.log(`[email:SENT] Successfully accepted by SendGrid for ${to} (Status: ${response.statusCode}, Message ID: ${messageId})`);
      }
      return { accepted: true, messageId };
    }

    const unexpectedMsg = `SendGrid responded with unexpected status code: ${response?.statusCode}`;
    console.error(`[email:ERROR] ${unexpectedMsg}`);
    return {
      accepted: false,
      error: isProd ? 'OTP could not be sent. Please try again later.' : unexpectedMsg,
      rawError: unexpectedMsg,
    };
  } catch (err) {
    let errorDetail = err.message;
    if (err.response?.body?.errors && Array.isArray(err.response.body.errors)) {
      errorDetail = err.response.body.errors.map(e => e.message).join('; ');
    }

    const safeError = sanitizeMessage(errorDetail || err.message);
    console.error(`[email:ERROR] SendGrid delivery failure to ${to}: ${safeError}`);

    const userMessage = isProd
      ? 'OTP could not be sent. Please try again later.'
      : `OTP could not be sent: ${safeError}`;

    return { accepted: false, error: userMessage, rawError: safeError };
  }
}

/**
 * Send OTP verification email.
 */
async function sendOtpEmail({ to, otp, purpose, expirySeconds = OTP_EXPIRY_SECONDS }) {
  const isProd = process.env.NODE_ENV === 'production';
  const purposeLabel = purpose === 'registration' ? 'Registration' : 'Password Reset';
  const subject = `Scholarship Desk – ${purposeLabel} OTP`;

  // Development-only safe preview for local debugging (do not log in production)
  if (!isProd) {
    console.log(`[email:DEV-PREVIEW] Recipient: ${to} | Purpose: ${purposeLabel} | OTP: ${otp} | Expires in: ${expirySeconds}s`);
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #1e3a8a; margin-top: 0; font-size: 22px;">Scholarship Desk</h2>
      <p style="color: #374151; font-size: 15px; line-height: 1.5;">
        Your ${purposeLabel.toLowerCase()} verification code is:
      </p>
      <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #2563eb; background: #f0f7ff; border: 1px dashed #93c5fd; border-radius: 8px; text-align: center; padding: 18px 0; margin: 24px 0;">
        ${otp}
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
        This code expires in <strong>${expirySeconds} seconds</strong>. Do not share this code with anyone.<br/>
        If you did not request this verification, please disregard this email.
      </p>
    </div>`;

  const text = `Your Scholarship Desk ${purposeLabel} verification code is: ${otp}\nExpires in ${expirySeconds} seconds.`;

  return sendEmail({ to, subject, html, text });
}

/**
 * Send account status notification.
 */
async function sendAccountStatusEmail({ to, name, status, remarks }) {
  const subject = `Scholarship Desk – Account ${status === 'verified' ? 'Approved' : 'Update'}`;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: auto; padding: 24px;">
      <h2 style="color: #1e3a8a;">Scholarship Desk</h2>
      <p>Dear ${name},</p>
      <p>Your scholarship portal account has been <strong>${status === 'verified' ? 'approved' : status}</strong>.</p>
      ${remarks ? `<p>Remarks: ${remarks}</p>` : ''}
      <p>You may now <a href="${clientUrl}/login" style="color: #2563eb;">log in to the portal</a>.</p>
    </div>`;
  return sendEmail({ to, subject, html });
}

/**
 * Send document expiry reminder.
 */
async function sendExpiryReminderEmail({ to, name, documentType, expiryDate, daysLeft }) {
  const subject = `Scholarship Desk – Document Expiry Reminder (${daysLeft} day${daysLeft !== 1 ? 's' : ''})`;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-IN');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: auto; padding: 24px;">
      <h2 style="color: #1e3a8a;">Scholarship Desk</h2>
      <p>Dear ${name},</p>
      <p>Your <strong>${documentType}</strong> expires on <strong>${formattedDate}</strong> (${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining).</p>
      <p>Please <a href="${clientUrl}/student/documents" style="color: #2563eb;">upload a renewed copy</a> to avoid submission delays.</p>
    </div>`;
  return sendEmail({ to, subject, html });
}

/**
 * Send password changed notification.
 */
async function sendPasswordChangedEmail({ to, name }) {
  const subject = 'Scholarship Desk – Password Changed';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: auto; padding: 24px;">
      <h2 style="color: #1e3a8a;">Scholarship Desk</h2>
      <p>Dear ${name},</p>
      <p>Your Scholarship Desk password was successfully changed.</p>
      <p>If you did not make this change, please contact the scholarship administration office immediately.</p>
    </div>`;
  return sendEmail({ to, subject, html });
}

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendAccountStatusEmail,
  sendExpiryReminderEmail,
  sendPasswordChangedEmail,
  _internal: {
    validateConfig,
    getSender,
    sanitizeMessage,
    cleanEnvString,
  },
};
