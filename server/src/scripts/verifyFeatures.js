'use strict';
/**
 * End-to-end feature verification script for Scholarship Desk.
 * Tests every core feature and role workflow against the live running server (http://localhost:5000).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // if not available, we can use built-in or mock
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BASE_URL = 'http://localhost:5000/api';
const DOMAIN = process.env.COLLEGE_EMAIL_DOMAIN || 'eec.srmrmp.edu.in';

let results = [];

function logPass(feature, detail = '') {
  console.log(`\x1b[32m✔ PASS:\x1b[0m ${feature} ${detail ? '(' + detail + ')' : ''}`);
  results.push({ feature, status: 'PASS', detail });
}

function logFail(feature, err) {
  console.error(`\x1b[31m✘ FAIL:\x1b[0m ${feature} - ${err}`);
  results.push({ feature, status: 'FAIL', error: String(err) });
}

// Simple fetch wrapper using native fetch (Node 18+)
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = options.headers || {};
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.body && typeof options.body === 'object' && !(options.body instanceof Buffer) && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function run() {
  console.log('=== STARTING SCHOLARSHIP DESK FEATURE VERIFICATION ===\n');

  // 1. Health check
  try {
    const res = await request('/health');
    if (res.ok && res.data.status === 'ok') {
      logPass('System Health Check', res.data.service);
    } else {
      logFail('System Health Check', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('System Health Check', e.message);
  }

  // 2. Authentication: Admin Login
  let adminToken = '';
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      body: { email: `admin@${DOMAIN}`, password: 'Admin@1234' },
    });
    if (res.ok && res.data.token && res.data.user.role === 'admin') {
      adminToken = res.data.token;
      logPass('Admin Authentication (Login)', res.data.user.email);
    } else {
      logFail('Admin Authentication (Login)', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Admin Authentication (Login)', e.message);
  }

  // 3. Authentication: Verifier Login
  let verifierToken = '';
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      body: { email: `verifier@${DOMAIN}`, password: 'Verifier@1234' },
    });
    if (res.ok && res.data.token && res.data.user.role === 'verifier') {
      verifierToken = res.data.token;
      logPass('Verifier Authentication (Login)', res.data.user.email);
    } else {
      logFail('Verifier Authentication (Login)', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Verifier Authentication (Login)', e.message);
  }

  // 4. Authentication: Approved Student Login
  let studentToken = '';
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      body: { email: `310624104002@${DOMAIN}`, password: 'Student@1234' },
    });
    if (res.ok && res.data.token && res.data.user.role === 'student') {
      studentToken = res.data.token;
      logPass('Student Authentication (Approved Login)', res.data.user.email);
    } else {
      logFail('Student Authentication (Approved Login)', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Student Authentication (Approved Login)', e.message);
  }

  // 5. Auth /me endpoint
  try {
    const res = await request('/auth/me', { token: studentToken });
    if (res.ok && res.data.user && res.data.user.email === `310624104002@${DOMAIN}`) {
      logPass('Auth /me Session Check', res.data.user.role);
    } else {
      logFail('Auth /me Session Check', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Auth /me Session Check', e.message);
  }

  // 6. Student Profile: Fetch
  try {
    const res = await request('/students/profile', { token: studentToken });
    if (res.ok && res.data.profile) {
      logPass('Student Profile Retrieval', `CGPA: ${res.data.profile.cgpa}, Income: ${res.data.profile.familyIncome}`);
    } else {
      logFail('Student Profile Retrieval', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Student Profile Retrieval', e.message);
  }

  // 7. Student Profile: Update
  try {
    const res = await request('/students/profile', {
      method: 'PUT',
      token: studentToken,
      body: {
        cgpa: 8.8,
        percentage: 88,
        phone: '9876543219',
        bankDetails: {
          accountNumber: '123456789012',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          accountHolderName: 'Arjun Kumar',
        },
      },
    });
    if (res.ok && res.data.profile && res.data.profile.cgpa === 8.8) {
      logPass('Student Profile Update', 'Updated CGPA to 8.8');
    } else {
      logFail('Student Profile Update', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Student Profile Update', e.message);
  }

  // 8. Scholarships: List
  let meritScholarshipId = '';
  let firstGradScholarshipId = '';
  try {
    const res = await request('/scholarships', { token: studentToken });
    if (res.ok && Array.isArray(res.data.scholarships) && res.data.scholarships.length > 0) {
      meritScholarshipId = res.data.scholarships.find(s => s.title.includes('Merit'))?._id || res.data.scholarships[0]._id;
      firstGradScholarshipId = res.data.scholarships.find(s => s.title.includes('First Graduate'))?._id || res.data.scholarships[1]?._id;
      logPass('Scholarships List', `Found ${res.data.scholarships.length} scholarships`);
    } else {
      logFail('Scholarships List', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Scholarships List', e.message);
  }

  // 9. Eligibility Check & Duplicate Prevention on Merit Scholarship
  if (meritScholarshipId) {
    try {
      const res = await request(`/scholarships/${meritScholarshipId}/eligibility`, { token: studentToken });
      if (res.ok && res.data.eligible === true && res.data.existingApplication) {
        logPass('Eligibility Check & Existing Application Detection', `Eligible: true, Application Status: ${res.data.existingApplication.status}`);
      } else {
        logFail('Eligibility Check & Existing Application Detection', JSON.stringify(res.data));
      }
    } catch (e) {
      logFail('Eligibility Check & Existing Application Detection', e.message);
    }

    // Duplicate Prevention Check on Preview
    try {
      const res = await request('/applications/preview', {
        method: 'POST',
        token: studentToken,
        body: { scholarshipId: meritScholarshipId },
      });
      if (res.status === 409 && res.data.code === 'APPLICATION_EXISTS') {
        logPass('Duplicate Application Prevention', 'Correctly rejected duplicate with 409 APPLICATION_EXISTS');
      } else {
        logFail('Duplicate Application Prevention', `Expected 409, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (e) {
      logFail('Duplicate Application Prevention', e.message);
    }
  }

  // 10. Application Preview & Submission on First Graduate Scholarship (new application)
  let newAppId = '';
  if (firstGradScholarshipId) {
    try {
      const res = await request('/applications/preview', {
        method: 'POST',
        token: studentToken,
        body: { scholarshipId: firstGradScholarshipId },
      });
      if (res.ok && res.data.official && res.data.scholarship) {
        logPass('Application Autofill Preview', `Official: ${res.data.official.name} (${res.data.official.registerNumber})`);
      } else {
        logFail('Application Autofill Preview', JSON.stringify(res.data));
      }
    } catch (e) {
      logFail('Application Autofill Preview', e.message);
    }

    // Upload required documents using Buffer-based multipart/form-data
    const docTypes = ['income_certificate', 'first_graduate_certificate', 'bank_evidence'];
    let uploadedDocId = '';
    for (const dt of docTypes) {
      try {
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const bodyBuffer = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${dt}.pdf"\r\nContent-Type: application/pdf\r\n\r\nDummy PDF certificate file content\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\n${dt}\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="issueDate"\r\n\r\n2026-01-01\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="expiryDate"\r\n\r\n2027-12-31\r\n`),
          Buffer.from(`--${boundary}--\r\n`),
        ]);

        const uploadRes = await request('/students/documents', {
          method: 'POST',
          token: studentToken,
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: bodyBuffer,
        });
        if (uploadRes.ok && uploadRes.data.document) {
          uploadedDocId = uploadRes.data.document._id;
          logPass(`Student Document Upload (${dt})`, `ID: ${uploadedDocId}`);
        } else {
          logFail(`Student Document Upload (${dt})`, JSON.stringify(uploadRes.data));
        }
      } catch (e) {
        logFail(`Student Document Upload (${dt})`, e.message);
      }
    }

    // Verify document list
    try {
      const docListRes = await request('/students/documents', { token: studentToken });
      if (docListRes.ok && Array.isArray(docListRes.data.documents) && docListRes.data.documents.length >= 3) {
        logPass('Student Documents Listing', `Found ${docListRes.data.documents.length} documents`);
      } else {
        logFail('Student Documents Listing', JSON.stringify(docListRes.data));
      }
    } catch (e) {
      logFail('Student Documents Listing', e.message);
    }

    // Verify document download
    if (uploadedDocId) {
      try {
        const dlRes = await request(`/students/documents/${uploadedDocId}/download`, { token: studentToken });
        if (dlRes.status === 200 || dlRes.status === 302) {
          logPass('Student Document Download Authorization', `Status: ${dlRes.status}`);
        } else {
          logFail('Student Document Download Authorization', JSON.stringify(dlRes.data));
        }
      } catch (e) {
        logFail('Student Document Download Authorization', e.message);
      }
    }

    // Application Submission on First Graduate Scholarship
    try {
      const res = await request('/applications', {
        method: 'POST',
        token: studentToken,
        body: {
          scholarshipId: firstGradScholarshipId,
          customAnswers: {},
          confirmed: true,
        },
      });
      if (res.ok && res.data.application) {
        newAppId = res.data.application._id;
        logPass('Application Submission', `Application ID: ${newAppId}, Status: ${res.data.application.status}`);
      } else {
        logFail('Application Submission', JSON.stringify(res.data));
      }
    } catch (e) {
      logFail('Application Submission', e.message);
    }
  }

  // 11. My Applications: List
  try {
    const res = await request('/applications/my', { token: studentToken });
    if (res.ok && Array.isArray(res.data.applications)) {
      logPass('My Applications Listing', `Found ${res.data.applications.length} applications`);
    } else {
      logFail('My Applications Listing', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('My Applications Listing', e.message);
  }

  // 12. Student Notifications
  try {
    const res = await request('/notifications', { token: studentToken });
    if (res.ok && Array.isArray(res.data.notifications)) {
      logPass('Notifications Retrieval', `Total: ${res.data.total}, Unread: ${res.data.unreadCount}`);
    } else {
      logFail('Notifications Retrieval', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Notifications Retrieval', e.message);
  }

  // 13. Verifier: Pending Registrations
  try {
    const res = await request('/verifier/registrations', { token: verifierToken });
    if (res.ok && Array.isArray(res.data.registrations)) {
      logPass('Verifier Registration Queue', `Found ${res.data.registrations.length} pending registration(s)`);
    } else {
      logFail('Verifier Registration Queue', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Verifier Registration Queue', e.message);
  }

  // 14. Verifier: Application Queue & Forward to Admin
  if (newAppId) {
    try {
      // Transition submitted -> under_verification
      const step1 = await request(`/verifier/applications/${newAppId}/status`, {
        method: 'PATCH',
        token: verifierToken,
        body: { status: 'under_verification', remarks: 'Verifier reviewing documents' },
      });
      if (step1.ok) {
        logPass('Verifier Step 1: Start Review (under_verification)');
      } else {
        logFail('Verifier Step 1: Start Review', JSON.stringify(step1.data));
      }

      // Transition under_verification -> verified
      const step2 = await request(`/verifier/applications/${newAppId}/status`, {
        method: 'PATCH',
        token: verifierToken,
        body: { status: 'verified', remarks: 'All certificates valid' },
      });
      if (step2.ok) {
        logPass('Verifier Step 2: Mark Verified (verified)');
      } else {
        logFail('Verifier Step 2: Mark Verified', JSON.stringify(step2.data));
      }

      // Transition verified -> under_final_approval
      const step3 = await request(`/verifier/applications/${newAppId}/status`, {
        method: 'PATCH',
        token: verifierToken,
        body: { status: 'under_final_approval', remarks: 'Forwarded to Admin for final sanction' },
      });
      if (step3.ok) {
        logPass('Verifier Step 3: Forward to Admin (under_final_approval)');
      } else {
        logFail('Verifier Step 3: Forward to Admin', JSON.stringify(step3.data));
      }
    } catch (e) {
      logFail('Verifier Application Review Workflow', e.message);
    }

    // 15. Admin: Final Decision (Approval)
    try {
      const decisionRes = await request(`/admin/applications/${newAppId}/decision`, {
        method: 'PATCH',
        token: adminToken,
        body: { decision: 'approved', remarks: 'Sanctioned by Scholarship Committee' },
      });
      if (decisionRes.ok && decisionRes.data.application && decisionRes.data.application.status === 'approved') {
        logPass('Admin Final Decision (Approved)', `Status: ${decisionRes.data.application.status}`);
      } else {
        logFail('Admin Final Decision (Approved)', JSON.stringify(decisionRes.data));
      }
    } catch (e) {
      logFail('Admin Final Decision (Approved)', e.message);
    }
  }

  // 16. Admin: List Students (Student Master)
  try {
    const res = await request('/admin/students', { token: adminToken });
    if (res.ok && Array.isArray(res.data.records)) {
      logPass('Admin Student Master Records', `Found ${res.data.records.length} student records`);
    } else {
      logFail('Admin Student Master Records', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Admin Student Master Records', e.message);
  }

  // 17. Admin: List Verifiers
  try {
    const res = await request('/admin/verifiers', { token: adminToken });
    if (res.ok && Array.isArray(res.data.verifiers)) {
      logPass('Admin Verifier Management List', `Found ${res.data.verifiers.length} verifier(s)`);
    } else {
      logFail('Admin Verifier Management List', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Admin Verifier Management List', e.message);
  }

  // 18. Admin: Reports
  try {
    const res = await request('/admin/reports', { token: adminToken });
    if (res.ok && res.data.summary) {
      logPass('Admin Reports Generation', `Total students: ${res.data.summary.totalStudents}`);
    } else {
      logFail('Admin Reports Generation', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Admin Reports Generation', e.message);
  }

  // 19. Admin: Download Import Template
  try {
    const res = await request('/admin/students/import/template', { token: adminToken });
    if (res.ok) {
      logPass('Admin Student Master Import Template Download');
    } else {
      logFail('Admin Student Master Import Template Download', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('Admin Student Master Import Template Download', e.message);
  }

  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Passed: ${passed} / ${results.length}`);
  console.log(`Failed: ${failed} / ${results.length}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
