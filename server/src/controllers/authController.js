'use strict';
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const StudentMaster = require('../models/StudentMaster');
const StudentProfile = require('../models/StudentProfile');
const Otp = require('../models/Otp');
const { generateOtp, hashOtp, verifyOtpHash } = require('../utils/generateOtp');
const { signToken, setCookieToken, clearCookieToken } = require('../utils/generateToken');
const { sendOtpEmail, sendAccountStatusEmail, sendPasswordChangedEmail } = require('../config/email');
const { createError } = require('../middleware/errorMiddleware');
const { createNotification } = require('../services/notificationService');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const OTP_EXPIRY_SECONDS = parseInt(process.env.OTP_EXPIRY_SECONDS || '30', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
const OTP_RESEND_COOLDOWN = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '30', 10);

// ── Helper: normalize email ────────────────────────────────────────────────────
function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

// ── Helper: validate college domain ───────────────────────────────────────────
function isCollegeDomain(email) {
  const domain = (process.env.COLLEGE_EMAIL_DOMAIN || 'eec.srmrmp.edu.in').toLowerCase().trim();
  return (email || '').toLowerCase().trim().endsWith('@' + domain);
}

// ── Helper: issue and send OTP ────────────────────────────────────────────────
async function issueOtp(email, purpose, context = null) {
  const plainOtp = generateOtp();
  const codeHash = hashOtp(plainOtp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

  // Invalidate any previous OTP for same email+purpose
  await Otp.deleteMany({ email, purpose });

  const otp = await Otp.create({
    email,
    purpose,
    codeHash,
    expiresAt,
    maxAttempts: OTP_MAX_ATTEMPTS,
    context,
    dispatchedAt: null,
    lastResentAt: new Date(),
  });

  // Send email — expiry starts when provider accepts it
  const result = await sendOtpEmail({ to: email, otp: plainOtp, purpose, expirySeconds: OTP_EXPIRY_SECONDS });
  if (!result.accepted) {
    await Otp.deleteOne({ _id: otp._id });
    const userMsg = result.error || 'OTP could not be sent. Please try again later.';
    throw createError(userMsg, 502, 'EMAIL_FAILED');
  }

  // Mark dispatch time only after provider accepts
  otp.dispatchedAt = new Date();
  await otp.save();

  return { expiresAt, messageId: result.messageId };
}

// ── Register: Step 1 — validate identity, send OTP ────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { registerNumber, collegeEmail, password, confirmPassword } = req.body;
    const domain = (process.env.COLLEGE_EMAIL_DOMAIN || 'eec.srmrmp.edu.in').toLowerCase().trim();
    const INVALID_FORMAT_MSG = `Use your college email in the format 310624104001@${domain}.`;

    // 1. Validate registerNumber: must be a 12-digit numeric string
    const regNumStr = typeof registerNumber === 'string' ? registerNumber.trim() : String(registerNumber || '').trim();
    if (!/^\d{12}$/.test(regNumStr)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_EMAIL_FORMAT',
        message: INVALID_FORMAT_MSG,
      });
    }

    // 2. Independently derive the expected email from the register number on the backend
    const expectedEmail = `${regNumStr}@${domain}`.toLowerCase();

    // 3. Reject any submitted email that differs from the derived email
    if (collegeEmail) {
      const submittedEmail = normalizeEmail(collegeEmail);
      if (submittedEmail !== expectedEmail) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_EMAIL_FORMAT',
          message: INVALID_FORMAT_MSG,
        });
      }
    }

    // 4. Validate passwords
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Passwords do not match.',
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Password must be at least 8 characters.',
      });
    }

    // 5. Require the register number and generated email to match the same approved Student Master record
    const master = await StudentMaster.findOne({
      registerNumber: regNumStr,
      studentStatus: 'active',
    });

    if (!master || master.collegeEmail.toLowerCase() !== expectedEmail) {
      return res.status(400).json({
        success: false,
        code: 'RECORD_NOT_FOUND',
        message: 'The register number and college email do not match our records.',
      });
    }

    // 6. Prevent duplicate accounts: check if record is already registered
    if (master.registrationStatus === 'registered') {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_REGISTERED',
        message: 'An account already exists for this register number. Please sign in or use password recovery.',
      });
    }

    // Also check User collection for existing account by email or studentMaster link
    const existingUser = await User.findOne({
      $or: [
        { email: expectedEmail },
        { studentMaster: master._id },
      ],
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_REGISTERED',
        message: 'An account already exists for this register number. Please sign in or use password recovery.',
      });
    }

    // 7. Send the registration OTP ONLY to the approved email stored in that record
    const approvedEmail = master.collegeEmail.toLowerCase();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { expiresAt } = await issueOtp(approvedEmail, 'registration', {
      registerNumber: master.registerNumber,
      masterId: master._id.toString(),
      passwordHash,
    });

    return res.status(200).json({
      success: true,
      message: 'A 6-digit verification code has been sent to your college email.',
      expiresAt,
      expirySeconds: OTP_EXPIRY_SECONDS,
      collegeEmail: approvedEmail,
    });
  } catch (err) {
    next(err);
  }
};

// ── Register: Step 2 — verify OTP, create account ─────────────────────────────
exports.verifyRegistrationOtp = async (req, res, next) => {
  try {
    const { collegeEmail, otp } = req.body;
    const email = normalizeEmail(collegeEmail);

    const challenge = await Otp.findOne({ email, purpose: 'registration' }).select('+codeHash');
    if (!challenge) {
      return res.status(400).json({
        success: false,
        code: 'OTP_NOT_FOUND',
        message: 'No active OTP found. Please restart registration.',
      });
    }

    // 1. Enforce 30-second expiry against server time
    if (new Date() > challenge.expiresAt) {
      await Otp.deleteOne({ _id: challenge._id });
      return res.status(400).json({
        success: false,
        code: 'OTP_EXPIRED',
        message: 'OTP expired. Request a new code.',
      });
    }

    // 2. Enforce single use
    if (challenge.used) {
      return res.status(400).json({ success: false, code: 'OTP_USED', message: 'This code has already been used.' });
    }

    // 3. Enforce attempt limits
    if (challenge.attempts >= challenge.maxAttempts) {
      return res.status(429).json({ success: false, code: 'OTP_MAX_ATTEMPTS', message: 'Too many failed attempts. Request a new code.' });
    }

    if (!verifyOtpHash(otp, challenge.codeHash)) {
      challenge.attempts += 1;
      await challenge.save();
      const remaining = challenge.maxAttempts - challenge.attempts;
      return res.status(400).json({
        success: false,
        code: 'OTP_INVALID',
        message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    // OTP valid — mark used atomically (single use)
    challenge.used = true;
    await challenge.save();

    const { masterId, passwordHash } = challenge.context || {};
    if (!masterId || !passwordHash) {
      return res.status(400).json({ success: false, code: 'CHALLENGE_INVALID', message: 'Invalid registration session. Please restart.' });
    }

    // Check master record again (race condition guard)
    const master = await StudentMaster.findById(masterId);
    if (!master || master.registrationStatus === 'registered') {
      return res.status(409).json({ success: false, code: 'ALREADY_REGISTERED', message: 'This record is already registered.' });
    }

    // Create User account with emailVerified: true, accountStatus: "active", verificationStatus: "not_required"
    const user = await User.create({
      email,
      passwordHash,
      role: 'student',
      emailVerified: true,
      accountStatus: 'active',
      verificationStatus: 'not_required',
      studentMaster: master._id,
    });

    master.registrationStatus = 'registered';
    master.registeredUser = user._id;
    await master.save();

    // Create empty profile
    await StudentProfile.create({ student: user._id });

    // Cleanup OTP
    await Otp.deleteOne({ _id: challenge._id });

    return res.status(201).json({
      success: true,
      message: 'Your account has been created successfully. You can now log in and apply for scholarships.',
      accountStatus: 'active',
      verificationStatus: 'not_required',
    });
  } catch (err) {
    // Handle race condition duplicate
    if (err.code === 11000) {
      return res.status(409).json({ success: false, code: 'ALREADY_REGISTERED', message: 'Account already exists for this email.' });
    }
    next(err);
  }
};

// ── Resend OTP ─────────────────────────────────────────────────────────────────
exports.resendOtp = async (req, res, next) => {
  try {
    const { collegeEmail, purpose } = req.body;
    const email = normalizeEmail(collegeEmail);

    const validPurposes = ['registration', 'password_reset'];
    if (!validPurposes.includes(purpose)) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid purpose.' });
    }

    const existing = await Otp.findOne({ email, purpose });
    if (!existing) {
      return res.status(400).json({ success: false, code: 'OTP_NOT_FOUND', message: 'No active OTP session found. Please restart.' });
    }

    // Resend controls: cooldown enforcement
    const lastSent = existing.lastResentAt || existing.dispatchedAt || existing.createdAt;
    if (lastSent) {
      const cooldownMs = OTP_RESEND_COOLDOWN * 1000;
      const elapsed = Date.now() - new Date(lastSent).getTime();
      if (elapsed < cooldownMs) {
        const wait = Math.ceil((cooldownMs - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          code: 'RESEND_COOLDOWN',
          message: `Please wait ${wait} second${wait !== 1 ? 's' : ''} before requesting a new code.`,
        });
      }
    }

    // Resend controls: attempt limits
    if ((existing.resendCount || 0) >= 5) {
      return res.status(429).json({
        success: false,
        code: 'MAX_RESENDS_EXCEEDED',
        message: 'Maximum OTP resend limit reached. Please restart registration.',
      });
    }

    // Save context from old OTP to carry over to new one
    const oldContext = existing.context ?? null;
    const currentResendCount = (existing.resendCount || 0) + 1;

    const { expiresAt } = await issueOtp(email, purpose, oldContext);

    // Update resend tracking
    await Otp.updateOne({ email, purpose }, { resendCount: currentResendCount, lastResentAt: new Date() });

    return res.status(200).json({
      success: true,
      message: 'A new code has been sent to your college email.',
      expiresAt,
      expirySeconds: OTP_EXPIRY_SECONDS,
    });
  } catch (err) {
    next(err);
  }
};

// ── Login ──────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { identifier, collegeEmail, email: directEmail, password, selectedRole } = req.body;
    let input = normalizeEmail(identifier || collegeEmail || directEmail);
    const domain = (process.env.COLLEGE_EMAIL_DOMAIN || 'eec.srmrmp.edu.in').toLowerCase().trim();

    // If student types 12-digit register number directly in login, resolve to expected college email
    if (/^\d{12}$/.test(input)) {
      input = `${input}@${domain}`;
    }

    // 1. User exists check
    const user = await User.findOne({ email: input }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid college email or password.' });
    }

    // 2. Password is correct check
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid college email or password.' });
    }

    // 3. Validate selected role against actual account role
    if (selectedRole && selectedRole !== user.role) {
      const roleLabels = { student: 'Student', verifier: 'Verifier', admin: 'Admin' };
      const actualLabel = roleLabels[user.role] || user.role;
      return res.status(403).json({
        success: false,
        code: 'ROLE_MISMATCH',
        message: `Your account is registered as ${actualLabel}. Please select the correct role.`,
      });
    }

    // 4. emailVerified === true check
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your college email with OTP before logging in.',
      });
    }

    // 5. accountStatus === "active" check
    const accStatus = user.accountStatus || (user.isActive ? 'active' : 'inactive');
    if (accStatus !== 'active') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        message: 'Your account is inactive or suspended. Please contact support.',
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({ id: user._id, role: user.role, email: user.email });
    setCookieToken(res, token);

    // Build safe user object
    const safeUser = {
      id: user._id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus || 'active',
      verificationStatus: user.verificationStatus || 'not_required',
    };

    return res.status(200).json({ success: true, user: safeUser, token });
  } catch (err) {
    next(err);
  }
};

// ── Logout ─────────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    clearCookieToken(res);
    return res.status(200).json({ success: true, message: 'Logged out.' });
  } catch (err) {
    next(err);
  }
};

// ── Me ─────────────────────────────────────────────────────────────────────────
exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('studentMaster', 'name registerNumber department currentYear academicYear');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ── Forgot Password ────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { collegeEmail, email: directEmail } = req.body;
    let email = normalizeEmail(collegeEmail || directEmail);
    const domain = (process.env.COLLEGE_EMAIL_DOMAIN || 'eec.srmrmp.edu.in').toLowerCase().trim();

    if (/^\d{12}$/.test(email)) {
      email = `${email}@${domain}`;
    }

    // Always return neutral response — do not reveal account existence
    const NEUTRAL = 'If an eligible account exists, a code will be sent to its college email.';

    const user = await User.findOne({ email, emailVerified: true, isActive: true });
    if (!user) {
      return res.status(200).json({ success: true, message: NEUTRAL });
    }

    try {
      await issueOtp(email, 'password_reset', { userId: user._id.toString() });
    } catch (err) {
      return res.status(err.statusCode || 502).json({
        success: false,
        code: err.code || 'EMAIL_FAILED',
        message: err.message || 'OTP could not be sent. Please try again later.',
      });
    }

    return res.status(200).json({ success: true, message: NEUTRAL });
  } catch (err) {
    next(err);
  }
};

// ── Verify Reset OTP ───────────────────────────────────────────────────────────
exports.verifyResetOtp = async (req, res, next) => {
  try {
    const { collegeEmail, otp } = req.body;
    const email = normalizeEmail(collegeEmail);

    const challenge = await Otp.findOne({ email, purpose: 'password_reset' }).select('+codeHash');
    if (!challenge) {
      return res.status(400).json({ success: false, code: 'OTP_NOT_FOUND', message: 'No active reset code found.' });
    }

    if (new Date() > challenge.expiresAt) {
      await Otp.deleteOne({ _id: challenge._id });
      return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'OTP expired. Request a new code.' });
    }

    if (challenge.used) {
      return res.status(400).json({ success: false, code: 'OTP_USED', message: 'This code has already been used.' });
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      return res.status(429).json({ success: false, code: 'OTP_MAX_ATTEMPTS', message: 'Too many failed attempts. Request a new code.' });
    }

    if (!verifyOtpHash(otp, challenge.codeHash)) {
      challenge.attempts += 1;
      await challenge.save();
      const remaining = challenge.maxAttempts - challenge.attempts;
      return res.status(400).json({
        success: false,
        code: 'OTP_INVALID',
        message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    // Mark as used
    challenge.used = true;
    await challenge.save();

    // Issue a short-lived, single-use reset authorization token (15 minutes, restricted purpose)
    const { userId } = challenge.context || {};
    if (!userId) {
      return res.status(400).json({ success: false, code: 'CHALLENGE_INVALID', message: 'Invalid reset session.' });
    }

    const resetToken = signToken({ id: userId, purpose: 'password_reset' }, '15m');

    return res.status(200).json({
      success: true,
      message: 'OTP verified. You may now set a new password.',
      resetToken, // Returned in body — NOT set as session cookie
    });
  } catch (err) {
    next(err);
  }
};

// ── Reset Password ─────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Reset token is required.' });
    }

    let decoded;
    try {
      const { verifyToken } = require('../utils/generateToken');
      decoded = verifyToken(resetToken);
    } catch {
      return res.status(400).json({ success: false, code: 'TOKEN_INVALID', message: 'Invalid or expired reset token.' });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'This token is not for password reset.' });
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Passwords do not match.' });
    }

    const user = await User.findById(decoded.id).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Account not found.' });
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
    if (sameAsOld) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'New password must differ from the current password.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    // Revoke all earlier sessions by recording the change time
    user.passwordChangedAt = new Date();
    await user.save();

    // Clear the current session cookie
    clearCookieToken(res);

    // Notify the student
    try {
      await sendPasswordChangedEmail({ to: user.email, name: user.email });
      await createNotification({
        recipient: user._id,
        title: 'Password Changed',
        message: 'Your Scholarship Desk password was successfully changed.',
        type: 'password_changed',
      });
    } catch { /* non-fatal */ }

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
};
