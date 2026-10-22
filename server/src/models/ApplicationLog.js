'use strict';
const mongoose = require('mongoose');

const applicationLogSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      enum: ['student', 'verifier', 'admin', 'system'],
      required: true,
    },
    action: {
      type: String,
      required: true,
      // e.g. 'submitted', 'review_started', 'correction_requested',
      //      'correction_provided', 'verified', 'forwarded', 'approved', 'rejected'
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      default: null,
    },
    remarks: {
      type: String,
      default: '',
    },
    // Additional context (e.g. which documents were updated)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    // Audit logs are append-only; no update operations should be run against them
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

applicationLogSchema.index({ application: 1, createdAt: -1 });
applicationLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model('ApplicationLog', applicationLogSchema);
