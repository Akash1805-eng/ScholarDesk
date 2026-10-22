'use strict';
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned in queries by default
    },
    role: {
      type: String,
      enum: ['student', 'verifier', 'admin'],
      default: 'student',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    accountStatus: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    // For students: 'pending' | 'verified' | 'rejected' | 'not_required'
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'not_required'],
      default: 'not_required',
    },
    verificationRemarks: {
      type: String,
      default: '',
    },
    // Link to StudentMaster (students only)
    studentMaster: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentMaster',
      default: null,
    },
    // Session revocation: tokens issued before this date are invalid
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    // For admin-created verifier accounts
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
