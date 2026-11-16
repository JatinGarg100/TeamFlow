const mongoose = require('mongoose');

/**
 * Task Schema
 * -----------
 * Represents a discrete task within a project.
 * Contains references to organisation, project, and multiple assigned users.
 * Supports multiple assignees (assignedTo: [ObjectId]) with backward-compatible normalization.
 */
const taskSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation ID is required'],
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Task title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    // Multiple assignees: Array of User references
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    priority: {
      type: String,
      enum: {
        values: ['Low', 'Medium', 'High'],
        message: '{VALUE} is not a valid priority',
      },
      default: 'Medium',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['To Do', 'In Progress', 'Completed', 'Pending'],
        message: '{VALUE} is not a valid task status',
      },
      default: 'To Do',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Backward-compatible hook: If assignedTo was passed as a single ObjectId or string, wrap into array
taskSchema.pre('validate', function (next) {
  if (this.assignedTo) {
    if (!Array.isArray(this.assignedTo)) {
      this.assignedTo = [this.assignedTo];
    }
    // Filter out null/undefined and deduplicate
    const uniqueIds = [];
    const seen = new Set();
    for (const id of this.assignedTo) {
      if (id) {
        const strId = id.toString();
        if (!seen.has(strId)) {
          seen.add(strId);
          uniqueIds.push(id);
        }
      }
    }
    this.assignedTo = uniqueIds;
  } else {
    this.assignedTo = [];
  }
  next();
});

// Indexes for fast project task retrieval and personal assigned task retrieval
taskSchema.index({ orgId: 1, projectId: 1, status: 1 });
taskSchema.index({ orgId: 1, assignedTo: 1, status: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
