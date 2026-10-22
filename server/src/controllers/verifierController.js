'use strict';
const User = require('../models/User');
const Application = require('../models/Application');
const ApplicationLog = require('../models/ApplicationLog');
const { createNotification } = require('../services/notificationService');
const { sendAccountStatusEmail } = require('../config/email');

const VERIFIER_ALLOWED_TRANSITIONS = {
  submitted: 'under_verification',
  under_verification: ['action_required', 'verified'],
  action_required: 'under_verification',
  verified: 'under_final_approval',
};

// ── List pending student registrations ─────────────────────────────────────────
exports.getPendingRegistrations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find({ role: 'student', verificationStatus: 'pending' })
        .populate('studentMaster', 'name registerNumber department currentYear academicYear')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments({ role: 'student', verificationStatus: 'pending' }),
    ]);

    return res.status(200).json({ success: true, registrations: users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
};

// ── Approve / reject student registration ──────────────────────────────────────
exports.reviewRegistration = async (req, res, next) => {
  try {
    const { decision, remarks } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be "approved" or "rejected".' });
    }

    const student = await User.findById(req.params.id).populate('studentMaster', 'name');
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    if (student.verificationStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Account is not in pending state.' });
    }

    const newStatus = decision === 'approved' ? 'verified' : 'rejected';
    student.verificationStatus = newStatus;
    student.verificationRemarks = remarks || '';
    await student.save();

    // Notification
    const name = student.studentMaster?.name || student.email;
    const title = decision === 'approved' ? 'Account Approved' : 'Account Update';
    const message = decision === 'approved'
      ? 'Your Scholarship Desk account has been approved. You can now browse and apply for scholarships.'
      : `Your account registration was not approved. ${remarks ? 'Reason: ' + remarks : ''}`;

    await createNotification({
      recipient: student._id,
      title,
      message,
      type: decision === 'approved' ? 'account_approved' : 'account_rejected',
    });

    try {
      await sendAccountStatusEmail({ to: student.email, name, status: newStatus, remarks });
    } catch { /* non-fatal */ }

    return res.status(200).json({ success: true, message: `Account ${decision}.`, verificationStatus: newStatus });
  } catch (err) {
    next(err);
  }
};

// ── List applications assigned for review ──────────────────────────────────────
exports.getApplicationQueue = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviewableStatuses = ['submitted', 'under_verification', 'action_required', 'verified'];
    const filter = { status: { $in: reviewableStatuses } };
    if (status && reviewableStatuses.includes(status)) filter.status = status;

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate('student', 'email')
        .populate('scholarship', 'title academicYear deadline')
        .sort({ submittedAt: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Application.countDocuments(filter),
    ]);

    return res.status(200).json({ success: true, applications, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
};

// ── Update application status (verifier transitions) ──────────────────────────
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    const application = await Application.findById(req.params.id)
      .populate('student', 'email')
      .populate('scholarship', 'title');

    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    const allowedNext = VERIFIER_ALLOWED_TRANSITIONS[application.status];
    const allowedArray = Array.isArray(allowedNext) ? allowedNext : [allowedNext];

    if (!allowedArray.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${application.status}" to "${status}".`,
        allowedTransitions: allowedArray,
      });
    }

    const previousStatus = application.status;
    application.status = status;
    application.verifierRemarks = remarks || application.verifierRemarks;

    if (status === 'verified') application.verifiedAt = new Date();
    await application.save();

    await ApplicationLog.create({
      application: application._id,
      actor: req.user.id,
      actorRole: 'verifier',
      action: status === 'action_required' ? 'correction_requested'
        : status === 'verified' ? 'verified'
        : status === 'under_final_approval' ? 'forwarded'
        : 'review_update',
      previousStatus,
      newStatus: status,
      remarks: remarks || '',
    });

    // Notify student of relevant transitions
    if (['action_required', 'verified', 'under_final_approval'].includes(status)) {
      await createNotification({
        recipient: application.student._id,
        title: status === 'action_required' ? 'Action Required' : 'Application Update',
        message: status === 'action_required'
          ? `Your application for "${application.scholarship.title}" requires corrections. ${remarks ? 'Notes: ' + remarks : ''}`
          : `Your application for "${application.scholarship.title}" has been ${status === 'verified' ? 'verified' : 'forwarded for final approval'}.`,
        type: status === 'action_required' ? 'correction_requested' : 'application_verified',
        relatedApplication: application._id,
      });
    }

    return res.status(200).json({ success: true, application });
  } catch (err) {
    next(err);
  }
};
