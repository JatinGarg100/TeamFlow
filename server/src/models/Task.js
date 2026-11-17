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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * TASK 1: Mongoose Virtuals
 * -------------------------
 * isOverdue: Checks if task has passed its dueDate and is still incomplete
 * assigneeCount: Returns number of assigned team members
 */
taskSchema.virtual('isOverdue').get(function () {
  if (!this.dueDate || this.status === 'Completed') return false;
  return new Date(this.dueDate).getTime() < Date.now();
});

taskSchema.virtual('assigneeCount').get(function () {
  return Array.isArray(this.assignedTo) ? this.assignedTo.length : 0;
});

/**
 * TASK 2: Mongoose Static Methods
 * -------------------------------
 * Task.findByProject(projectId): Finds all tasks for a project ordered by creation time
 */
taskSchema.statics.findByProject = function (projectId) {
  return this.find({ projectId }).sort({ createdAt: -1 });
};

/**
 * Task.findByAssignee(orgId, userId): Finds all tasks assigned to a user within an organisation
 */
taskSchema.statics.findByAssignee = function (orgId, userId) {
  return this.find({ orgId, assignedTo: userId }).sort({ updatedAt: -1 });
};

/**
 * TASK 3: Mongoose Instance Methods
 * ---------------------------------
 * task.isAssignedTo(userId): Checks whether a given user is assigned to this task
 */
taskSchema.methods.isAssignedTo = function (userId) {
  if (!userId || !Array.isArray(this.assignedTo)) return false;
  const targetIdStr = userId.toString();
  return this.assignedTo.some((assignee) => {
    const idStr = assignee._id ? assignee._id.toString() : assignee.toString();
    return idStr === targetIdStr;
  });
};

/**
 * TASK 4: Mongoose Query Helpers
 * ------------------------------
 * query.byStatus(status)
 * query.byPriority(priority)
 * query.byOrg(orgId)
 */
taskSchema.query.byStatus = function (status) {
  if (!status) return this;
  return this.where({ status });
};

taskSchema.query.byPriority = function (priority) {
  if (!priority) return this;
  return this.where({ priority });
};

taskSchema.query.byOrg = function (orgId) {
  if (!orgId) return this;
  return this.where({ orgId });
};

// Backward-compatible hook: If assignedTo was passed as a single ObjectId or string, wrap into array
taskSchema.pre('validate', function (next) {
  if (this.title && typeof this.title === 'string') {
    this.title = this.title.trim();
  }
  if (this.description && typeof this.description === 'string') {
    this.description = this.description.trim();
  }
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
// Compound index for priority and status filtering within a project
taskSchema.index({ projectId: 1, priority: 1, status: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
