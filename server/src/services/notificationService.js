const { Notification } = require('../models');

/**
 * notificationService.js
 * ──────────────────────
 * In-app notification dispatcher for TeamFlow.
 * Handles task assignments, status changes, project milestones, and invitations.
 */

/**
 * Create a single in-app notification.
 * Safe & non-blocking: skips self-notifications and catches errors silently.
 */
const createNotification = async ({
  recipient,
  orgId,
  sender = null,
  type = 'SYSTEM',
  title,
  message,
  link = '',
  metadata = {},
}) => {
  try {
    if (!recipient || !orgId || !title || !message) {
      return null;
    }

    // Don't notify users of their own actions
    if (sender && recipient.toString() === sender.toString()) {
      return null;
    }

    const notification = await Notification.create({
      recipient,
      orgId,
      sender,
      type,
      title,
      message,
      link,
      metadata,
    });

    return notification;
  } catch (err) {
    console.warn('[NotificationService] Failed to create notification:', err.message);
    return null;
  }
};

/**
 * Create notifications for multiple recipients in batch.
 */
const notifyMany = async (recipients, options) => {
  if (!Array.isArray(recipients) || recipients.length === 0) return [];
  const results = [];
  for (const recipient of recipients) {
    const res = await createNotification({ ...options, recipient });
    if (res) results.push(res);
  }
  return results;
};

module.exports = {
  createNotification,
  notifyMany,
};
