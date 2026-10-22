'use strict';
const Scholarship = require('../models/Scholarship');
const Application = require('../models/Application');
const StudentMaster = require('../models/StudentMaster');
const StudentProfile = require('../models/StudentProfile');
const Document = require('../models/Document');
const ApplicationLog = require('../models/ApplicationLog');
const { createNotification } = require('../services/notificationService');
const { evaluateEligibility } = require('../utils/eligibilityEngine');
const { createError } = require('../middleware/errorMiddleware');

const VALID_TRANSITIONS = {
  student: {
    draft: ['submitted'],
    action_required: ['submitted'], // re-submit after correction
  },
  verifier: {
    submitted: ['under_verification'],
    under_verification: ['action_required', 'verified'],
    action_required: ['under_verification'],
    verified: ['under_final_approval'],
  },
  admin: {
    under_final_approval: ['approved', 'rejected'],
  },
};

// ── List scholarships (paginated, with eligibility hints) ─────────────────────
exports.listScholarships = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', academicYear = '', status = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) filter.title = { $regex: search, $options: 'i' };
    if (academicYear) filter.academicYear = academicYear;
    if (status === 'open') { filter.isActive = true; filter.deadline = { $gt: new Date() }; }
    else if (status === 'closed') { filter.$or = [{ isActive: false }, { deadline: { $lte: new Date() } }]; }

    const [scholarships, total] = await Promise.all([
      Scholarship.find(filter).sort({ deadline: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      Scholarship.countDocuments(filter),
    ]);

    // For approved students: attach per-scholarship application status
    let applicationMap = {};
    if (req.user.role === 'student') {
      const apps = await Application.find({
        student: req.user.id,
        scholarship: { $in: scholarships.map(s => s._id) },
      }).select('scholarship status academicYear').lean();
      for (const app of apps) {
        applicationMap[app.scholarship.toString()] = { status: app.status, academicYear: app.academicYear };
      }
    }

    const enriched = scholarships.map(s => ({
      ...s,
      isOpen: s.isActive && new Date(s.deadline) > new Date(),
      applicationStatus: applicationMap[s._id.toString()] || null,
    }));

    return res.status(200).json({
      success: true,
      scholarships: enriched,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
};

// ── Get scholarship detail ─────────────────────────────────────────────────────
exports.getScholarship = async (req, res, next) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    if (!scholarship) return res.status(404).json({ success: false, message: 'Scholarship not found.' });
    return res.status(200).json({ success: true, scholarship });
  } catch (err) {
    next(err);
  }
};

// ── Check eligibility ──────────────────────────────────────────────────────────
exports.checkEligibility = async (req, res, next) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    if (!scholarship) return res.status(404).json({ success: false, message: 'Scholarship not found.' });

    const master = await StudentMaster.findOne({ registeredUser: req.user.id });
    const profile = await StudentProfile.findOne({ student: req.user.id });

    const result = evaluateEligibility(scholarship, master, profile);

    // Check if student already has an application for this scholarship this year
    const existing = await Application.findOne({
      student: req.user.id,
      scholarship: scholarship._id,
      academicYear: master?.academicYear,
    }).select('status');

    return res.status(200).json({
      success: true,
      scholarshipId: scholarship._id,
      scholarshipTitle: scholarship.title,
      ...result,
      existingApplication: existing ? { status: existing.status, id: existing._id } : null,
      deadline: scholarship.deadline,
      isOpen: scholarship.isActive && scholarship.deadline > new Date(),
    });
  } catch (err) {
    next(err);
  }
};

// ── Create scholarship (admin) ─────────────────────────────────────────────────
exports.createScholarship = async (req, res, next) => {
  try {
    const {
      title, description, academicYear, deadline,
      requiredDocuments, eligibilityCriteria, customQuestions, awardAmount,
    } = req.body;

    const scholarship = await Scholarship.create({
      title, description, academicYear,
      deadline: new Date(deadline),
      requiredDocuments: requiredDocuments || [],
      eligibilityCriteria: eligibilityCriteria || [],
      customQuestions: customQuestions || [],
      awardAmount,
      createdBy: req.user.id,
    });

    return res.status(201).json({ success: true, scholarship });
  } catch (err) {
    next(err);
  }
};

// ── Update scholarship (admin) ─────────────────────────────────────────────────
exports.updateScholarship = async (req, res, next) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    if (!scholarship) return res.status(404).json({ success: false, message: 'Scholarship not found.' });

    const EDITABLE = ['title', 'description', 'deadline', 'requiredDocuments', 'eligibilityCriteria',
      'customQuestions', 'isActive', 'awardAmount'];
    let rulesChanged = false;

    for (const field of EDITABLE) {
      if (req.body[field] !== undefined) {
        if (field === 'eligibilityCriteria' && JSON.stringify(req.body[field]) !== JSON.stringify(scholarship.eligibilityCriteria)) {
          rulesChanged = true;
        }
        scholarship[field] = field === 'deadline' ? new Date(req.body[field]) : req.body[field];
      }
    }

    if (rulesChanged) scholarship.rulesVersion += 1;
    scholarship.lastEditedBy = req.user.id;
    await scholarship.save();

    return res.status(200).json({ success: true, scholarship });
  } catch (err) {
    next(err);
  }
};

// ── Preview (autofill) ─────────────────────────────────────────────────────────
exports.previewApplication = async (req, res, next) => {
  try {
    const { scholarshipId } = req.body;
    const scholarship = await Scholarship.findById(scholarshipId);
    if (!scholarship) return res.status(404).json({ success: false, message: 'Scholarship not found.' });

    if (!scholarship.isActive || scholarship.deadline <= new Date()) {
      return res.status(400).json({ success: false, code: 'DEADLINE_PASSED', message: 'This scholarship is closed.' });
    }

    const master = await StudentMaster.findOne({ registeredUser: req.user.id });
    const profile = await StudentProfile.findOne({ student: req.user.id });

    // Eligibility check
    const eligibility = evaluateEligibility(scholarship, master, profile);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        code: 'NOT_ELIGIBLE',
        message: 'You do not meet the eligibility criteria for this scholarship.',
        reasons: eligibility.reasons,
        missingFields: eligibility.missingFields,
      });
    }

    // Check for existing application
    const existing = await Application.findOne({
      student: req.user.id,
      scholarship: scholarship._id,
      academicYear: master.academicYear,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        code: 'APPLICATION_EXISTS',
        message: 'You already have an application for this scholarship.',
        applicationId: existing._id,
        status: existing.status,
      });
    }

    // Gather valid documents for each required type
    const now = new Date();
    const documentMap = {};
    const missingDocuments = [];

    for (const docType of (scholarship.requiredDocuments || [])) {
      const doc = await Document.findOne({
        owner: req.user.id,
        documentType: docType,
        isActive: true,
        $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
      }).sort({ version: -1 });

      if (doc) {
        documentMap[docType] = doc;
      } else {
        missingDocuments.push(docType);
      }
    }

    return res.status(200).json({
      success: true,
      official: {
        registerNumber: master.registerNumber,
        name: master.name,
        collegeEmail: master.collegeEmail,
        department: master.department,
        currentYear: master.currentYear,
        academicYear: master.academicYear,
      },
      profile,
      scholarship: {
        _id: scholarship._id,
        title: scholarship.title,
        academicYear: scholarship.academicYear,
        deadline: scholarship.deadline,
        customQuestions: scholarship.customQuestions,
        requiredDocuments: scholarship.requiredDocuments,
        rulesVersion: scholarship.rulesVersion,
      },
      availableDocuments: documentMap,
      missingDocuments,
      eligibility,
    });
  } catch (err) {
    next(err);
  }
};

// ── Submit application ─────────────────────────────────────────────────────────
exports.submitApplication = async (req, res, next) => {
  try {
    const { scholarshipId, customAnswers, confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({ success: false, code: 'NOT_CONFIRMED', message: 'You must review and confirm the application before submitting.' });
    }

    const scholarship = await Scholarship.findById(scholarshipId);
    if (!scholarship || !scholarship.isActive || scholarship.deadline <= new Date()) {
      return res.status(400).json({ success: false, code: 'SCHOLARSHIP_UNAVAILABLE', message: 'Scholarship is closed or not found.' });
    }

    const master = await StudentMaster.findOne({ registeredUser: req.user.id });
    const profile = await StudentProfile.findOne({ student: req.user.id });

    // Server-side eligibility recheck
    const eligibility = evaluateEligibility(scholarship, master, profile);
    if (!eligibility.eligible) {
      return res.status(400).json({ success: false, code: 'NOT_ELIGIBLE', message: 'Eligibility check failed.', reasons: eligibility.reasons });
    }

    // Gather valid document references
    const now = new Date();
    const documentRefs = [];
    const missingDocuments = [];

    for (const docType of (scholarship.requiredDocuments || [])) {
      const doc = await Document.findOne({
        owner: req.user.id,
        documentType: docType,
        isActive: true,
        $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
      }).sort({ version: -1 }).select('+storageKey');

      if (doc) {
        documentRefs.push({
          documentId: doc._id,
          documentType: doc.documentType,
          originalFilename: doc.originalFilename,
          version: doc.version,
          storageKey: doc.storageKey,
          verificationStatus: doc.verificationStatus,
          uploadedAt: doc.uploadedAt,
        });
      } else {
        missingDocuments.push(docType);
      }
    }

    if (missingDocuments.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_DOCUMENTS',
        message: 'Required documents are missing or expired.',
        missingDocuments,
      });
    }

    // Build immutable snapshots
    const officialSnapshot = {
      registerNumber: master.registerNumber,
      name: master.name,
      collegeEmail: master.collegeEmail,
      department: master.department,
      currentYear: master.currentYear,
      academicYear: master.academicYear,
    };

    const profileSnapshot = {
      cgpa: profile?.cgpa,
      percentage: profile?.percentage,
      familyIncome: profile?.familyIncome,
      category: profile?.category,
      gender: profile?.gender,
      isFirstGraduate: profile?.isFirstGraduate,
      hasDisability: profile?.hasDisability,
      phone: profile?.phone,
      address: profile?.address,
      bankDetails: profile?.bankDetails,
    };

    let application;
    try {
      application = await Application.findOneAndUpdate(
        {
          student: req.user.id,
          scholarship: scholarship._id,
          academicYear: master.academicYear,
          status: 'draft', // Only update if in draft state
        },
        {
          $set: {
            status: 'submitted',
            officialSnapshot,
            profileSnapshot,
            documentRefs,
            scholarshipSnapshot: {
              title: scholarship.title,
              rulesVersion: scholarship.rulesVersion,
              eligibilityCriteria: scholarship.eligibilityCriteria,
            },
            customAnswers: customAnswers || {},
            submittedAt: new Date(),
          },
        },
        { new: true, upsert: false }
      );

      if (!application) {
        // No draft exists — create new
        application = await Application.create({
          student: req.user.id,
          scholarship: scholarship._id,
          academicYear: master.academicYear,
          status: 'submitted',
          officialSnapshot,
          profileSnapshot,
          documentRefs,
          scholarshipSnapshot: {
            title: scholarship.title,
            rulesVersion: scholarship.rulesVersion,
            eligibilityCriteria: scholarship.eligibilityCriteria,
          },
          customAnswers: customAnswers || {},
          submittedAt: new Date(),
        });
      }
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          code: 'APPLICATION_EXISTS',
          message: 'You already have an application for this scholarship this academic year.',
        });
      }
      throw err;
    }

    // Create audit log
    await ApplicationLog.create({
      application: application._id,
      actor: req.user.id,
      actorRole: 'student',
      action: 'submitted',
      previousStatus: 'draft',
      newStatus: 'submitted',
      remarks: 'Application submitted by student.',
    });

    // Notify student
    await createNotification({
      recipient: req.user.id,
      title: 'Application Submitted',
      message: `Your application for "${scholarship.title}" has been submitted successfully.`,
      type: 'application_submitted',
      relatedApplication: application._id,
    });

    return res.status(201).json({ success: true, application });
  } catch (err) {
    next(err);
  }
};

// ── List student's applications ────────────────────────────────────────────────
exports.listMyApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ student: req.user.id })
      .populate('scholarship', 'title academicYear deadline')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, applications });
  } catch (err) {
    next(err);
  }
};

// ── Get application detail (with ownership check) ──────────────────────────────
exports.getApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('scholarship', 'title academicYear deadline customQuestions')
      .populate('student', 'email');

    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    // Ownership: student sees only their own
    if (req.user.role === 'student' && application.student._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
    }

    const logs = await ApplicationLog.find({ application: application._id })
      .populate('actor', 'email role')
      .sort({ createdAt: 1 });

    return res.status(200).json({ success: true, application, logs });
  } catch (err) {
    next(err);
  }
};

// ── Submit corrections ─────────────────────────────────────────────────────────
exports.submitCorrections = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    if (application.student.toString() !== req.user.id) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
    }

    if (application.status !== 'action_required') {
      return res.status(400).json({ success: false, message: 'Application is not in Action Required state.' });
    }

    const { updatedDocumentIds, updatedAnswers, remarks } = req.body;

    // Validate updated documents belong to this student
    const updatedDocuments = [];
    if (updatedDocumentIds?.length) {
      const docs = await Document.find({
        _id: { $in: updatedDocumentIds },
        owner: req.user.id,
        isActive: true,
      }).select('+storageKey');

      for (const doc of docs) {
        updatedDocuments.push({
          documentId: doc._id,
          documentType: doc.documentType,
          originalFilename: doc.originalFilename,
          version: doc.version,
          storageKey: doc.storageKey,
          verificationStatus: doc.verificationStatus,
          uploadedAt: doc.uploadedAt,
        });
      }
    }

    const correction = {
      requestedBy: req.user.id,
      requestedAt: application.corrections.slice(-1)[0]?.requestedAt || new Date(),
      remarks: remarks || '',
      updatedDocuments,
      updatedAnswers: updatedAnswers || {},
      respondedAt: new Date(),
      respondedBy: req.user.id,
    };

    application.corrections.push(correction);
    application.status = 'submitted';
    await application.save();

    await ApplicationLog.create({
      application: application._id,
      actor: req.user.id,
      actorRole: 'student',
      action: 'correction_provided',
      previousStatus: 'action_required',
      newStatus: 'submitted',
      remarks: remarks || 'Student provided corrected evidence.',
    });

    return res.status(200).json({ success: true, application });
  } catch (err) {
    next(err);
  }
};
