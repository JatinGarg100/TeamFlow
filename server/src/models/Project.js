const mongoose = require('mongoose');

/**
 * Project Schema
 * --------------
 * Represents a project belonging to an organisation.
 * Includes assigned team members (User references), status, deadline, and timestamps.
 */
const projectSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [150, 'Project name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    deadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['Planning', 'In Progress', 'Completed'],
        message: '{VALUE} is not a valid project status',
      },
      default: 'Planning',
      index: true,
    },
    teamMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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

// Index to efficiently list projects by organisation and status
projectSchema.index({ orgId: 1, status: 1 });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
