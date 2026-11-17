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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * TASK 1: Mongoose Virtuals
 * -------------------------
 * teamSize: Returns count of assigned team members
 */
projectSchema.virtual('teamSize').get(function () {
  return Array.isArray(this.teamMembers) ? this.teamMembers.length : 0;
});

/**
 * TASK 1: Mongoose Virtual Populate for Tasks
 * Allows project.populate('tasks') to reference child Task documents without storing task IDs on Project
 */
projectSchema.virtual('tasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'projectId',
});

/**
 * TASK 2: Mongoose Static Methods
 * -------------------------------
 * Project.findByOrganisation(orgId): Finds all projects belonging to an organisation
 */
projectSchema.statics.findByOrganisation = function (orgId) {
  return this.find({ orgId }).sort({ createdAt: -1 });
};

/**
 * TASK 3: Mongoose Instance Methods
 * ---------------------------------
 * project.hasMember(userId): Checks whether a user ID belongs to this project's teamMembers
 */
projectSchema.methods.hasMember = function (userId) {
  if (!userId || !Array.isArray(this.teamMembers)) return false;
  const targetIdStr = userId.toString();
  return this.teamMembers.some((member) => {
    const memberIdStr = member._id ? member._id.toString() : member.toString();
    return memberIdStr === targetIdStr;
  });
};

/**
 * TASK 4: Mongoose Query Helpers
 * ------------------------------
 * query.byStatus(status): Filter query by project status
 */
projectSchema.query.byStatus = function (status) {
  if (!status) return this;
  return this.where({ status });
};

/**
 * TASK 5: Mongoose Middleware
 * ---------------------------
 * Normalizes project title and description strings before saving
 */
projectSchema.pre('save', function (next) {
  if (this.isModified('name') && typeof this.name === 'string') {
    this.name = this.name.trim();
  }
  if (this.isModified('description') && typeof this.description === 'string') {
    this.description = this.description.trim();
  }
  next();
});

// Index to efficiently list projects by organisation and status
projectSchema.index({ orgId: 1, status: 1 });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
