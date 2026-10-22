'use strict';
const mongoose = require('mongoose');

const rowResultSchema = new mongoose.Schema(
  {
    rowNumber: Number,
    registerNumber: String,
    name: String,
    collegeEmail: String,
    department: String,
    currentYear: String,
    academicYear: String,
    status: { type: String, enum: ['valid', 'invalid', 'duplicate', 'conflict', 'imported', 'skipped', 'failed'] },
    errors: [String],
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const importHistorySchema = new mongoose.Schema(
  {
    importId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    // 'preview' | 'committed' | 'failed'
    phase: {
      type: String,
      enum: ['preview', 'committed', 'failed'],
      default: 'preview',
    },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    importedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    // Row-level results (stored for preview and error report)
    rowResults: [rowResultSchema],
    // Error report download key
    errorReportKey: { type: String, default: null },
    committedAt: { type: Date, default: null },
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

importHistorySchema.index({ uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model('ImportHistory', importHistorySchema);
