const mongoose = require('mongoose');

/**
 * Invitation Schema
 * -----------------
 * Represents a secure invitation for an employee to join an existing organisation.
 * Uses a hashed token (SHA-256) so plaintext tokens are never stored in the database.
 */
const invitationSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation ID is required'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Invited email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'manager', 'member'],
        message: '{VALUE} is not a valid invitation role',
      },
      default: 'member',
      required: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Inviting user ID is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'expired'],
        message: '{VALUE} is not a valid invitation status',
      },
      default: 'pending',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find pending invitations for an email in an organisation
invitationSchema.index({ orgId: 1, email: 1, status: 1 });

const Invitation = mongoose.model('Invitation', invitationSchema);

module.exports = Invitation;
