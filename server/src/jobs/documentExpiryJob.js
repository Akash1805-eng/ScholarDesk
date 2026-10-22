'use strict';
const cron = require('node-cron');
const { checkAndSendExpiryReminders } = require('../services/documentExpiryService');

let job = null;

/**
 * Start the document expiry reminder job.
 * Runs daily at 8:00 AM in the institution's timezone.
 */
function startExpiryJob() {
  const timezone = process.env.INSTITUTION_TIMEZONE || 'Asia/Kolkata';

  // Run at 08:00 every day
  job = cron.schedule('0 8 * * *', async () => {
    console.log('[expiry-job] Starting document expiry check...');
    try {
      const result = await checkAndSendExpiryReminders();
      console.log(`[expiry-job] Done. Sent ${result.sent} reminders, skipped ${result.skipped} (already sent).`);
    } catch (err) {
      console.error('[expiry-job] Error during expiry check:', err.message);
    }
  }, { timezone });

  console.log(`[expiry-job] Scheduled — runs daily at 08:00 ${timezone}`);
}

function stopExpiryJob() {
  if (job) {
    job.stop();
    console.log('[expiry-job] Stopped.');
  }
}

module.exports = { startExpiryJob, stopExpiryJob };
