const mongoose = require('mongoose');

/**
 * Subscription Schema
 * -------------------
 * Represents an organisation's billing plan and active status in TeamFlow SaaS.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation ID is required'],
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: {
        values: ['free', 'pro', 'enterprise'],
        message: '{VALUE} is not a valid subscription plan',
      },
      default: 'free',
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'canceled', 'past_due', 'trialing'],
        message: '{VALUE} is not a valid subscription status',
      },
      default: 'active',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
