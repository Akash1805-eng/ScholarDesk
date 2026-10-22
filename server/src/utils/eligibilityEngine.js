'use strict';
/**
 * Dynamic Scholarship Eligibility Engine
 *
 * Evaluates a student's eligibility against a scholarship's criteria array.
 * All criteria must pass (AND semantics).
 *
 * Supported operators: >=, <=, >, <, ==, !=, in
 * Allowlisted fields:  cgpa, percentage, familyIncome, category, gender,
 *                      isFirstGraduate, hasDisability, currentYear, department
 *
 * Missing values are never treated as 0 — they produce an explanation requiring
 * the student to complete their profile.
 */

const ALLOWED_FIELDS = new Set([
  'cgpa',
  'percentage',
  'familyIncome',
  'category',
  'gender',
  'isFirstGraduate',
  'hasDisability',
  'currentYear',
  'department',
]);

const FIELD_ALIASES = {
  annualIncome: 'familyIncome',
  currentCgpa: 'cgpa',
  marks10th: 'percentage',
  marks12th: 'percentage',
};

const OPERATOR_ALIASES = {
  gte: '>=',
  lte: '<=',
  gt: '>',
  lt: '<',
  eq: '==',
  neq: '!=',
};

const NUMERIC_OPERATORS = new Set(['>=', '<=', '>', '<']);
const EQUALITY_OPERATORS = new Set(['==', '!=']);
const MEMBERSHIP_OPERATORS = new Set(['in']);

/**
 * Build a merged data object from official Student Master record and student profile.
 * Official fields always take precedence.
 */
function buildStudentData(studentMaster, studentProfile) {
  return {
    // Official (from StudentMaster — read-only)
    currentYear: studentMaster?.currentYear,
    department: studentMaster?.department,
    academicYear: studentMaster?.academicYear,
    // Profile (student-editable)
    cgpa: studentProfile?.cgpa ?? null,
    percentage: studentProfile?.percentage ?? null,
    familyIncome: studentProfile?.familyIncome ?? null,
    category: studentProfile?.category ?? null,
    gender: studentProfile?.gender ?? null,
    isFirstGraduate: studentProfile?.isFirstGraduate ?? null,
    hasDisability: studentProfile?.hasDisability ?? null,
  };
}

/**
 * Evaluate a single criterion against a student data object.
 * Returns { pass: boolean, explanation: string, actualValue, requiredValue }
 */
function evaluateCriterion(criterion, studentData) {
  let { field, operator, value: requiredValue } = criterion;

  if (FIELD_ALIASES[field]) field = FIELD_ALIASES[field];
  if (OPERATOR_ALIASES[operator]) operator = OPERATOR_ALIASES[operator];

  if (!ALLOWED_FIELDS.has(field)) {
    return {
      pass: false,
      field,
      operator,
      requiredValue,
      actualValue: undefined,
      explanation: `Unknown eligibility field: "${field}".`,
    };
  }

  const actualValue = studentData[field];

  // Missing value — student must complete their profile
  if (actualValue === null || actualValue === undefined) {
    return {
      pass: false,
      field,
      operator,
      requiredValue,
      actualValue: null,
      isMissingField: true,
      explanation: `Please complete your profile: "${fieldLabel(field)}" is required for this scholarship.`,
    };
  }

  let pass = false;
  let explanation = '';

  if (NUMERIC_OPERATORS.has(operator)) {
    const actual = Number(actualValue);
    const required = Number(requiredValue);
    if (isNaN(actual) || isNaN(required)) {
      return {
        pass: false, field, operator, requiredValue, actualValue,
        explanation: `Cannot compare "${fieldLabel(field)}": non-numeric value.`,
      };
    }
    switch (operator) {
      case '>=': pass = actual >= required; break;
      case '<=': pass = actual <= required; break;
      case '>':  pass = actual >  required; break;
      case '<':  pass = actual <  required; break;
    }
    if (!pass) {
      explanation = buildNumericExplanation(field, operator, required, actual);
    }
  } else if (EQUALITY_OPERATORS.has(operator)) {
    const actual = String(actualValue).toLowerCase();
    const required = String(requiredValue).toLowerCase();
    pass = operator === '==' ? actual === required : actual !== required;
    if (!pass) {
      explanation = `Required ${fieldLabel(field)}: ${requiredValue}. Your value: ${actualValue}.`;
    }
  } else if (MEMBERSHIP_OPERATORS.has(operator)) {
    if (!Array.isArray(requiredValue)) {
      return {
        pass: false, field, operator, requiredValue, actualValue,
        explanation: `"in" operator requires a list of allowed values.`,
      };
    }
    const normalizedAllowed = requiredValue.map(v =>
      typeof v === 'string' ? v.toLowerCase() : v
    );
    const normalizedActual = typeof actualValue === 'string'
      ? actualValue.toLowerCase()
      : actualValue;
    pass = normalizedAllowed.includes(normalizedActual);
    if (!pass) {
      explanation = `Required ${fieldLabel(field)} to be one of: [${requiredValue.join(', ')}]. Your value: ${actualValue}.`;
    }
  } else {
    return {
      pass: false, field, operator, requiredValue, actualValue,
      explanation: `Unsupported operator: "${operator}".`,
    };
  }

  return { pass, field, operator, requiredValue, actualValue, explanation };
}

/**
 * Evaluate all criteria for a scholarship against a student's combined data.
 * @returns {{ eligible: boolean, reasons: Array, missingFields: string[] }}
 */
function evaluateEligibility(scholarship, studentMaster, studentProfile) {
  const criteria = scholarship.eligibilityCriteria || [];
  if (criteria.length === 0) {
    return { eligible: true, reasons: [], missingFields: [] };
  }

  const studentData = buildStudentData(studentMaster, studentProfile);
  const reasons = [];
  const missingFields = [];

  for (const criterion of criteria) {
    const result = evaluateCriterion(criterion, studentData);
    if (!result.pass) {
      reasons.push(result);
      if (result.isMissingField) {
        missingFields.push(result.field);
      }
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    missingFields,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  cgpa: 'CGPA',
  percentage: 'Percentage',
  familyIncome: 'Annual Family Income',
  category: 'Category',
  gender: 'Gender',
  isFirstGraduate: 'First Graduate Status',
  hasDisability: 'Disability Status',
  currentYear: 'Current Year of Study',
  department: 'Department',
};

function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

function buildNumericExplanation(field, operator, required, actual) {
  const label = fieldLabel(field);
  const opLabel = { '>=': 'at least', '<=': 'at most', '>': 'greater than', '<': 'less than' }[operator] || operator;
  const formatVal = (v) => field === 'familyIncome' ? `₹${Number(v).toLocaleString('en-IN')}` : v;
  return `Required ${label}: ${opLabel} ${formatVal(required)}. Your ${label}: ${formatVal(actual)}.`;
}

module.exports = { evaluateEligibility, buildStudentData, ALLOWED_FIELDS };
