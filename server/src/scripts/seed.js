'use strict';
/**
 * Development seed script — fictional data only.
 * DO NOT use with real student data or in production.
 *
 * Usage: node src/scripts/seed.js
 *
 * Creates:
 *   - 1 admin account
 *   - 1 verifier account
 *   - 5 Student Master records
 *   - 1 registered + pending student
 *   - 1 registered + approved student
 *   - 2 scholarships with eligibility rules
 *   - 1 submitted application
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/database');
const User = require('../models/User');
const StudentMaster = require('../models/StudentMaster');
const StudentProfile = require('../models/StudentProfile');
const Scholarship = require('../models/Scholarship');
const Application = require('../models/Application');

const DOMAIN = process.env.COLLEGE_EMAIL_DOMAIN || 'college.example';
const HASH = (pwd) => bcrypt.hash(pwd, 10);

async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    StudentMaster.deleteMany({}),
    StudentProfile.deleteMany({}),
    Scholarship.deleteMany({}),
    Application.deleteMany({}),
  ]);
  console.log('[seed] Cleared existing data.');
}

async function main() {
  await connectDB();
  await clearCollections();

  // ── Admin ──────────────────────────────────────────────────────────────────
  const admin = await User.create({
    email: `admin@${DOMAIN}`,
    passwordHash: await HASH('Admin@1234'),
    role: 'admin',
    emailVerified: true,
    verificationStatus: 'verified',
  });
  console.log(`[seed] Admin: admin@${DOMAIN} / Admin@1234`);

  // ── Verifier ───────────────────────────────────────────────────────────────
  const verifier = await User.create({
    email: `verifier@${DOMAIN}`,
    passwordHash: await HASH('Verifier@1234'),
    role: 'verifier',
    emailVerified: true,
    verificationStatus: 'verified',
    createdBy: admin._id,
  });
  console.log(`[seed] Verifier: verifier@${DOMAIN} / Verifier@1234`);

  // ── Student Master records ─────────────────────────────────────────────────
  const masters = await StudentMaster.create([
    {
      registerNumber: '310624104001',
      name: 'Priya Devi',
      collegeEmail: `310624104001@${DOMAIN}`,
      department: 'CSE',
      currentYear: 3,
      academicYear: '2026-2027',
    },
    {
      registerNumber: '310624104002',
      name: 'Arjun Kumar',
      collegeEmail: `310624104002@${DOMAIN}`,
      department: 'IT',
      currentYear: 2,
      academicYear: '2026-2027',
    },
    {
      registerNumber: '310624104003',
      name: 'Kavya Nair',
      collegeEmail: `310624104003@${DOMAIN}`,
      department: 'ECE',
      currentYear: 4,
      academicYear: '2026-2027',
    },
    {
      registerNumber: '310624104004',
      name: 'Rahul Patel',
      collegeEmail: `310624104004@${DOMAIN}`,
      department: 'CSE',
      currentYear: 1,
      academicYear: '2026-2027',
    },
    {
      registerNumber: '310624104005',
      name: 'Ananya Sharma',
      collegeEmail: `310624104005@${DOMAIN}`,
      department: 'MECH',
      currentYear: 2,
      academicYear: '2026-2027',
    },
  ]);
  console.log(`[seed] ${masters.length} Student Master records created.`);

  // ── Pending student (registered but not yet approved) ──────────────────────
  const pendingUser = await User.create({
    email: `310624104001@${DOMAIN}`,
    passwordHash: await HASH('Student@1234'),
    role: 'student',
    emailVerified: true,
    verificationStatus: 'pending',
    studentMaster: masters[0]._id,
  });
  masters[0].registrationStatus = 'registered';
  masters[0].registeredUser = pendingUser._id;
  await masters[0].save();
  await StudentProfile.create({ student: pendingUser._id });
  console.log(`[seed] Pending student: 310624104001@${DOMAIN} / Student@1234`);

  // ── Approved student with full profile ────────────────────────────────────
  const approvedUser = await User.create({
    email: `310624104002@${DOMAIN}`,
    passwordHash: await HASH('Student@1234'),
    role: 'student',
    emailVerified: true,
    verificationStatus: 'verified',
    studentMaster: masters[1]._id,
  });
  masters[1].registrationStatus = 'registered';
  masters[1].registeredUser = approvedUser._id;
  await masters[1].save();
  await StudentProfile.create({
    student: approvedUser._id,
    cgpa: 8.5,
    percentage: 85,
    familyIncome: 200000,
    category: 'BC',
    gender: 'Male',
    isFirstGraduate: true,
    hasDisability: false,
    phone: '9876543210',
    address: { line1: '12 Main Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
    bankDetails: { accountNumber: '1234567890', ifscCode: 'SBIN0001234', bankName: 'SBI', accountHolderName: 'Arjun Kumar' },
  });
  console.log(`[seed] Approved student: 310624104002@${DOMAIN} / Student@1234`);

  // ── Scholarships ───────────────────────────────────────────────────────────
  const merit = await Scholarship.create({
    title: 'Merit Scholarship 2026-27',
    description: 'Awarded to students with high academic performance and limited family income.',
    academicYear: '2026-2027',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    awardAmount: 50000,
    requiredDocuments: ['marksheet', 'income_certificate', 'bank_evidence'],
    eligibilityCriteria: [
      { field: 'cgpa', operator: '>=', value: 8, description: 'Minimum CGPA of 8.0' },
      { field: 'familyIncome', operator: '<=', value: 250000, description: 'Annual family income ≤ ₹2.5 lakh' },
      { field: 'currentYear', operator: 'in', value: [2, 3, 4], description: 'Year 2 to 4 only' },
    ],
    customQuestions: [
      {
        key: 'achievements',
        label: 'List any academic achievements or awards received.',
        type: 'textarea',
        required: false,
        helpText: 'Optional: competitions, certifications, ranks, etc.',
      },
    ],
    createdBy: admin._id,
  });

  const firstGrad = await Scholarship.create({
    title: 'First Graduate Scholarship 2026-27',
    description: 'Supporting students who are the first in their family to attend college.',
    academicYear: '2026-2027',
    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    awardAmount: 30000,
    requiredDocuments: ['income_certificate', 'first_graduate_certificate', 'bank_evidence'],
    eligibilityCriteria: [
      { field: 'isFirstGraduate', operator: '==', value: true, description: 'First graduate in family' },
      { field: 'familyIncome', operator: '<=', value: 300000, description: 'Annual family income ≤ ₹3 lakh' },
    ],
    createdBy: admin._id,
  });

  console.log(`[seed] Created ${2} scholarships.`);

  // ── A submitted application from the approved student ─────────────────────
  await Application.create({
    student: approvedUser._id,
    scholarship: merit._id,
    academicYear: '2026-2027',
    status: 'submitted',
    officialSnapshot: {
      registerNumber: masters[1].registerNumber,
      name: masters[1].name,
      collegeEmail: masters[1].collegeEmail,
      department: masters[1].department,
      currentYear: masters[1].currentYear,
      academicYear: masters[1].academicYear,
    },
    profileSnapshot: {
      cgpa: 8.5,
      familyIncome: 200000,
      category: 'BC',
      gender: 'Male',
      isFirstGraduate: true,
    },
    scholarshipSnapshot: {
      title: merit.title,
      rulesVersion: merit.rulesVersion,
      eligibilityCriteria: merit.eligibilityCriteria,
    },
    customAnswers: { achievements: 'State-level coding competition runner-up.' },
    submittedAt: new Date(),
  });

  console.log(`[seed] Created 1 submitted application.`);

  console.log('\n[seed] ✔ Seed complete. Do not use this data in production.\n');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
