const mongoose = require('mongoose');

/**
 * Notification Schema
 * -------------------
 * Represents in-app notifications delivered to workspace members for key events:
 * - Task assignments
 * - Task status changes
 * - Project updates
 * - Workspace invitations
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true,
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation ID is required'],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: {
        values: [
          'TASK_ASSIGNED',
          'TASK_STATUS_CHANGED',
          'PROJECT_UPDATED',
          'INVITATION_RECEIVED',
          'SYSTEM',
        ],
        message: '{VALUE} is not a valid notification type',
      },
      default: 'SYSTEM',
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    link: {
      type: String,
      default: '',
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying user's notifications in an organisation sorted by time
notificationSchema.index({ recipient: 1, orgId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

module.exports = Notification;
