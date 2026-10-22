'use strict';
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const StudentMaster = require('../models/StudentMaster');
const Application = require('../models/Application');
const ApplicationLog = require('../models/ApplicationLog');
const ImportHistory = require('../models/ImportHistory');
const { createNotification } = require('../services/notificationService');
const { previewImport, commitImport } = require('../services/excelImportService');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// ── Create verifier account ────────────────────────────────────────────────────
exports.createVerifier = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verifier = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'verifier',
      emailVerified: true,
      verificationStatus: 'verified',
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      verifier: { id: verifier._id, email: verifier.email, role: verifier.role },
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Email already in use.' });
    next(err);
  }
};

// ── List verifiers ─────────────────────────────────────────────────────────────
exports.listVerifiers = async (req, res, next) => {
  try {
    const verifiers = await User.find({ role: 'verifier' }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, verifiers });
  } catch (err) {
    next(err);
  }
};

// ── Final decision (approve/reject application) ────────────────────────────────
exports.makeDecision = async (req, res, next) => {
  try {
    const { decision, remarks } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be "approved" or "rejected".' });
    }

    const application = await Application.findById(req.params.id)
      .populate('student', 'email')
      .populate('scholarship', 'title');

    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    if (application.status !== 'under_final_approval') {
      return res.status(400).json({ success: false, message: 'Application is not in Under Final Approval state.' });
    }

    if (decision === 'rejected' && !remarks) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const previousStatus = application.status;
    const newStatus = decision === 'approved' ? 'approved' : 'rejected';
    application.status = newStatus;
    application.adminRemarks = remarks || '';
    application.decidedAt = new Date();
    await application.save();

    await ApplicationLog.create({
      application: application._id,
      actor: req.user.id,
      actorRole: 'admin',
      action: decision,
      previousStatus,
      newStatus,
      remarks: remarks || '',
    });

    await createNotification({
      recipient: application.student._id,
      title: decision === 'approved' ? 'Application Approved 🎉' : 'Application Decision',
      message: decision === 'approved'
        ? `Congratulations! Your application for "${application.scholarship.title}" has been approved.`
        : `Your application for "${application.scholarship.title}" was not approved. ${remarks ? 'Reason: ' + remarks : ''}`,
      type: decision === 'approved' ? 'application_approved' : 'application_rejected',
      relatedApplication: application._id,
    });

    return res.status(200).json({ success: true, application });
  } catch (err) {
    next(err);
  }
};

// ── Promote academic year ──────────────────────────────────────────────────────
exports.promoteYear = async (req, res, next) => {
  try {
    const { fromYear, academicYear, confirm = false } = req.body;

    if (![1, 2, 3, 4].includes(parseInt(fromYear))) {
      return res.status(400).json({ success: false, message: 'fromYear must be 1–4.' });
    }

    const year = parseInt(fromYear);
    const filter = { currentYear: year, academicYear, studentStatus: 'active' };
    const affected = await StudentMaster.find(filter).select('_id name registerNumber currentYear');

    if (!confirm) {
      return res.status(200).json({
        success: true,
        preview: true,
        count: affected.length,
        fromYear: year,
        toYear: year === 4 ? 'graduated' : year + 1,
        academicYear,
        sample: affected.slice(0, 5).map(s => ({ id: s._id, name: s.name, registerNumber: s.registerNumber })),
        message: `${affected.length} student(s) will be promoted. Send confirm=true to execute.`,
      });
    }

    // Execute promotion
    let promotedCount = 0;
    for (const student of affected) {
      const promotionRecord = {
        fromYear: year,
        toYear: year === 4 ? 'graduated' : year + 1,
        academicYear,
        promotedBy: req.user.id,
        promotedAt: new Date(),
      };

      if (year === 4) {
        await StudentMaster.findByIdAndUpdate(student._id, {
          studentStatus: 'graduated',
          $push: { promotionHistory: promotionRecord },
        });
      } else {
        await StudentMaster.findByIdAndUpdate(student._id, {
          currentYear: year + 1,
          $push: { promotionHistory: promotionRecord },
        });
      }
      promotedCount++;
    }

    return res.status(200).json({
      success: true,
      promotedCount,
      fromYear: year,
      toYear: year === 4 ? 'graduated' : year + 1,
      academicYear,
    });
  } catch (err) {
    next(err);
  }
};

// ── Reports ────────────────────────────────────────────────────────────────────
exports.getReports = async (req, res, next) => {
  try {
    const { academicYear } = req.query;
    const filter = academicYear ? { academicYear } : {};

    const [
      totalStudents,
      pendingRegistrations,
      byStatus,
      byDept,
      totalScholarships,
    ] = await Promise.all([
      StudentMaster.countDocuments({ ...filter, studentStatus: 'active' }),
      User.countDocuments({ role: 'student', verificationStatus: 'pending' }),
      Application.aggregate([
        ...(academicYear ? [{ $match: { academicYear } }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Application.aggregate([
        ...(academicYear ? [{ $match: { academicYear } }] : []),
        { $group: { _id: '$officialSnapshot.department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      require('../models/Scholarship').countDocuments({ isActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        totalStudents,
        pendingRegistrations,
        totalActiveScholarships: totalScholarships,
      },
      applicationsByStatus: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
      applicationsByDepartment: byDept,
    });
  } catch (err) {
    next(err);
  }
};

// ── Import: preview ────────────────────────────────────────────────────────────
exports.importPreview = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const result = await previewImport(req.file.buffer, req.file.originalname, req.user.id);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// ── Import: commit ─────────────────────────────────────────────────────────────
exports.importCommit = async (req, res, next) => {
  try {
    const { importId } = req.body;
    if (!importId) return res.status(400).json({ success: false, message: 'importId is required.' });

    const result = await commitImport(importId, req.user.id);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// ── Import: download template ──────────────────────────────────────────────────
exports.downloadTemplate = async (req, res, next) => {
  try {
    const headers = ['registerNumber', 'name', 'collegeEmail', 'department', 'currentYear', 'academicYear'];
    const sample = [
      ['310624104001', 'Sample Student One', `student1@${process.env.COLLEGE_EMAIL_DOMAIN || 'college.example'}`, 'CSE', '2', '2026-2027'],
      ['310624104002', 'Sample Student Two', `student2@${process.env.COLLEGE_EMAIL_DOMAIN || 'college.example'}`, 'IT', '3', '2026-2027'],
    ];

    const csv = [headers, ...sample].map(row => row.join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.csv"');
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};

// ── Student Master list ────────────────────────────────────────────────────────
exports.listStudentMaster = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '', department = '', year = '', academicYear = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = {};
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { registerNumber: { $regex: search, $options: 'i' } },
    ];
    if (department) filter.department = department.toUpperCase();
    if (year) filter.currentYear = parseInt(year);
    if (academicYear) filter.academicYear = academicYear;

    const [records, total] = await Promise.all([
      StudentMaster.find(filter).sort({ registerNumber: 1 }).skip(skip).limit(parseInt(limit)),
      StudentMaster.countDocuments(filter),
    ]);
    return res.status(200).json({ success: true, records, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
};

// ── Import history ─────────────────────────────────────────────────────────────
exports.getImportHistory = async (req, res, next) => {
  try {
    const history = await ImportHistory.find({ uploadedBy: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-rowResults'); // don't send full row data in list
    return res.status(200).json({ success: true, history });
  } catch (err) {
    next(err);
  }
};
