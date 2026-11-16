const mongoose = require('mongoose');

/**
 * Organisation Schema
 * -------------------
 * Represents a company/tenant workspace in TeamFlow SaaS.
 * Contains workspace name, URL-friendly unique slug, ownerId ref, and current plan.
 */
const organisationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organisation name is required'],
      trim: true,
      maxlength: [120, 'Organisation name cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Organisation slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'],
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    plan: {
      type: String,
      enum: {
        values: ['free', 'pro', 'enterprise'],
        message: '{VALUE} is not a supported plan',
      },
      default: 'free',
    },
  },
  {
    timestamps: true,
  }
);

const Organisation = mongoose.model('Organisation', organisationSchema);

module.exports = Organisation;
