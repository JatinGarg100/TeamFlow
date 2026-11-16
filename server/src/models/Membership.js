const mongoose = require('mongoose');

/**
 * Membership Schema
 * -----------------
 * Represents a user's role and membership within a specific organisation.
 * Uses a compound unique index on (orgId, userId) so a user cannot be added twice to the same organisation.
 */
const membershipSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: ['owner', 'admin', 'manager', 'member'],
        message: '{VALUE} is not a valid membership role',
      },
      default: 'member',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee a user has at most one membership per organisation
membershipSchema.index({ orgId: 1, userId: 1 }, { unique: true });

const Membership = mongoose.model('Membership', membershipSchema);

module.exports = Membership;
