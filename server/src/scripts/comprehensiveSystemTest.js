'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const StudentMaster = require('../models/StudentMaster');
const StudentProfile = require('../models/StudentProfile');
const Scholarship = require('../models/Scholarship');
const Application = require('../models/Application');
const Document = require('../models/Document');
const Otp = require('../models/Otp');
const Notification = require('../models/Notification');
const { hashOtp } = require('../utils/generateOtp');
const bcrypt = require('bcryptjs');

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

async function runComprehensiveTest() {
  console.log('===============================================================');
  console.log('   SCHOLARSHIP DESK COMPREHENSIVE END-TO-END SYSTEM TEST       ');
  console.log('===============================================================\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scholarship_management');

  // 1. Health Check
  console.log('--- TEST 1: API Health Check ---');
  const healthRes = await fetchJson('/health');
  console.log(`Status: ${healthRes.status}, Body:`, healthRes.data);
  if (healthRes.status !== 200 || healthRes.data.status !== 'ok') {
    throw new Error('Health check failed');
  }
  console.log('✔ Health check passed.\n');

  // Setup Test Data
  const studentRegNo = '310624104006';
  const studentEmail = '310624104006@eec.srmrmp.edu.in';
  const studentPassword = 'InitialStudentPassword@123';
  const newStudentPassword = 'UpdatedStudentPassword@123';
  const verifierEmail = 'verifier@eec.srmrmp.edu.in';
  const adminEmail = 'admin@eec.srmrmp.edu.in';
  const adminPassword = 'Admin@1234';

  // Ensure Admin exists
  let adminUser = await User.findOne({ email: adminEmail });
  if (!adminUser) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);
    adminUser = await User.create({
      email: adminEmail,
      passwordHash,
      role: 'admin',
      emailVerified: true,
      accountStatus: 'active',
      verificationStatus: 'not_required',
    });
  }

  // Ensure Verifier exists
  let verifierUser = await User.findOne({ email: verifierEmail });
  if (!verifierUser) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Verifier@1234', salt);
    verifierUser = await User.create({
      email: verifierEmail,
      passwordHash,
      role: 'verifier',
      emailVerified: true,
      accountStatus: 'active',
      verificationStatus: 'not_required',
    });
  }

  // Clean student data for fresh test
  const existingStudent = await User.findOne({ email: studentEmail });
  if (existingStudent) {
    await Application.deleteMany({ student: existingStudent._id });
    await StudentProfile.deleteOne({ student: existingStudent._id });
    await Notification.deleteMany({ recipient: existingStudent._id });
    await User.deleteOne({ _id: existingStudent._id });
  }
  await Otp.deleteMany({ email: studentEmail });

  // Ensure StudentMaster entry exists
  await StudentMaster.findOneAndUpdate(
    { registerNumber: studentRegNo },
    {
      registerNumber: studentRegNo,
      name: 'Abinandan S',
      collegeEmail: studentEmail,
      department: 'CSE',
      currentYear: 3,
      academicYear: '2026-2027',
      registrationStatus: 'unclaimed',
      registeredUser: null,
    },
    { upsert: true, new: true }
  );

  // Ensure an Active Scholarship exists
  let scholarship = await Scholarship.findOne({ isActive: true });
  if (!scholarship) {
    scholarship = await Scholarship.create({
      title: 'Full Merit Scholarship 2026-27',
      description: 'Annual scholarship for outstanding academic performance',
      category: 'Merit',
      amount: 50000,
      academicYear: '2026-2027',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      rulesVersion: 1,
      eligibilityCriteria: [],
      createdBy: adminUser._id,
    });
  }

  // 2. Student Registration Flow
  console.log('--- TEST 2: Student Registration & Immediate Activation ---');
  const regOtpRes = await fetchJson('/auth/register/request-otp', {
    method: 'POST',
    body: JSON.stringify({
      registerNumber: studentRegNo,
      collegeEmail: studentEmail,
      password: studentPassword,
      confirmPassword: studentPassword,
    }),
  });
  console.log(`Registration OTP Request: status ${regOtpRes.status}`, regOtpRes.data);
  if (regOtpRes.status !== 200) throw new Error('Registration OTP request failed');

  // Verify OTP
  const regOtpDoc = await Otp.findOne({ email: studentEmail, purpose: 'registration' }).select('+codeHash');
  if (!regOtpDoc) throw new Error('Registration OTP not found in DB');
  const testRegOtp = '654321';
  regOtpDoc.codeHash = hashOtp(testRegOtp);
  await regOtpDoc.save();

  const verifyOtpRes = await fetchJson('/auth/register/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ collegeEmail: studentEmail, otp: testRegOtp }),
  });
  console.log(`Verify OTP: status ${verifyOtpRes.status}`, verifyOtpRes.data);
  if (verifyOtpRes.status !== 201) throw new Error('Verify OTP failed');
  if (verifyOtpRes.data.accountStatus !== 'active' || verifyOtpRes.data.verificationStatus !== 'not_required') {
    throw new Error('Account was not created in active / not_required status');
  }
  console.log('✔ Account successfully created and active.\n');

  // 3. Student Immediate Login
  console.log('--- TEST 3: Immediate Student Login & Token Auth ---');
  const studentLoginRes = await fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ collegeEmail: studentEmail, password: studentPassword }),
  });
  console.log(`Student Login: status ${studentLoginRes.status}`, studentLoginRes.data);
  if (studentLoginRes.status !== 200 || !studentLoginRes.data.success) {
    throw new Error('Student immediate login failed');
  }
  const studentCookie = studentLoginRes.headers.get('set-cookie');

  // Test /api/auth/me
  const meRes = await fetchJson('/auth/me', {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  console.log(`/auth/me: status ${meRes.status}`, meRes.data.user?.email);
  if (meRes.status !== 200 || meRes.data.user?.email !== studentEmail) {
    throw new Error('/auth/me check failed');
  }
  console.log('✔ Student login and session authentication verified.\n');

  // 4. Student Profile & Documents Access
  console.log('--- TEST 4: Student Profile View & Update ---');
  const profileGetRes = await fetchJson('/students/profile', {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  console.log(`Get Profile: status ${profileGetRes.status}`, profileGetRes.data.profile ? 'Profile Found' : 'No Profile');
  if (profileGetRes.status !== 200) throw new Error('Get profile failed');

  const profileUpdateRes = await fetchJson('/students/profile', {
    method: 'PUT',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      cgpa: 8.8,
      familyIncome: 180000,
      gender: 'Male',
      category: 'OBC',
      phone: '9876543210',
      address: {
        line1: '123 University Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
      },
      bankDetails: {
        accountHolderName: 'Abinandan S',
        accountNumber: '123456789012',
        ifscCode: 'SBIN0001234',
        bankName: 'State Bank of India',
        branchName: 'Campus Branch',
      },
    }),
  });
  console.log(`Update Profile: status ${profileUpdateRes.status}`, profileUpdateRes.data.success ? '✔ Success' : profileUpdateRes.data);
  if (profileUpdateRes.status !== 200) throw new Error('Update profile failed');
  console.log('✔ Student profile updated.\n');

  // 5. Scholarships & Eligibility Check
  console.log('--- TEST 5: Browse Scholarships & Check Eligibility ---');
  const scholarshipsRes = await fetchJson('/scholarships', {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  console.log(`List Scholarships: status ${scholarshipsRes.status}, count: ${scholarshipsRes.data.scholarships?.length}`);
  if (scholarshipsRes.status !== 200 || !scholarshipsRes.data.scholarships?.length) {
    throw new Error('List scholarships failed');
  }

  const eligScholarship = scholarshipsRes.data.scholarships[0];
  const eligRes = await fetchJson(`/scholarships/${eligScholarship._id}/eligibility`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  console.log(`Check Eligibility: status ${eligRes.status}`, eligRes.data);
  if (eligRes.status !== 200) throw new Error('Check eligibility failed');
  console.log('✔ Scholarship browsing and eligibility check passed.\n');

  // Prepare required documents if any
  const studentUserDoc = await User.findOne({ email: studentEmail });
  await Document.deleteMany({ owner: studentUserDoc._id });
  const requiredDocs = eligScholarship.requiredDocuments || [];
  for (const docType of requiredDocs) {
    await Document.create({
      owner: studentUserDoc._id,
      documentType: docType,
      originalFilename: `${docType}_sample.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 102400,
      storageKey: `local-uploads/${studentUserDoc._id}/${docType}.pdf`,
      isActive: true,
      verificationStatus: 'pending',
    });
  }

  // 6. Application Preview and Submission
  console.log('--- TEST 6: Application Preview & Submission ---');
  const previewRes = await fetchJson('/applications/preview', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ scholarshipId: eligScholarship._id.toString() }),
  });
  console.log(`Preview Application: status ${previewRes.status}`, previewRes.data.eligibility);
  if (previewRes.status !== 200) throw new Error('Preview application failed');

  const appSubmitRes = await fetchJson('/applications', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      scholarshipId: eligScholarship._id.toString(),
      confirmed: true,
      customAnswers: [],
    }),
  });
  console.log(`Submit Application: status ${appSubmitRes.status}`, appSubmitRes.data);
  if (appSubmitRes.status !== 201) throw new Error('Submit application failed');
  const applicationId = appSubmitRes.data.application._id;
  console.log(`✔ Application submitted successfully. ID: ${applicationId}\n`);

  // 7. Student My Applications
  console.log('--- TEST 7: List My Applications & Detail ---');
  const myAppsRes = await fetchJson('/applications/my', {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  console.log(`My Applications: status ${myAppsRes.status}, count: ${myAppsRes.data.applications?.length}`);
  if (myAppsRes.status !== 200 || !myAppsRes.data.applications?.length) {
    throw new Error('List my applications failed');
  }

  const appDetailRes = await fetchJson(`/applications/${applicationId}`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  console.log(`Application Detail: status ${appDetailRes.status}`, appDetailRes.data.application?._id);
  if (appDetailRes.status !== 200) throw new Error('Get application detail failed');
  console.log('✔ Student application list and detail view verified.\n');

  // 8. Verifier Flow
  console.log('--- TEST 8: Verifier Login & Application Queue Review ---');
  const verifierLoginRes = await fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ collegeEmail: verifierEmail, password: 'Verifier@1234' }),
  });
  console.log(`Verifier Login: status ${verifierLoginRes.status}`);
  if (verifierLoginRes.status !== 200) throw new Error('Verifier login failed');
  const verifierCookie = verifierLoginRes.headers.get('set-cookie');

  // Verify registration queue is empty for this active student
  const regQueueRes = await fetchJson('/verifier/registrations', {
    method: 'GET',
    headers: { Cookie: verifierCookie },
  });
  const inRegQueue = regQueueRes.data.registrations?.some(r => r.email === studentEmail);
  console.log(`Registration queue check: Student queued? ${inRegQueue ? 'YES (UNEXPECTED)' : 'NO (Correct: Account active)'}`);
  if (inRegQueue) throw new Error('Active student is in registration approval queue');

  // Verify application is in queue
  const appQueueRes = await fetchJson('/verifier/applications?status=submitted', {
    method: 'GET',
    headers: { Cookie: verifierCookie },
  });
  const foundInQueue = appQueueRes.data.applications?.some(a => a._id.toString() === applicationId.toString());
  console.log(`Verifier application queue: Application found? ${foundInQueue ? '✔ YES' : '✖ NO'}`);
  if (!foundInQueue) throw new Error('Application not found in verifier queue');

  // Verifier updates status: submitted -> under_verification -> verified -> under_final_approval
  const verifyStatusRes1 = await fetchJson(`/verifier/applications/${applicationId}/status`, {
    method: 'PATCH',
    headers: { Cookie: verifierCookie },
    body: JSON.stringify({
      status: 'under_verification',
      remarks: 'All preliminary documents being reviewed.',
    }),
  });
  console.log(`Verifier Status Update (under_verification): status ${verifyStatusRes1.status}`);
  if (verifyStatusRes1.status !== 200) throw new Error('Status update to under_verification failed');

  const verifyStatusRes2 = await fetchJson(`/verifier/applications/${applicationId}/status`, {
    method: 'PATCH',
    headers: { Cookie: verifierCookie },
    body: JSON.stringify({
      status: 'verified',
      remarks: 'All documents verified successfully.',
    }),
  });
  console.log(`Verifier Status Update (verified): status ${verifyStatusRes2.status}`);
  if (verifyStatusRes2.status !== 200) throw new Error('Status update to verified failed');

  const verifyStatusRes3 = await fetchJson(`/verifier/applications/${applicationId}/status`, {
    method: 'PATCH',
    headers: { Cookie: verifierCookie },
    body: JSON.stringify({
      status: 'under_final_approval',
      remarks: 'Forwarded to Admin for final approval.',
    }),
  });
  console.log(`Verifier Status Update (under_final_approval): status ${verifyStatusRes3.status}`);
  if (verifyStatusRes3.status !== 200) throw new Error('Status update to under_final_approval failed');
  console.log('✔ Verifier application workflow verified.\n');

  // 9. Admin Flow
  console.log('--- TEST 9: Admin Login, Student Master & Final Decision ---');
  const adminLoginRes = await fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ collegeEmail: adminEmail, password: adminPassword }),
  });
  console.log(`Admin Login: status ${adminLoginRes.status}`);
  if (adminLoginRes.status !== 200) throw new Error('Admin login failed');
  const adminCookie = adminLoginRes.headers.get('set-cookie');

  // Admin student master list
  const adminStudentMasterRes = await fetchJson('/admin/students', {
    method: 'GET',
    headers: { Cookie: adminCookie },
  });
  console.log(`Admin Student Master list: status ${adminStudentMasterRes.status}, count: ${adminStudentMasterRes.data.students?.length || adminStudentMasterRes.data.total}`);
  if (adminStudentMasterRes.status !== 200) throw new Error('Admin student master list failed');

  // Admin final decision (Approve scholarship)
  const decisionRes = await fetchJson(`/admin/applications/${applicationId}/decision`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({
      decision: 'approved',
      remarks: 'Approved by Scholarship Board.',
    }),
  });
  console.log(`Admin Final Decision: status ${decisionRes.status}`, decisionRes.data.application?.status);
  if (decisionRes.status !== 200 || decisionRes.data.application?.status !== 'approved') {
    throw new Error('Admin decision failed');
  }
  console.log('✔ Admin management and final decision workflow verified.\n');

  // 10. Notifications Flow
  console.log('--- TEST 10: Student Notifications Flow ---');
  const notifsRes = await fetchJson('/notifications', {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  console.log(`Notifications: status ${notifsRes.status}, count: ${notifsRes.data.notifications?.length}`);
  if (notifsRes.status !== 200) throw new Error('Get notifications failed');
  if (notifsRes.data.notifications?.length > 0) {
    const notifId = notifsRes.data.notifications[0]._id;
    const readRes = await fetchJson(`/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: { Cookie: studentCookie },
    });
    console.log(`Mark notification read: status ${readRes.status}`, readRes.data.success);
    if (readRes.status !== 200) throw new Error('Mark notification read failed');
  }
  console.log('✔ Notifications verified.\n');

  // 11. Forgot & Reset Password Flow
  console.log('--- TEST 11: Forgot Password & Reset Password Flow ---');
  const forgotOtpReqRes = await fetchJson('/auth/forgot-password/request-otp', {
    method: 'POST',
    body: JSON.stringify({ collegeEmail: studentEmail }),
  });
  console.log(`Forgot Password OTP Request: status ${forgotOtpReqRes.status}`);
  if (forgotOtpReqRes.status !== 200) throw new Error('Forgot password OTP request failed');

  const forgotOtpDoc = await Otp.findOne({ email: studentEmail, purpose: 'password_reset' }).select('+codeHash');
  if (!forgotOtpDoc) throw new Error('Forgot password OTP not found in DB');
  const testForgotOtp = '987654';
  forgotOtpDoc.codeHash = hashOtp(testForgotOtp);
  await forgotOtpDoc.save();

  const verifyForgotOtpRes = await fetchJson('/auth/forgot-password/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ collegeEmail: studentEmail, otp: testForgotOtp }),
  });
  console.log(`Verify Forgot Password OTP: status ${verifyForgotOtpRes.status}`);
  if (verifyForgotOtpRes.status !== 200) throw new Error('Verify forgot password OTP failed');
  const resetToken = verifyForgotOtpRes.data.resetToken;

  const resetPasswordRes = await fetchJson('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      resetToken,
      newPassword: newStudentPassword,
      confirmPassword: newStudentPassword,
    }),
  });
  console.log(`Reset Password: status ${resetPasswordRes.status}`, resetPasswordRes.data.message);
  if (resetPasswordRes.status !== 200) throw new Error('Reset password failed');

  // Test login with new password
  const newLoginRes = await fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ collegeEmail: studentEmail, password: newStudentPassword }),
  });
  console.log(`Login with New Password: status ${newLoginRes.status}`, newLoginRes.data.success ? '✔ Success' : 'Failed');
  if (newLoginRes.status !== 200 || !newLoginRes.data.success) {
    throw new Error('Login with new password failed');
  }
  console.log('✔ Password reset and re-authentication verified.\n');

  console.log('===============================================================');
  console.log('   🎉 ALL 11 COMPREHENSIVE END-TO-END TESTS PASSED PERFECTLY!   ');
  console.log('===============================================================\n');

  await mongoose.disconnect();
}

runComprehensiveTest()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('❌ Comprehensive Test Error:', err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  });
