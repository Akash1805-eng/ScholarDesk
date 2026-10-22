'use strict';
const { getUserNotifications, markAsRead, markAllAsRead } = require('../services/notificationService');

// ── List notifications ─────────────────────────────────────────────────────────
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
    const result = await getUserNotifications(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === 'true',
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// ── Mark one as read ───────────────────────────────────────────────────────────
exports.markRead = async (req, res, next) => {
  try {
    const notif = await markAsRead(req.params.id, req.user.id);
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found.' });
    return res.status(200).json({ success: true, notification: notif });
  } catch (err) {
    next(err);
  }
};

// ── Mark all as read ───────────────────────────────────────────────────────────
exports.markAllRead = async (req, res, next) => {
  try {
    await markAllAsRead(req.user.id);
    return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
};
