const mongoose = require('mongoose');

/**
 * UsageRecord Schema
 * ------------------
 * Tracks resource usage metrics (e.g. employee count, projects created, API calls)
 * per organisation over specific billing periods.
 */
const usageRecordSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: [true, 'Organisation ID is required'],
      index: true,
    },
    metric: {
      type: String,
      required: [true, 'Metric name is required'],
      trim: true,
      maxlength: [100, 'Metric name cannot exceed 100 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Usage quantity is required'],
      default: 0,
      min: [0, 'Quantity cannot be negative'],
    },
    periodStart: {
      type: Date,
      required: [true, 'Period start date is required'],
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying specific metric history by organisation and time
usageRecordSchema.index({ orgId: 1, metric: 1, periodStart: 1 });

const UsageRecord = mongoose.model('UsageRecord', usageRecordSchema);

module.exports = UsageRecord;
