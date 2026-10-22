'use strict';
const Notification = require('../models/Notification');

/**
 * Create a notification for a user.
 * Returns the created notification document.
 */
async function createNotification({ recipient, title, message, type = 'general', relatedApplication = null, relatedDocument = null, deduplicationKey = null }) {
  // Deduplication: if a deduplicationKey is provided, skip if already exists
  if (deduplicationKey) {
    const existing = await Notification.findOne({ deduplicationKey });
    if (existing) return existing;
  }

  return Notification.create({
    recipient,
    title,
    message,
    type,
    relatedApplication,
    relatedDocument,
    deduplicationKey,
  });
}

/**
 * Get paginated notifications for a user.
 */
async function getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const filter = { recipient: userId };
  if (unreadOnly) filter.isRead = false;

  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });

  return {
    notifications,
    total,
    unreadCount,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Mark a notification as read (owner check enforced).
 */
async function markAsRead(notificationId, userId) {
  const notif = await Notification.findOne({ _id: notificationId, recipient: userId });
  if (!notif) return null;
  if (!notif.isRead) {
    notif.isRead = true;
    notif.readAt = new Date();
    await notif.save();
  }
  return notif;
}

/**
 * Mark all unread notifications as read for a user.
 */
async function markAllAsRead(userId) {
  return Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
}

module.exports = { createNotification, getUserNotifications, markAsRead, markAllAsRead };
