const mongoose = require('mongoose');

/**
 * Comment Schema
 * --------------
 * Represents a collaborative comment on an individual task.
 * Associated with the task, its parent project, the owning organisation, and author.
 */
const commentSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task reference is required'],
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
      index: true,
    },
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation reference is required'],
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
      index: true,
    },
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      maxlength: [2000, 'Comment text cannot exceed 2000 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases for compatibility
commentSchema.virtual('taskId').get(function () {
  return this.task;
});
commentSchema.virtual('projectId').get(function () {
  return this.project;
});
commentSchema.virtual('orgId').get(function () {
  return this.organisation;
});

// Fast lookup of task comments in chronological order
commentSchema.index({ task: 1, createdAt: 1 });
commentSchema.index({ organisation: 1, createdAt: -1 });

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
