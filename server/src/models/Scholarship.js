'use strict';
const mongoose = require('mongoose');

const eligibilityCriterionSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      // Allowlisted in eligibilityEngine; stored here for reference
    },
    operator: {
      type: String,
      required: true,
      // Accept both word-form (used by frontend/eligibilityEngine) and symbol form
      enum: ['gte', 'lte', 'gt', 'lt', 'eq', 'neq', 'in', 'nin', '>=', '<=', '>', '<', '==', '!='],
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const customQuestionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'textarea', 'number', 'boolean', 'select'],
      default: 'text',
    },
    options: [String], // for 'select' type
    required: { type: Boolean, default: true },
    helpText: { type: String, default: '' },
  },
  { _id: false }
);

const scholarshipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    // Documents required for application
    requiredDocuments: [
      {
        type: String,
        enum: [
          'identity_proof',
          'income_certificate',
          'community_certificate',
          'marksheet',
          'marksheet_10th',
          'marksheet_12th',
          'current_semester_marksheet',
          'first_graduate_certificate',
          'disability_certificate',
          'bank_evidence',
          'bank_passbook',
          'bonafide_certificate',
          'fee_receipt',
          'aadhaar_card',
        ],
      },
    ],
    eligibilityCriteria: [eligibilityCriterionSchema],
    customQuestions: [customQuestionSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    // Version tracking: incremented when rules change
    rulesVersion: {
      type: Number,
      default: 1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Award amount (optional informational field)
    awardAmount: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

scholarshipSchema.virtual('isOpen').get(function () {
  return this.isActive && this.deadline > new Date();
});

scholarshipSchema.index({ academicYear: 1, isActive: 1 });
scholarshipSchema.index({ deadline: 1 });

module.exports = mongoose.model('Scholarship', scholarshipSchema);
