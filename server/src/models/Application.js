'use strict';
const mongoose = require('mongoose');

const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'under_verification',
  'action_required',
  'verified',
  'under_final_approval',
  'approved',
  'rejected',
];

// Snapshot of official data at submission time
const officialSnapshotSchema = new mongoose.Schema(
  {
    registerNumber: String,
    name: String,
    collegeEmail: String,
    department: String,
    currentYear: Number,
    academicYear: String,
  },
  { _id: false }
);

// Snapshot of profile data at submission time
const profileSnapshotSchema = new mongoose.Schema(
  {
    cgpa: Number,
    percentage: Number,
    familyIncome: Number,
    category: String,
    gender: String,
    isFirstGraduate: Boolean,
    hasDisability: Boolean,
    phone: String,
    address: mongoose.Schema.Types.Mixed,
    bankDetails: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

// Document version reference attached at submission
const documentRefSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    documentType: String,
    originalFilename: String,
    version: Number,
    storageKey: String,
    verificationStatus: String,
    uploadedAt: Date,
  },
  { _id: false }
);

// Correction revision record
const correctionSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date, default: Date.now },
    remarks: String,
    // Updated documents provided by student
    updatedDocuments: [documentRefSchema],
    updatedAnswers: mongoose.Schema.Types.Mixed,
    respondedAt: Date,
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scholarship: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scholarship',
      required: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'draft',
      index: true,
    },
    // Immutable snapshots captured at submission
    officialSnapshot: officialSnapshotSchema,
    profileSnapshot: profileSnapshotSchema,
    documentRefs: [documentRefSchema],
    scholarshipSnapshot: {
      title: String,
      rulesVersion: Number,
      eligibilityCriteria: mongoose.Schema.Types.Mixed,
    },
    // Student answers to custom questions
    customAnswers: mongoose.Schema.Types.Mixed,
    // Correction history
    corrections: [correctionSchema],
    // Review remarks from verifier/admin
    verifierRemarks: { type: String, default: '' },
    adminRemarks: { type: String, default: '' },
    // Timestamps for key transitions
    submittedAt: Date,
    verifiedAt: Date,
    decidedAt: Date,
    // Assigned verifier
    assignedVerifier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
  }
);

// Core uniqueness constraint: one application per student+scholarship+academicYear
applicationSchema.index(
  { student: 1, scholarship: 1, academicYear: 1 },
  { unique: true }
);

applicationSchema.index({ status: 1, scholarship: 1 });

module.exports = mongoose.model('Application', applicationSchema);
module.exports.APPLICATION_STATUSES = APPLICATION_STATUSES;
