'use strict';

const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Ensures the admin account specified by ADMIN_EMAIL and ADMIN_PASSWORD
 * is created or updated with the specified password upon server startup.
 */
async function syncAdminAccount() {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return;
  }

  try {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const passwordHash = await bcrypt.hash(adminPassword, rounds);

    const existing = await User.findOne({ email: adminEmail }).select('+passwordHash');
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = 'admin';
      existing.isActive = true;
      existing.emailVerified = true;
      existing.verificationStatus = 'verified';
      await existing.save();
      console.log(`[admin-sync] Admin account updated for: ${adminEmail}`);
    } else {
      await User.create({
        email: adminEmail,
        passwordHash,
        role: 'admin',
        isActive: true,
        emailVerified: true,
        verificationStatus: 'verified',
      });
      console.log(`[admin-sync] Admin account created for: ${adminEmail}`);
    }
  } catch (err) {
    console.error('[admin-sync] Failed to sync admin account:', err.message);
  }
}

module.exports = { syncAdminAccount };
