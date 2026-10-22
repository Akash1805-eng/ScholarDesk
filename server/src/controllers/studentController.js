'use strict';
const StudentMaster = require('../models/StudentMaster');
const StudentProfile = require('../models/StudentProfile');
const Document = require('../models/Document');
const { generateStorageKey, saveFile, getFile } = require('../services/storageService');
const { createError } = require('../middleware/errorMiddleware');
const { DOCUMENT_TYPES, supportsExpiryDate } = require('../models/Document');

// ── Get merged profile ─────────────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const master = await StudentMaster.findOne({ registeredUser: req.user.id });
    const profile = await StudentProfile.findOne({ student: req.user.id });

    return res.status(200).json({
      success: true,
      official: master,
      profile,
    });
  } catch (err) {
    next(err);
  }
};

// Allowed editable fields (server-side allowlist)
const EDITABLE_PROFILE_FIELDS = [
  'cgpa', 'percentage', 'familyIncome', 'category', 'gender',
  'isFirstGraduate', 'hasDisability', 'disabilityDetails',
  'phone', 'address', 'bankDetails',
];

// ── Update profile ─────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const updates = {};
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided.' });
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { student: req.user.id },
      { $set: updates },
      { new: true, runValidators: true, upsert: true }
    );

    return res.status(200).json({ success: true, profile });
  } catch (err) {
    next(err);
  }
};

// ── List documents ─────────────────────────────────────────────────────────────
exports.getDocuments = async (req, res, next) => {
  try {
    const documents = await Document.find({ owner: req.user.id })
      .sort({ documentType: 1, version: -1 });

    return res.status(200).json({ success: true, documents });
  } catch (err) {
    next(err);
  }
};

// ── Upload document ────────────────────────────────────────────────────────────
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { documentType, issueDate, expiryDate } = req.body;
    if (!DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({ success: false, message: `Invalid document type: ${documentType}` });
    }

    // Validate issueDate if supplied
    let parsedIssueDate = null;
    if (issueDate) {
      const d = new Date(issueDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid issue date format.' });
      }
      parsedIssueDate = d;
    }

    // Validate expiryDate if supplied
    let parsedExpiryDate = null;
    const canExpire = supportsExpiryDate(documentType);

    if (expiryDate) {
      const d = new Date(expiryDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid expiry date format.' });
      }
      if (canExpire) {
        if (parsedIssueDate && d < parsedIssueDate) {
          return res.status(400).json({ success: false, message: 'Expiry date cannot be earlier than issue date.' });
        }
        parsedExpiryDate = d;
      } else {
        // Document type does not support expiry date; omit / nullify stale or unapplicable value
        parsedExpiryDate = null;
      }
    }

    // Find existing active document of same type to determine version
    const existing = await Document.findOne({
      owner: req.user.id,
      documentType,
      isActive: true,
    }).sort({ version: -1 });

    const newVersion = existing ? existing.version + 1 : 1;

    // Generate safe storage key
    const storageKey = generateStorageKey(req.user.id, documentType, req.file.originalname);

    // Save to storage
    await saveFile(req.file.buffer, storageKey, req.file.mimetype);

    // Deactivate previous version
    if (existing) {
      existing.isActive = false;
      await existing.save();
    }

    const doc = await Document.create({
      owner: req.user.id,
      documentType,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storageKey,
      version: newVersion,
      issueDate: parsedIssueDate,
      expiryDate: parsedExpiryDate,
      previousVersion: existing?._id || null,
    });

    return res.status(201).json({ success: true, document: doc });
  } catch (err) {
    next(err);
  }
};

// ── Download document (authorized) ────────────────────────────────────────────
exports.downloadDocument = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id).select('+storageKey');
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Ownership: student can only access own docs
    // Staff (verifier/admin) can access any doc during review
    if (req.user.role === 'student' && doc.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
    }

    const result = await getFile(doc.storageKey);

    if (result.signedUrl) {
      // S3: redirect to signed URL
      return res.redirect(302, result.signedUrl);
    }

    // Local: stream file
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalFilename}"`);
    result.stream.pipe(res);
  } catch (err) {
    next(err);
  }
};
