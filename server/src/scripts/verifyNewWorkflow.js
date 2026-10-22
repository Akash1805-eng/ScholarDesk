'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const StudentMaster = require('../models/StudentMaster');
const StudentProfile = require('../models/StudentProfile');
const Scholarship = require('../models/Scholarship');
const Application = require('../models/Application');
const Otp = require('../models/Otp');

const BASE_URL = 'http://localhost:5000/api';

async function fetchJson(url, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${BASE_URL}${url}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

async function run() {
  console.log('=== Verifying New Student Account & Application Workflow ===\n');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scholarship_management');

  const regNum = '310624104026';
  const email = '310624104026@eec.srmrmp.edu.in';
  const password = 'StudentPassword@123';

  // 1. Clean up any existing records for this student
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    await Application.deleteMany({ student: existingUser._id });
    await StudentProfile.deleteOne({ student: existingUser._id });
    await User.deleteOne({ _id: existingUser._id });
  }
  await Otp.deleteMany({ email });
  await StudentMaster.updateOne(
    { registerNumber: regNum },
    { registrationStatus: 'unclaimed', registeredUser: null }
  );

  // Verify StudentMaster exists
  let master = await StudentMaster.findOne({ registerNumber: regNum });
  if (!master) {
    master = await StudentMaster.create({
      registerNumber: regNum,
      name: 'Anto Gladwin A',
      collegeEmail: email,
      department: 'CSE',
      currentYear: 3,
      academicYear: '2026-2027',
      registrationStatus: 'unclaimed',
      studentStatus: 'active',
    });
  }

  // Ensure an admin and scholarship exist
  const admin = await User.findOne({ role: 'admin' });
  let scholarship = await Scholarship.findOne({ status: 'active' });
  if (!scholarship) {
    scholarship = await Scholarship.create({
      title: 'Post-Matric Merit Scholarship 2026-27',
      description: 'Annual scholarship for engineering students.',
      academicYear: '2026-2027',
      deadline: new Date(Date.now() + 30 * 86400000),
      awardAmount: 45000,
      status: 'active',
      requiredDocuments: [],
      eligibilityCriteria: [],
      createdBy: admin ? admin._id : (await User.create({ email: 'admin_temp@eec.srmrmp.edu.in', passwordHash: 'hash', role: 'admin' }))._id,
    });
  }

  // 2. Register (request OTP)
  console.log('1. Registering student with valid college email:');
  const regRes = await fetchJson('/auth/register/request-otp', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: regNum,
      collegeEmail: email,
      password,
      confirmPassword: password,
    }),
  });
  console.log(`   Response status: ${regRes.status}`, regRes.data);
  if (regRes.status !== 200) throw new Error('Registration OTP request failed');

  // 3. Verify OTP
  console.log('\n2. Verifying OTP:');
  const otpDoc = await Otp.findOne({ email, purpose: 'registration' }).select('+codeHash');
  if (!otpDoc) throw new Error('OTP not created in DB');

  // Set known OTP for verification test
  const { hashOtp } = require('../utils/generateOtp');
  const testOtp = '819273';
  otpDoc.codeHash = hashOtp(testOtp);
  await otpDoc.save();

  const verifyRes = await fetchJson('/auth/register/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ collegeEmail: email, otp: testOtp }),
  });
  console.log(`   Response status: ${verifyRes.status}`, verifyRes.data);

  if (verifyRes.status !== 201) throw new Error('OTP verification failed');
  if (verifyRes.data.accountStatus !== 'active') throw new Error(`accountStatus is not active: ${verifyRes.data.accountStatus}`);
  if (verifyRes.data.verificationStatus !== 'not_required') throw new Error(`verificationStatus is not not_required: ${verifyRes.data.verificationStatus}`);
  console.log('   ✔ Account created with emailVerified: true, accountStatus: "active", verificationStatus: "not_required"');
  console.log(`   ✔ Message: "${verifyRes.data.message}"`);

  // 4. Log in immediately
  console.log('\n3. Logging in immediately:');
  const loginRes = await fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ collegeEmail: email, password }),
  });
  console.log(`   Response status: ${loginRes.status}`, loginRes.data);
  if (loginRes.status !== 200) throw new Error('Login failed');
  console.log('   ✔ Immediate login succeeded without pending-approval blockage');

  const cookie = loginRes.headers.get('set-cookie');

  // 5. Confirm dashboard / profile access
  console.log('\n4. Confirming student dashboard / profile access:');
  const profileRes = await fetchJson('/students/profile', {
    method: 'GET',
    headers: { Cookie: cookie },
  });
  console.log(`   Profile access status: ${profileRes.status}`, profileRes.data.success ? '✔ Success' : profileRes.data);
  if (profileRes.status !== 200) throw new Error('Profile access blocked');

  // Populate basic profile data so application can be submitted
  await StudentProfile.updateOne(
    { student: verifyRes.data.user?._id || (await User.findOne({ email }))._id },
    {
      cgpa: 8.5,
      annualIncome: 250000,
      gender: 'male',
      category: 'OBC',
      firstGraduate: false,
      differentlyAbled: false,
      mobile: '9876543210',
    }
  );

  // 6. Submit scholarship application
  console.log('\n5. Submitting scholarship application:');
  const appRes = await fetchJson('/applications', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: JSON.stringify({
      scholarshipId: scholarship._id.toString(),
      confirmed: true,
      customAnswers: [],
    }),
  });
  console.log(`   Application submission status: ${appRes.status}`, appRes.data);
  if (appRes.status !== 201) throw new Error('Application submission failed');
  const applicationId = appRes.data.application?._id;
  console.log('   ✔ Scholarship application submitted successfully. Application status:', appRes.data.application?.status);

  // 7. Confirm verifier reviews only the scholarship application
  console.log('\n6. Confirming verifier reviews only the scholarship application:');
  // Log in as verifier
  const verifierLogin = await fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      collegeEmail: 'verifier@eec.srmrmp.edu.in',
      password: 'Verifier@1234',
    }),
  });
  const verifierCookie = verifierLogin.headers.get('set-cookie');

  // Fetch applications queue
  const appQueueRes = await fetchJson('/verifier/applications?status=submitted', {
    headers: { Cookie: verifierCookie },
  });
  const inQueue = appQueueRes.data.applications?.some(a => a._id.toString() === applicationId.toString());
  console.log(`   Application found in verifier review queue: ${inQueue ? '✔ YES' : '✖ NO'}`);
  if (!inQueue) throw new Error('Application not found in verifier queue');

  // Check pending account registrations queue
  const regQueueRes = await fetchJson('/verifier/registrations', {
    headers: { Cookie: verifierCookie },
  });
  const userInPendingReg = regQueueRes.data.registrations?.some(r => r.email === email);
  console.log(`   Student account in pending registrations queue: ${userInPendingReg ? 'YES (UNEXPECTED)' : '✔ NO (Account is active, not queued)'}`);
  if (userInPendingReg) throw new Error('Student account unexpectedly queued for account approval');

  console.log('\n=== ALL WORKFLOW TESTS PASSED PERFECTLY ===\n');
  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Workflow test error:', err);
    process.exit(1);
  });
