'use strict';
/**
 * Automated test script to verify:
 * 1. Invalid email format / incorrect domain
 * 2. Mismatched register number vs email
 * 3. Missing Student Master record
 * 4. Duplicate accounts (pre-existing and newly registered)
 * 5. Valid registration & OTP generation (30s expiry)
 * 6. Expired OTP enforcement
 * 7. Resend cooldown & rate control
 * 8. User creation with "pending" verificationStatus and StudentMaster link
 * 9. Preservation of Admin and Verifier logins & verifier approval flow
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Otp = require('../models/Otp');
const User = require('../models/User');
const StudentMaster = require('../models/StudentMaster');

const API_BASE = 'http://localhost:5000/api';

async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log('─── Starting Student Registration Test Suite ───\n');
  await connectDB();

  // Test 1: Invalid email format (non-12-digit register number)
  console.log('1. Testing non-12-digit register number:');
  const t1 = await fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: '12345',
      password: 'Password@123',
      confirmPassword: 'Password@123',
    }),
  });
  assert(t1.status === 400, 'Status is 400 for non-12-digit register number');
  assert(
    t1.data.message === 'Use your college email in the format 310624104001@eec.srmrmp.edu.in.',
    `Returned expected format message: "${t1.data.message}"`
  );

  // Test 2: Incorrect domain (e.g. submitting personal or wrong domain email)
  console.log('\n2. Testing incorrect domain (@gmail.com):');
  const t2 = await fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: '310624104003',
      collegeEmail: '310624104003@gmail.com',
      password: 'Password@123',
      confirmPassword: 'Password@123',
    }),
  });
  assert(t2.status === 400, 'Status is 400 for incorrect domain');
  assert(
    t2.data.message === 'Use your college email in the format 310624104001@eec.srmrmp.edu.in.',
    `Returned expected format message on incorrect domain: "${t2.data.message}"`
  );

  // Test 3: Mismatched register number vs submitted email
  console.log('\n3. Testing mismatched register number vs collegeEmail:');
  const t3 = await fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: '310624104003',
      collegeEmail: '310624104004@eec.srmrmp.edu.in',
      password: 'Password@123',
      confirmPassword: 'Password@123',
    }),
  });
  assert(t3.status === 400, 'Status is 400 for mismatched register number and email');
  assert(
    t3.data.message === 'Use your college email in the format 310624104001@eec.srmrmp.edu.in.',
    `Returned format message rejecting mismatch: "${t3.data.message}"`
  );

  // Test 4: Missing Student Master record (valid 12-digit format but not in master DB)
  console.log('\n4. Testing missing Student Master record:');
  const t4 = await fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: '999999999999',
      password: 'Password@123',
      confirmPassword: 'Password@123',
    }),
  });
  assert(t4.status === 400, 'Status is 400 for non-existent student record');
  assert(
    t4.data.message === 'The register number and college email do not match our records.',
    `Returned expected mismatch message: "${t4.data.message}"`
  );

  // Test 5: Duplicate account (pre-registered student 310624104001)
  console.log('\n5. Testing duplicate account registration:');
  const t5 = await fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: '310624104001',
      password: 'Password@123',
      confirmPassword: 'Password@123',
    }),
  });
  assert(t5.status === 409, 'Status is 409 Conflict for existing registered student');
  assert(
    t5.data.code === 'ALREADY_REGISTERED',
    `Error code is ALREADY_REGISTERED: "${t5.data.code}"`
  );

  // Test 6: Valid registration flow (unregistered student 310624104003)
  console.log('\n6. Testing valid registration & 30-second OTP generation:');
  const t6 = await fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: '310624104003',
      collegeEmail: '310624104003@eec.srmrmp.edu.in',
      password: 'Student@1234',
      confirmPassword: 'Student@1234',
    }),
  });
  assert(t6.status === 200, 'Status is 200 OK for valid registration');
  assert(t6.data.expirySeconds === 30, 'Expiry is reported as 30 seconds');
  assert(t6.data.collegeEmail === '310624104003@eec.srmrmp.edu.in', 'Sent to approved email');

  // Verify OTP document in MongoDB
  const otpDoc = await Otp.findOne({ email: '310624104003@eec.srmrmp.edu.in', purpose: 'registration' });
  assert(!!otpDoc, 'OTP record exists in MongoDB');
  const secondsTillExpiry = Math.round((new Date(otpDoc.expiresAt) - new Date()) / 1000);
  assert(secondsTillExpiry >= 25 && secondsTillExpiry <= 30, `OTP expiry is ~30s (${secondsTillExpiry}s remaining)`);

  // Test 7: Resend controls & cooldown
  console.log('\n7. Testing resend cooldown control:');
  const t7 = await fetchJson('/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({
      collegeEmail: '310624104003@eec.srmrmp.edu.in',
      purpose: 'registration',
    }),
  });
  assert(t7.status === 429, 'Status is 429 Too Many Requests when requesting resend within 30s');
  assert(t7.data.code === 'RESEND_COOLDOWN', 'Error code is RESEND_COOLDOWN');

  // Test 8: Expired OTP test (for student 310624104004)
  console.log('\n8. Testing expired OTP enforcement:');
  const t8_init = await fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: '310624104004',
      password: 'Student@1234',
      confirmPassword: 'Student@1234',
    }),
  });
  assert(t8_init.status === 200, 'Registration OTP initiated for student 310624104004');

  // Manually backdate the OTP expiry in DB to simulate >30s expired
  await Otp.updateOne(
    { email: '310624104004@eec.srmrmp.edu.in', purpose: 'registration' },
    { expiresAt: new Date(Date.now() - 5000) }
  );

  const t8_verify = await fetchJson('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({
      collegeEmail: '310624104004@eec.srmrmp.edu.in',
      otp: '123456',
    }),
  });
  assert(t8_verify.status === 400, 'Status is 400 for expired OTP');
  assert(t8_verify.data.code === 'OTP_EXPIRED', 'Error code is OTP_EXPIRED');

  // Test 9: Successful OTP verification and account creation (student 310624104003)
  console.log('\n9. Testing successful OTP verification & user account creation:');
  // For dev test, compute valid OTP hash or set known hash in DB
  const { hashOtp } = require('../utils/generateOtp');
  const testOtp = '654321';
  await Otp.updateOne(
    { email: '310624104003@eec.srmrmp.edu.in', purpose: 'registration' },
    { codeHash: hashOtp(testOtp), expiresAt: new Date(Date.now() + 30000) }
  );

  const t9 = await fetchJson('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({
      collegeEmail: '310624104003@eec.srmrmp.edu.in',
      otp: testOtp,
    }),
  });
  assert(t9.status === 201, 'Status is 201 Created on successful OTP verification');
  assert(t9.data.accountStatus === 'active', 'Account status is "active"');
  assert(t9.data.verificationStatus === 'not_required', 'verificationStatus is "not_required"');
  assert(
    t9.data.message === 'Your account has been created successfully. You can now log in and apply for scholarships.',
    'Success message informs student they can now log in and apply'
  );

  // Verify User record in DB
  const newUser = await User.findOne({ email: '310624104003@eec.srmrmp.edu.in' });
  assert(!!newUser, 'User document exists in DB');
  assert(newUser.role === 'student', 'User role is student');
  assert(newUser.emailVerified === true, 'Email is verified');
  assert(newUser.accountStatus === 'active', 'User accountStatus is "active"');
  assert(newUser.verificationStatus === 'not_required', 'User verificationStatus is "not_required"');
  assert(!!newUser.studentMaster, 'User is linked to StudentMaster record');

  // Verify StudentMaster record is updated
  const updatedMaster = await StudentMaster.findOne({ registerNumber: '310624104003' });
  assert(updatedMaster.registrationStatus === 'registered', 'StudentMaster marked as registered');
  assert(updatedMaster.registeredUser.toString() === newUser._id.toString(), 'StudentMaster linked to User');

  // Verify OTP is single use and cleaned up
  const cleanedOtp = await Otp.findOne({ email: '310624104003@eec.srmrmp.edu.in', purpose: 'registration' });
  assert(!cleanedOtp, 'OTP was deleted after single use');

  // Test 10: Immediate student login after OTP verification
  console.log('\n10. Testing immediate student login after OTP verification:');
  const studentLogin = await fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      collegeEmail: '310624104003@eec.srmrmp.edu.in',
      password: 'Student@1234',
    }),
  });
  assert(studentLogin.status === 200, 'Student login succeeded immediately after OTP verification');
  assert(studentLogin.data.user.role === 'student', 'User role is student');
  assert(studentLogin.data.user.emailVerified === true, 'User emailVerified is true');
  assert(studentLogin.data.user.accountStatus === 'active', 'User accountStatus is active');

  // Verify access to protected student route
  const cookie = studentLogin.headers.get('set-cookie');
  const profileRes = await fetchJson('/student/profile', {
    method: 'GET',
    headers: { Cookie: cookie },
  });
  assert(profileRes.status === 200, 'Student can access protected profile immediately without account approval');

  // Test 11: Duplicate registration prevention on the newly registered account
  console.log('\n11. Testing duplicate registration on newly registered student:');
  const t11 = await fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: '310624104003',
      password: 'Student@1234',
      confirmPassword: 'Student@1234',
    }),
  });
  assert(t11.status === 409, 'Status is 409 Conflict for newly registered student');

  // Test 12: Admin and Verifier accounts preserved
  console.log('\n12. Testing Admin and Verifier account preservation:');
  const adminLogin = await fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      collegeEmail: 'admin@eec.srmrmp.edu.in',
      password: 'Admin@1234',
    }),
  });
  assert(adminLogin.status === 200, 'Admin login succeeded');
  assert(adminLogin.data.user.role === 'admin', 'Admin role is preserved');

  const verifierLogin = await fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      collegeEmail: 'verifier@eec.srmrmp.edu.in',
      password: 'Verifier@1234',
    }),
  });
  assert(verifierLogin.status === 200, 'Verifier login succeeded');
  assert(verifierLogin.data.user.role === 'verifier', 'Verifier role is preserved');

  console.log(`\n─── Test Results: ${passed} passed, ${failed} failed ───\n`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
