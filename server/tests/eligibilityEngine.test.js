'use strict';
const { evaluateEligibility, buildStudentData } = require('../src/utils/eligibilityEngine');

describe('Eligibility Engine Unit Tests', () => {
  const sampleMaster = {
    registerNumber: 'DEMO2026001',
    name: 'Test Student',
    department: 'CSE',
    currentYear: 3,
    academicYear: '2026-2027',
  };

  const sampleProfile = {
    cgpa: 8.5,
    percentage: 85,
    familyIncome: 180000,
    category: 'BC',
    gender: 'Female',
    isFirstGraduate: true,
    hasDisability: false,
  };

  test('student is eligible when all criteria pass', () => {
    const scholarship = {
      title: 'Merit-Cum-Means',
      eligibilityCriteria: [
        { field: 'department', operator: '==', value: 'CSE' },
        { field: 'currentYear', operator: '<=', value: 3 },
        { field: 'cgpa', operator: '>=', value: 7.5 },
        { field: 'familyIncome', operator: '<=', value: 250000 },
        { field: 'category', operator: 'in', value: ['BC', 'MBC', 'SC', 'ST'] },
      ],
    };

    const result = evaluateEligibility(scholarship, sampleMaster, sampleProfile);
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.missingFields).toHaveLength(0);
  });

  test('supports alias operators like gte, lte, eq', () => {
    const scholarship = {
      title: 'Alias Test Scholarship',
      eligibilityCriteria: [
        { field: 'currentCgpa', operator: 'gte', value: 8.0 },
        { field: 'annualIncome', operator: 'lte', value: 200000 },
        { field: 'department', operator: 'eq', value: 'CSE' },
      ],
    };

    const result = evaluateEligibility(scholarship, sampleMaster, sampleProfile);
    expect(result.eligible).toBe(true);
  });

  test('flags missing required fields on incomplete profile', () => {
    const incompleteProfile = {
      cgpa: 8.5,
      familyIncome: null, // missing!
      category: null,     // missing!
    };

    const scholarship = {
      title: 'Income-based Scholarship',
      eligibilityCriteria: [
        { field: 'familyIncome', operator: '<=', value: 150000 },
        { field: 'category', operator: '==', value: 'SC' },
      ],
    };

    const result = evaluateEligibility(scholarship, sampleMaster, incompleteProfile);
    expect(result.eligible).toBe(false);
    expect(result.missingFields).toContain('familyIncome');
    expect(result.missingFields).toContain('category');
  });

  test('correctly evaluates failing criteria with descriptive reason', () => {
    const scholarship = {
      title: 'High CGPA Scholarship',
      eligibilityCriteria: [
        { field: 'cgpa', operator: '>=', value: 9.0 },
      ],
    };

    const result = evaluateEligibility(scholarship, sampleMaster, sampleProfile);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0].explanation).toContain('at least');
  });
});
