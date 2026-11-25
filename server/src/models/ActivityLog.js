const mongoose = require('mongoose');

/**
 * ActivityLog Schema
 * ------------------
 * Maintains an audit and activity history of actions performed within an organisation.
 * Stores references and snapshot metadata so historical records remain informative
 * even if referenced tasks or projects are later deleted.
 */
const activityLogSchema = new mongoose.Schema(
  {
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation reference is required'],
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action name is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Activity description is required'],
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases
activityLogSchema.virtual('orgId').get(function () {
  return this.organisation;
});
activityLogSchema.virtual('projectId').get(function () {
  return this.project;
});
activityLogSchema.virtual('taskId').get(function () {
  return this.task;
});
activityLogSchema.virtual('userId').get(function () {
  return this.user;
});

// Indexes for fast retrieval
activityLogSchema.index({ organisation: 1, createdAt: -1 });
activityLogSchema.index({ project: 1, createdAt: -1 });
activityLogSchema.index({ task: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
