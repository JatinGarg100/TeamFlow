const mongoose = require('mongoose');
const { Notification, Membership } = require('../models');

/**
 * GET /api/notifications
 * ----------------------
 * Returns in-app notifications for the authenticated user, optionally scoped to active org.
 */
const getNotifications = async (req, res, next) => {
  try {
    const orgId = req.query.orgId || req.headers['x-org-id'];

    const filter = {
      recipient: req.user._id,
    };

    if (orgId && mongoose.Types.ObjectId.isValid(orgId)) {
      filter.orgId = new mongoose.Types.ObjectId(orgId);
    }

    if (req.query.read === 'true') {
      filter.read = true;
    } else if (req.query.read === 'false') {
      filter.read = false;
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const [totalItems, unreadCount, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
      Notification.find(filter)
        .populate('sender', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      notifications,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit) || 1,
        totalItems,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * ---------------------------------
 * Marks a single notification as read.
 */
const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid notification ID format.' },
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: { message: 'Notification not found or access denied.' },
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      orgId: notification.orgId,
      read: false,
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      notification,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * ---------------------------------
 * Marks all notifications for the user as read (optionally scoped to orgId).
 */
const markAllNotificationsRead = async (req, res, next) => {
  try {
    const orgId = req.query.orgId || req.body?.orgId || req.headers['x-org-id'];

    const filter = {
      recipient: req.user._id,
      read: false,
    };

    if (orgId && mongoose.Types.ObjectId.isValid(orgId)) {
      filter.orgId = new mongoose.Types.ObjectId(orgId);
    }

    const result = await Notification.updateMany(filter, {
      $set: { read: true, readAt: new Date() },
    });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount || 0,
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
