'use strict';
/**
 * Create the first admin account.
 * Usage: node src/scripts/createAdmin.js
 *
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from environment.
 * Set them as env vars or in a .env file before running.
 *
 * Example:
 *   ADMIN_EMAIL=admin@scholarshipdesk.example ADMIN_PASSWORD=Admin@123 node src/scripts/createAdmin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/database');
const User = require('../models/User');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('ERROR: Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables before running this script.');
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase().trim() });
  if (existing) {
    console.log(`Admin account already exists for: ${ADMIN_EMAIL}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  const admin = await User.create({
    email: ADMIN_EMAIL.toLowerCase().trim(),
    passwordHash,
    role: 'admin',
    emailVerified: true,
    verificationStatus: 'verified',
    isActive: true,
  });

  console.log(`✔ Admin account created: ${admin.email} (id: ${admin._id})`);
  console.log('  Log in at /login with this email and the password you provided.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
