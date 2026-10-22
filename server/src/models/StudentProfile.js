'use strict';
const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, trim: true, default: '' },
    ifscCode: { type: String, trim: true, uppercase: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    branchName: { type: String, trim: true, default: '' },
    accountHolderName: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: '' },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const studentProfileSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Academic performance (student-editable)
    cgpa: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    // Family & category
    familyIncome: {
      type: Number,
      min: 0,
      default: null,
    },
    category: {
      type: String,
      enum: ['OC', 'BC', 'BC(M)', 'BCM', 'MBC', 'MBC(DNC)', 'SC', 'SCA', 'ST', 'OBC', null],
      default: null,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say', null],
      default: null,
    },
    isFirstGraduate: {
      type: Boolean,
      default: null,
    },
    hasDisability: {
      type: Boolean,
      default: null,
    },
    disabilityDetails: {
      type: String,
      trim: true,
      default: '',
    },
    // Contact
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    // Bank
    bankDetails: {
      type: bankSchema,
      default: () => ({}),
    },
    // Profile completeness tracking
    completedFields: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        // Mask partial bank account number
        if (ret.bankDetails && ret.bankDetails.accountNumber) {
          const acc = ret.bankDetails.accountNumber;
          ret.bankDetails.accountNumberMasked =
            acc.length > 4 ? '*'.repeat(acc.length - 4) + acc.slice(-4) : '****';
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
