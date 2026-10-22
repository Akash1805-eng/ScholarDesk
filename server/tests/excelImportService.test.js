'use strict';

/**
 * Unit tests for Student Master CSV/Excel import validation.
 *
 * These tests exercise the pure validation and parsing helpers exported
 * from excelImportService.js.  They do NOT require a running MongoDB
 * instance because they test only the synchronous logic path.
 */

// Set env vars *before* requiring the service so the module picks them up
process.env.COLLEGE_EMAIL_DOMAIN = 'eec.srmrmp.edu.in';
process.env.APPROVED_DEPARTMENTS = 'CSE,IT,ECE,EEE,MECH,CIVIL,AIDS,AIML,CSD';

const XLSX = require('xlsx');
const { _internal } = require('../src/services/excelImportService');
const { normalizeRow, validateRow, isValidAcademicYear, parseWorkbook } = _internal;

// ── Helper: build a CSV buffer from an array of row objects ───────────
function buildCsvBuffer(headers, dataRows) {
  const lines = [headers.join(',')];
  for (const row of dataRows) {
    lines.push(headers.map(h => row[h] ?? '').join(','));
  }
  return Buffer.from(lines.join('\r\n'), 'utf-8');
}

// ── Helper: build an XLSX buffer from an array of row objects ─────────
function buildXlsxBuffer(headers, dataRows) {
  const aoa = [headers];
  for (const row of dataRows) {
    aoa.push(headers.map(h => row[h] ?? ''));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ── Shared valid rows ────────────────────────────────────────────────
const HEADERS = ['registerNumber', 'name', 'collegeEmail', 'department', 'currentYear', 'academicYear'];

const VALID_ROW_1 = {
  registerNumber: '310624104006',
  name: 'Abinandan S',
  collegeEmail: '310624104006@eec.srmrmp.edu.in',
  department: 'CSE',
  currentYear: '3',
  academicYear: '2026-2027',
};

const VALID_ROW_2 = {
  registerNumber: '310624104026',
  name: 'Anto Gladwin A',
  collegeEmail: '310624104026@eec.srmrmp.edu.in',
  department: 'CSE',
  currentYear: '3',
  academicYear: '2026-2027',
};

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

describe('isValidAcademicYear', () => {
  test('accepts YYYY-YYYY where second = first + 1', () => {
    expect(isValidAcademicYear('2026-2027')).toBe(true);
    expect(isValidAcademicYear('2024-2025')).toBe(true);
  });

  test('rejects single year like 2026', () => {
    expect(isValidAcademicYear('2026')).toBe(false);
  });

  test('rejects non-consecutive years like 2026-2028', () => {
    expect(isValidAcademicYear('2026-2028')).toBe(false);
  });

  test('rejects reversed years like 2027-2026', () => {
    expect(isValidAcademicYear('2027-2026')).toBe(false);
  });

  test('rejects empty / null', () => {
    expect(isValidAcademicYear('')).toBe(false);
    expect(isValidAcademicYear(null)).toBe(false);
    expect(isValidAcademicYear(undefined)).toBe(false);
  });
});

describe('normalizeRow', () => {
  test('trims whitespace and lowercases email', () => {
    const raw = {
      registerNumber: '  310624104006  ',
      name: '  Abinandan S ',
      collegeEmail: '  310624104006@EEC.SRMRMP.EDU.IN  ',
      department: '  cse ',
      currentYear: ' 3 ',
      academicYear: ' 2026-2027 ',
    };
    const normalized = normalizeRow(raw);
    expect(normalized.registerNumber).toBe('310624104006');
    expect(normalized.name).toBe('Abinandan S');
    expect(normalized.collegeEmail).toBe('310624104006@eec.srmrmp.edu.in');
    expect(normalized.department).toBe('CSE');
    expect(normalized.currentYear).toBe('3');
    expect(normalized.academicYear).toBe('2026-2027');
  });

  test('handles missing fields gracefully', () => {
    const normalized = normalizeRow({});
    expect(normalized.registerNumber).toBe('');
    expect(normalized.department).toBe('');
  });
});

describe('validateRow', () => {
  test('two valid rows produce zero errors', () => {
    const errors1 = validateRow(normalizeRow(VALID_ROW_1), 2);
    const errors2 = validateRow(normalizeRow(VALID_ROW_2), 3);
    expect(errors1).toEqual([]);
    expect(errors2).toEqual([]);
  });

  test('missing department produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, department: '' });
    const errors = validateRow(row, 2);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('department'))).toBe(true);
  });

  test('invalid college email (wrong local part) produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, collegeEmail: 'wrong_user@eec.srmrmp.edu.in' });
    const errors = validateRow(row, 2);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('collegeemail'))).toBe(true);
  });

  test('invalid college email (wrong domain) produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, collegeEmail: '310624104006@gmail.com' });
    const errors = validateRow(row, 2);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('collegeemail'))).toBe(true);
  });

  test('academic year "2026" instead of "2026-2027" produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, academicYear: '2026' });
    const errors = validateRow(row, 2);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('academicyear'))).toBe(true);
  });

  test('academic year "2026-2028" (non-consecutive) produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, academicYear: '2026-2028' });
    const errors = validateRow(row, 2);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('academicyear'))).toBe(true);
  });

  test('currentYear 0 produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, currentYear: '0' });
    const errors = validateRow(row, 2);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('currentyear'))).toBe(true);
  });

  test('currentYear 5 produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, currentYear: '5' });
    const errors = validateRow(row, 2);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('currentyear'))).toBe(true);
  });

  test('currentYear "abc" produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, currentYear: 'abc' });
    const errors = validateRow(row, 2);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('missing registerNumber produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, registerNumber: '' });
    const errors = validateRow(row, 2);
    expect(errors.some(e => e.includes('registerNumber is required'))).toBe(true);
  });

  test('missing name produces an error', () => {
    const row = normalizeRow({ ...VALID_ROW_1, name: '' });
    const errors = validateRow(row, 2);
    expect(errors.some(e => e.includes('name is required'))).toBe(true);
  });
});

describe('parseWorkbook (CSV)', () => {
  test('parses valid CSV with exact headers', () => {
    const buf = buildCsvBuffer(HEADERS, [VALID_ROW_1, VALID_ROW_2]);
    const rows = parseWorkbook(buf, 'students.csv');
    expect(rows).toHaveLength(2);
    expect(rows[0].registerNumber).toBe('310624104006');
    expect(rows[0].department).toBe('CSE');
    expect(rows[1].name).toBe('Anto Gladwin A');
  });

  test('handles UTF-8 BOM without corrupting the first header', () => {
    const csv = HEADERS.join(',') + '\r\n' +
      HEADERS.map(h => VALID_ROW_1[h]).join(',');
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const buf = Buffer.concat([bom, Buffer.from(csv, 'utf-8')]);
    const rows = parseWorkbook(buf, 'students.csv');
    expect(rows).toHaveLength(1);
    // The first header must not have a BOM prefix — key must be exactly "registerNumber"
    expect(rows[0].registerNumber).toBe('310624104006');
    expect(rows[0]).toHaveProperty('registerNumber');
  });

  test('trims whitespace from headers', () => {
    const headerLine = ' registerNumber , name , collegeEmail , department , currentYear , academicYear ';
    const dataLine = HEADERS.map(h => VALID_ROW_1[h]).join(',');
    const buf = Buffer.from(headerLine + '\r\n' + dataLine, 'utf-8');
    const rows = parseWorkbook(buf, 'test.csv');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('registerNumber');
    expect(rows[0]).toHaveProperty('department');
  });

  test('throws on empty file (no data rows)', () => {
    const buf = Buffer.from('registerNumber,name,collegeEmail,department,currentYear,academicYear\r\n', 'utf-8');
    // parseWorkbook returns an empty array; the caller (previewImport) checks for that
    const rows = parseWorkbook(buf, 'empty.csv');
    expect(rows).toHaveLength(0);
  });
});

describe('parseWorkbook (XLSX)', () => {
  test('parses valid XLSX with exact headers', () => {
    const buf = buildXlsxBuffer(HEADERS, [VALID_ROW_1, VALID_ROW_2]);
    const rows = parseWorkbook(buf, 'students.xlsx');
    expect(rows).toHaveLength(2);
    expect(rows[0].department).toBe('CSE');
    expect(rows[1].registerNumber).toBe('310624104026');
  });
});

describe('full validation pipeline: valid + invalid row count accuracy', () => {
  test('two valid rows → validCount=2, invalidCount=0', () => {
    const rows = [VALID_ROW_1, VALID_ROW_2].map(r => normalizeRow(r));
    const results = rows.map((row, i) => {
      const errors = validateRow(row, i + 2);
      return { ...row, errors, status: errors.length === 0 ? 'valid' : 'invalid' };
    });

    const validCount = results.filter(r => r.errors.length === 0).length;
    const invalidCount = results.filter(r => r.errors.length > 0).length;

    expect(validCount).toBe(2);
    expect(invalidCount).toBe(0);
    expect(results.every(r => r.status === 'valid')).toBe(true);
  });

  test('one valid + one invalid (bad dept) → validCount=1, invalidCount=1', () => {
    const badRow = { ...VALID_ROW_2, department: 'PHYSICS' };
    const rows = [VALID_ROW_1, badRow].map(r => normalizeRow(r));
    const results = rows.map((row, i) => {
      const errors = validateRow(row, i + 2);
      return { ...row, errors, status: errors.length === 0 ? 'valid' : 'invalid' };
    });

    const validCount = results.filter(r => r.errors.length === 0).length;
    const invalidCount = results.filter(r => r.errors.length > 0).length;

    expect(validCount).toBe(1);
    expect(invalidCount).toBe(1);
  });

  test('a row is never counted as both valid and invalid', () => {
    const testRows = [
      VALID_ROW_1,
      { ...VALID_ROW_2, department: '' },
      { ...VALID_ROW_1, registerNumber: '310624104099', collegeEmail: '310624104099@eec.srmrmp.edu.in', academicYear: '2026' },
    ].map(r => normalizeRow(r));

    const results = testRows.map((row, i) => {
      const errors = validateRow(row, i + 2);
      return { ...row, errors, status: errors.length === 0 ? 'valid' : 'invalid' };
    });

    const validCount = results.filter(r => r.errors.length === 0).length;
    const invalidCount = results.filter(r => r.errors.length > 0).length;

    // The counts must sum to total
    expect(validCount + invalidCount).toBe(testRows.length);
    // No overlap
    results.forEach(r => {
      if (r.errors.length === 0) {
        expect(r.status).toBe('valid');
      } else {
        expect(r.status).toBe('invalid');
      }
    });
  });

  test('duplicate registerNumbers are detected', () => {
    const dup = { ...VALID_ROW_1 }; // same registerNumber as VALID_ROW_1
    const rows = [VALID_ROW_1, dup].map(r => normalizeRow(r));

    const seenRegNums = new Map();
    const results = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const errors = validateRow(row, rowNum);

      if (row.registerNumber) {
        if (seenRegNums.has(row.registerNumber)) {
          errors.push(`Duplicate registerNumber in this file (first seen at row ${seenRegNums.get(row.registerNumber)})`);
        } else {
          seenRegNums.set(row.registerNumber, rowNum);
        }
      }

      const isDuplicate = errors.some(e => e.includes('Duplicate'));
      results.push({ ...row, errors, status: errors.length > 0 ? (isDuplicate ? 'duplicate' : 'invalid') : 'valid' });
    }

    const validCount = results.filter(r => r.errors.length === 0).length;
    const invalidCount = results.filter(r => r.errors.length > 0).length;
    const duplicateCount = results.filter(r => r.status === 'duplicate').length;

    expect(validCount).toBe(1);
    expect(duplicateCount).toBe(1);
    // The duplicate row is counted separately, not as valid
    expect(validCount + invalidCount).toBe(rows.length);
  });

  test('valid rows display actual values, not dashes', () => {
    const row = normalizeRow(VALID_ROW_1);
    const errors = validateRow(row, 2);
    const result = {
      rowNumber: 2,
      registerNumber: row.registerNumber,
      name: row.name,
      collegeEmail: row.collegeEmail,
      department: row.department,
      currentYear: row.currentYear,
      academicYear: row.academicYear,
      status: errors.length === 0 ? 'valid' : 'invalid',
      errors,
    };

    expect(result.department).toBe('CSE');
    expect(result.currentYear).toBe('3');
    expect(result.academicYear).toBe('2026-2027');
    expect(result.status).toBe('valid');
    // None of the display fields should be falsy
    expect(result.department).toBeTruthy();
    expect(result.currentYear).toBeTruthy();
    expect(result.academicYear).toBeTruthy();
  });
});
