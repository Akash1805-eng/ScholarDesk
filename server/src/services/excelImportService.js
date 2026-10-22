'use strict';
/**
 * Excel/CSV Import Service for Student Master.
 *
 * Uses SheetJS (xlsx) from the official CDN package.
 * Install: npm install xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
 *
 * Process:
 *   1. previewImport()  — parse, validate, detect duplicates, store preview
 *   2. commitImport()   — re-validate, save valid rows, return results
 */

const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const StudentMaster = require('../models/StudentMaster');
const ImportHistory = require('../models/ImportHistory');

const IMPORT_ROW_LIMIT = parseInt(process.env.IMPORT_ROW_LIMIT || '5000', 10);
const COLLEGE_DOMAIN = process.env.COLLEGE_EMAIL_DOMAIN || 'college.example';
const APPROVED_DEPTS = (process.env.APPROVED_DEPARTMENTS || 'CSE,IT,ECE,EEE,MECH,CIVIL,AIDS,AIML,CSD')
  .split(',').map(d => d.trim().toUpperCase()).filter(Boolean);

const REQUIRED_COLUMNS = ['registerNumber', 'name', 'collegeEmail', 'department', 'currentYear', 'academicYear'];

// Academic year format: YYYY-YYYY where second is first+1
function isValidAcademicYear(val) {
  const match = String(val || '').match(/^(\d{4})-(\d{4})$/);
  if (!match) return false;
  return parseInt(match[2]) === parseInt(match[1]) + 1;
}

// Escape CSV special characters to prevent formula injection
function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseWorkbook(buffer, filename) {
  // Strip UTF-8 BOM if present
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    buffer = buffer.slice(3);
  }

  const opts = {
    type: 'buffer',
    cellDates: true,
    cellNF: false,
    cellFormula: false, // never evaluate formulas
    raw: false,
  };

  const wb = XLSX.read(buffer, opts);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw Object.assign(new Error('No worksheet found in file.'), { statusCode: 400, code: 'NO_WORKSHEET' });

  // Convert to array of objects using header row
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    defval: '',
    raw: false, // Always return formatted strings
  });

  // Trim header keys (handles stray whitespace / BOM remnants)
  return rows.map(row => {
    const cleaned = {};
    for (const [key, val] of Object.entries(row)) {
      cleaned[key.trim()] = val;
    }
    return cleaned;
  });
}

function normalizeRow(raw) {
  return {
    registerNumber: String(raw.registerNumber ?? '').trim(),
    name: String(raw.name ?? '').trim(),
    collegeEmail: String(raw.collegeEmail ?? '').trim().toLowerCase(),
    department: String(raw.department ?? '').trim().toUpperCase(),
    currentYear: String(raw.currentYear ?? '').trim(),
    academicYear: String(raw.academicYear ?? '').trim(),
  };
}

function validateRow(row, rowNum) {
  const errors = [];

  if (!row.registerNumber) errors.push('registerNumber is required');
  if (!row.name) errors.push('name is required');

  const expectedEmail = row.registerNumber
    ? `${row.registerNumber}@${COLLEGE_DOMAIN}`.toLowerCase()
    : null;

  if (!row.collegeEmail) {
    errors.push('collegeEmail is required');
  } else if (!row.collegeEmail.endsWith('@' + COLLEGE_DOMAIN)) {
    errors.push(`collegeEmail must end with @${COLLEGE_DOMAIN}`);
  } else if (expectedEmail && row.collegeEmail !== expectedEmail) {
    errors.push(`collegeEmail must be ${expectedEmail}`);
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.collegeEmail)) {
    errors.push('collegeEmail is not a valid email address');
  }

  if (!row.department) {
    errors.push('department is required');
  } else if (!APPROVED_DEPTS.includes(row.department)) {
    errors.push(`department "${row.department}" is not in the approved list: ${APPROVED_DEPTS.join(', ')}`);
  }

  const year = parseInt(row.currentYear, 10);
  if (!row.currentYear || isNaN(year) || year < 1 || year > 4 || !Number.isInteger(year)) {
    errors.push('currentYear must be an integer from 1 to 4');
  }

  if (!row.academicYear) {
    errors.push('academicYear is required');
  } else if (!isValidAcademicYear(row.academicYear)) {
    errors.push('academicYear must be in format YYYY-YYYY (e.g. 2026-2027) where second year = first + 1');
  }

  return errors;
}

/**
 * Stage 1: Parse and validate without writing to DB.
 * Saves an ImportHistory record with preview data.
 */
async function previewImport(buffer, filename, adminUserId) {
  let rawRows;
  try {
    rawRows = parseWorkbook(buffer, filename);
  } catch (err) {
    throw Object.assign(new Error(`Cannot parse file: ${err.message}`), { statusCode: 400, code: 'PARSE_ERROR' });
  }

  // Check required columns
  if (rawRows.length === 0) {
    throw Object.assign(new Error('File has no data rows.'), { statusCode: 400, code: 'EMPTY_FILE' });
  }

  const firstRowKeys = Object.keys(rawRows[0] || {});
  const missingCols = REQUIRED_COLUMNS.filter(c => !firstRowKeys.includes(c));
  if (missingCols.length > 0) {
    throw Object.assign(
      new Error(`Missing required columns: ${missingCols.join(', ')}`),
      { statusCode: 400, code: 'MISSING_COLUMNS' }
    );
  }

  if (rawRows.length > IMPORT_ROW_LIMIT) {
    throw Object.assign(
      new Error(`File exceeds the ${IMPORT_ROW_LIMIT}-row limit. Found ${rawRows.length} rows.`),
      { statusCode: 400, code: 'ROW_LIMIT_EXCEEDED' }
    );
  }

  // Validate all rows
  const rowResults = [];
  const seenRegNums = new Map();
  const seenEmails = new Map();
  let validCount = 0, invalidCount = 0, internalDupCount = 0;

  const normalizedRows = rawRows.map(r => normalizeRow(r));

  // First pass: validate and detect internal duplicates
  for (let i = 0; i < normalizedRows.length; i++) {
    const row = normalizedRows[i];
    const rowNum = i + 2; // 1-indexed + header row
    const errors = validateRow(row, rowNum);

    // Internal duplicate detection
    if (row.registerNumber) {
      if (seenRegNums.has(row.registerNumber)) {
        errors.push(`Duplicate registerNumber in this file (first seen at row ${seenRegNums.get(row.registerNumber)})`);
      } else {
        seenRegNums.set(row.registerNumber, rowNum);
      }
    }
    if (row.collegeEmail) {
      if (seenEmails.has(row.collegeEmail)) {
        errors.push(`Duplicate collegeEmail in this file (first seen at row ${seenEmails.get(row.collegeEmail)})`);
      } else {
        seenEmails.set(row.collegeEmail, rowNum);
      }
    }

    const isDuplicate = errors.some(e => e.includes('Duplicate'));
    const hasErrors = errors.length > 0;

    if (isDuplicate) internalDupCount++;
    if (hasErrors) invalidCount++;
    else validCount++;

    rowResults.push({
      rowNumber: rowNum,
      registerNumber: row.registerNumber,
      name: row.name,
      collegeEmail: row.collegeEmail,
      department: row.department,
      currentYear: row.currentYear,
      academicYear: row.academicYear,
      status: hasErrors ? (isDuplicate ? 'duplicate' : 'invalid') : 'valid',
      errors,
    });
  }

  // Second pass: check DB duplicates for valid rows
  const validRegNums = rowResults.filter(r => r.status === 'valid').map(r => r.registerNumber);
  const validEmails = rowResults.filter(r => r.status === 'valid').map(r => r.collegeEmail);

  const [dbRegDups, dbEmailDups] = await Promise.all([
    StudentMaster.find({ registerNumber: { $in: validRegNums } }).select('registerNumber').lean(),
    StudentMaster.find({ collegeEmail: { $in: validEmails } }).select('collegeEmail').lean(),
  ]);

  const dbRegSet = new Set(dbRegDups.map(d => d.registerNumber));
  const dbEmailSet = new Set(dbEmailDups.map(d => d.collegeEmail));
  let conflictCount = 0;

  for (const result of rowResults) {
    if (result.status === 'valid') {
      if (dbRegSet.has(result.registerNumber) || dbEmailSet.has(result.collegeEmail)) {
        result.status = 'conflict';
        result.errors.push('Already exists in the database. Will be skipped (use update mode to overwrite).');
        validCount--;
        conflictCount++;
      }
    }
  }

  const importId = uuidv4();

  await ImportHistory.create({
    importId,
    uploadedBy: adminUserId,
    originalFilename: filename,
    phase: 'preview',
    totalRows: rawRows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    duplicateRows: internalDupCount + conflictCount,
    rowResults,
  });

  return {
    importId,
    filename,
    totalRows: rawRows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    internalDuplicates: internalDupCount,
    conflicts: conflictCount,
    rowResults: rowResults.slice(0, 200), // return first 200 for preview
    totalRowResults: rowResults.length,
    message: `Preview complete. ${validCount} row(s) ready to import. Confirm with importId to proceed.`,
  };
}

/**
 * Stage 2: Commit previously previewed import.
 * Re-validates and saves valid rows.
 */
async function commitImport(importId, adminUserId) {
  const history = await ImportHistory.findOne({ importId, uploadedBy: adminUserId, phase: 'preview' });
  if (!history) {
    throw Object.assign(new Error('Import session not found or already committed.'), { statusCode: 404, code: 'IMPORT_NOT_FOUND' });
  }

  const validRows = history.rowResults.filter(r => r.status === 'valid');

  let importedCount = 0, skippedCount = 0, failedCount = 0;
  const finalResults = [];

  // Process in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      try {
        // Re-check for DB conflicts at commit time (retry-safe)
        const existing = await StudentMaster.findOne({
          $or: [{ registerNumber: row.registerNumber }, { collegeEmail: row.collegeEmail }],
        });

        if (existing) {
          skippedCount++;
          finalResults.push({ ...row, status: 'skipped', errors: ['Record already exists in database.'] });
          continue;
        }

        await StudentMaster.create({
          registerNumber: row.registerNumber,
          name: row.name,
          collegeEmail: row.collegeEmail,
          department: row.department,
          currentYear: parseInt(row.currentYear, 10),
          academicYear: row.academicYear,
          importId,
          lastModifiedBy: adminUserId,
        });
        importedCount++;
        finalResults.push({ ...row, status: 'imported', errors: [] });
      } catch (err) {
        failedCount++;
        finalResults.push({ ...row, status: 'failed', errors: [err.message] });
      }
    }
  }

  // Update ImportHistory record
  history.phase = 'committed';
  history.importedRows = importedCount;
  history.skippedRows = skippedCount;
  history.invalidRows = (history.invalidRows || 0) + failedCount;
  history.rowResults = finalResults;
  history.committedAt = new Date();
  await history.save();

  return {
    importId,
    importedCount,
    skippedCount,
    failedCount,
    totalProcessed: validRows.length,
    message: `Import complete. ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed.`,
    results: finalResults.filter(r => r.status !== 'imported').slice(0, 100), // only show non-imported rows
  };
}

module.exports = {
  previewImport,
  commitImport,
  // Exported for unit testing
  _internal: { parseWorkbook, normalizeRow, validateRow, isValidAcademicYear },
};
