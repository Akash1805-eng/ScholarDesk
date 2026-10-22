'use strict';
const mongoose = require('mongoose');

const DOCUMENT_TYPES = [
  'identity_proof',
  'income_certificate',
  'community_certificate',
  'marksheet',
  'first_graduate_certificate',
  'disability_certificate',
  'bank_evidence',
  'bonafide_certificate',
];

const documentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: DOCUMENT_TYPES,
      required: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    // Private storage key (S3 key or local path)
    storageKey: {
      type: String,
      required: true,
    },
    // Immutable version counter — incremented on renewal
    version: {
      type: Number,
      default: 1,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    // Optional dates (only for documents that have them)
    issueDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true, // for expiry job queries
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verificationRemarks: {
      type: String,
      default: '',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    // Soft-delete: superseded versions are inactive
    isActive: {
      type: Boolean,
      default: true,
    },
    // Track which document this version supersedes
    previousVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },
    // Reminder tracking: prevents duplicate reminder emails
    remindersSent: [
      {
        threshold: Number, // days before expiry, e.g. 30, 7, 1
        sentAt: Date,
        notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification' },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.storageKey; // never expose storage key in API
        delete ret.__v;
        return ret;
      },
    },
  }
);

documentSchema.index({ owner: 1, documentType: 1, isActive: 1 });
documentSchema.index({ expiryDate: 1, isActive: 1 });

// Document expiry configuration: defines whether an expiry date field is applicable (optional)
const DOCUMENT_EXPIRY_CONFIG = {
  identity_proof: { supportsExpiry: true },
  income_certificate: { supportsExpiry: true },
  community_certificate: { supportsExpiry: false },
  marksheet: { supportsExpiry: false },
  first_graduate_certificate: { supportsExpiry: false },
  disability_certificate: { supportsExpiry: true },
  bank_evidence: { supportsExpiry: false },
  bonafide_certificate: { supportsExpiry: false },
};

function supportsExpiryDate(documentType) {
  return Boolean(DOCUMENT_EXPIRY_CONFIG[documentType]?.supportsExpiry);
}

module.exports = mongoose.model('Document', documentSchema);
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
module.exports.DOCUMENT_EXPIRY_CONFIG = DOCUMENT_EXPIRY_CONFIG;
module.exports.supportsExpiryDate = supportsExpiryDate;
