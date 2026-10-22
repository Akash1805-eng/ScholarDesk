'use strict';
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'account_approved',
        'account_rejected',
        'application_submitted',
        'correction_requested',
        'application_verified',
        'application_approved',
        'application_rejected',
        'document_expiry_warning',
        'document_expired',
        'password_changed',
        'general',
      ],
      default: 'general',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Optional link to the related resource
    relatedApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      default: null,
    },
    relatedDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },
    // Deduplication key (e.g. "doc-<id>-threshold-7")
    deduplicationKey: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ deduplicationKey: 1 }, { sparse: true });

module.exports = mongoose.model('Notification', notificationSchema);
