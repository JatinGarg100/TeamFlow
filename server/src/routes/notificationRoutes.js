const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(requireAuth);

// GET /api/notifications — Retrieve user notifications
router.get('/', getNotifications);

// PATCH /api/notifications/read-all — Mark all notifications as read
router.patch('/read-all', markAllNotificationsRead);

// PATCH /api/notifications/:id/read — Mark single notification as read
router.patch('/:id/read', markNotificationRead);

module.exports = router;
