'use strict';
const Document = require('../models/Document');
const { supportsExpiryDate } = require('../models/Document');
const User = require('../models/User');
const StudentMaster = require('../models/StudentMaster');
const { createNotification } = require('./notificationService');
const { sendExpiryReminderEmail } = require('../config/email');

const REMINDER_THRESHOLDS = (process.env.EXPIRY_REMINDER_DAYS || '30,7,1')
  .split(',')
  .map(d => parseInt(d.trim(), 10))
  .filter(n => !isNaN(n) && n > 0)
  .sort((a, b) => b - a); // descending: 30, 7, 1

const DOCUMENT_TYPE_LABELS = {
  identity_proof: 'Identity Proof',
  income_certificate: 'Income Certificate',
  community_certificate: 'Community Certificate',
  marksheet: 'Marksheet',
  first_graduate_certificate: 'First Graduate Certificate',
  disability_certificate: 'Disability Certificate',
  bank_evidence: 'Bank Evidence',
  bonafide_certificate: 'Bonafide Certificate',
};

/**
 * Check all active documents with expiry dates and send reminders.
 * Deduplicates by (documentId + version + threshold) to prevent repeat sends.
 */
async function checkAndSendExpiryReminders() {
  const now = new Date();
  const maxDays = REMINDER_THRESHOLDS[0] || 30;
  const cutoff = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

  // Find all active documents expiring within the maximum threshold window
  const expiring = await Document.find({
    isActive: true,
    expiryDate: { $ne: null, $gt: now, $lte: cutoff },
  }).select('+storageKey');

  let sent = 0, skipped = 0;

  for (const doc of expiring) {
    if (!supportsExpiryDate(doc.documentType) || !doc.expiryDate) continue;

    const msUntilExpiry = doc.expiryDate.getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000));

    for (const threshold of REMINDER_THRESHOLDS) {
      if (daysUntilExpiry > threshold) continue; // Not yet within this threshold

      // Check if reminder already sent for this doc version + threshold
      const alreadySent = (doc.remindersSent || []).some(r => r.threshold === threshold);
      if (alreadySent) {
        skipped++;
        continue;
      }

      // Find owner's email and name
      const user = await User.findById(doc.owner).select('email');
      const master = await StudentMaster.findOne({ registeredUser: doc.owner }).select('name');
      if (!user) continue;

      const name = master?.name || user.email;
      const docLabel = DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType;
      const deduplicationKey = `doc-expiry-${doc._id}-v${doc.version}-t${threshold}`;

      // Create in-app notification (deduplicated)
      const notif = await createNotification({
        recipient: doc.owner,
        title: `Document Expiring Soon: ${docLabel}`,
        message: `Your ${docLabel} expires on ${doc.expiryDate.toLocaleDateString('en-IN')} (${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} remaining). Please renew it to continue applying for scholarships.`,
        type: daysUntilExpiry <= 0 ? 'document_expired' : 'document_expiry_warning',
        relatedDocument: doc._id,
        deduplicationKey,
      });

      if (!notif) {
        skipped++;
        continue; // Already existed (dedup)
      }

      // Send email reminder
      try {
        await sendExpiryReminderEmail({
          to: user.email,
          name,
          documentType: docLabel,
          expiryDate: doc.expiryDate,
          daysLeft: daysUntilExpiry,
        });
      } catch (emailErr) {
        console.error(`[expiry-service] Email failed for doc ${doc._id}:`, emailErr.message);
      }

      // Record that this reminder was sent (prevents retries from duplicating)
      doc.remindersSent = doc.remindersSent || [];
      doc.remindersSent.push({ threshold, sentAt: new Date(), notificationId: notif._id });
      await doc.save();

      sent++;
    }
  }

  // Also check for already-expired documents and send final notice
  const expired = await Document.find({
    isActive: true,
    expiryDate: { $ne: null, $lte: now },
  });

  for (const doc of expired) {
    if (!supportsExpiryDate(doc.documentType) || !doc.expiryDate) continue;

    const alreadySent = (doc.remindersSent || []).some(r => r.threshold === 0);
    if (alreadySent) continue;

    const user = await User.findById(doc.owner).select('email');
    const master = await StudentMaster.findOne({ registeredUser: doc.owner }).select('name');
    if (!user) continue;

    const docLabel = DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType;
    const deduplicationKey = `doc-expired-${doc._id}-v${doc.version}`;

    const notif = await createNotification({
      recipient: doc.owner,
      title: `Document Expired: ${docLabel}`,
      message: `Your ${docLabel} has expired. Please upload a renewed copy to continue scholarship applications.`,
      type: 'document_expired',
      relatedDocument: doc._id,
      deduplicationKey,
    });

    if (notif) {
      doc.remindersSent = doc.remindersSent || [];
      doc.remindersSent.push({ threshold: 0, sentAt: new Date(), notificationId: notif._id });
      await doc.save();
      sent++;
    }
  }

  return { sent, skipped };
}

module.exports = { checkAndSendExpiryReminders, REMINDER_THRESHOLDS };
