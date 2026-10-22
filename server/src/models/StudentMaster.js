'use strict';
const mongoose = require('mongoose');

const studentMasterSchema = new mongoose.Schema(
  {
    registerNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    collegeEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    // 1–4 for active students
    currentYear: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    // e.g. "2026-2027"
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    // 'active' | 'graduated'
    studentStatus: {
      type: String,
      enum: ['active', 'graduated'],
      default: 'active',
    },
    // Registration state in the portal
    registrationStatus: {
      type: String,
      enum: ['unregistered', 'registered'],
      default: 'unregistered',
    },
    // Set when a student account is successfully created from this record
    registeredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Import metadata
    importId: {
      type: String,
      default: null,
    },
    // Audit: who last modified this record
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Year promotion history
    promotionHistory: [
      {
        fromYear: Number,
        toYear: { type: String }, // 'graduated' or number string
        academicYear: String,
        promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        promotedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
  }
);

studentMasterSchema.index({ department: 1, currentYear: 1, academicYear: 1 });
studentMasterSchema.index({ registrationStatus: 1 });
studentMasterSchema.index({ importId: 1 });

module.exports = mongoose.model('StudentMaster', studentMasterSchema);
