'use strict';
const multer = require('multer');

const UPLOAD_LIMIT_MB = parseInt(process.env.UPLOAD_FILE_SIZE_LIMIT_MB || '10', 10);
const IMPORT_LIMIT_MB = parseInt(process.env.IMPORT_FILE_SIZE_LIMIT_MB || '20', 10);

// Allowed MIME types for student documents
const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// Allowed MIME types for import files
const ALLOWED_IMPORT_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv',
  'application/csv',
  'text/plain', // some browsers send CSV as text/plain
]);

// Memory storage — buffers are checked and then stored via storageService
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMIT_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (ALLOWED_DOCUMENT_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only PDF, JPEG, PNG, and WebP files are allowed.'), { statusCode: 400, code: 'INVALID_FILE_TYPE' }));
    }
  },
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_LIMIT_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const originalname = file.originalname.toLowerCase();
    const isExcel = ALLOWED_IMPORT_MIMES.has(file.mimetype)
      || originalname.endsWith('.xlsx')
      || originalname.endsWith('.xls')
      || originalname.endsWith('.csv');
    if (isExcel) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only .xlsx, .xls, and .csv files are allowed.'), { statusCode: 400, code: 'INVALID_FILE_TYPE' }));
    }
  },
});

module.exports = { documentUpload, importUpload };
