const mongoose = require('mongoose');

/**
 * User Schema
 * -----------
 * Represents a registered user in TeamFlow.
 * Includes name, unique lowercase email, passwordHash, and audit timestamps.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    avatar: {
      type: String,
      trim: true,
      default: '',
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
 * initials: Computes uppercase initials from user's full name (e.g. "Rahul Sharma" -> "RS")
 * Useful for avatar badges without storing redundant fields in MongoDB.
 */
userSchema.virtual('initials').get(function () {
  if (!this.name) return '';
  const parts = this.name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});

/**
 * TASK 2: Mongoose Static Methods
 * -------------------------------
 * User.findByEmail(email): Case-insensitive lookup for an existing user account.
 */
userSchema.statics.findByEmail = function (email) {
  if (!email) return null;
  return this.findOne({ email: email.toLowerCase().trim() });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
