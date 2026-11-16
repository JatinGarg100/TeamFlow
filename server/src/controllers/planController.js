const mongoose = require('mongoose');
const plansConfig = require('../config/plans');
const { Membership, Project, Task, Organisation, UsageRecord } = require('../models');

/**
 * GET /api/plans
 * --------------
 * Returns subscription plan tiers and highlights the current organisation's plan.
 */
const getPlans = async (req, res, next) => {
  try {
    let currentPlan = 'free';

    // Find authenticated user's organisation
    const membership = await Membership.findOne({ userId: req.user._id });
    if (membership) {
      const org = await Organisation.findById(membership.orgId);
      if (org && org.plan) {
        currentPlan = org.plan;
      }
    }

    res.status(200).json({
      success: true,
      currentPlan,
      plans: plansConfig,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/usage
 * --------------
 * Returns preliminary resource usage counts from MongoDB compared to plan quotas.
 */
const getUsage = async (req, res, next) => {
  try {
    const membership = await Membership.findOne({ userId: req.user._id });
    if (!membership) {
      return res.status(200).json({
        success: true,
        status: 'preliminary',
        message: 'No active organisation found.',
        usage: { membersCount: 0, projectsCount: 0, tasksCount: 0 },
      });
    }

    const orgId = membership.orgId;
    const org = await Organisation.findById(orgId);
    const planId = org?.plan || 'free';
    const activePlan = plansConfig.find((p) => p.id === planId) || plansConfig[0];

    const [membersCount, projectsCount, tasksCount] = await Promise.all([
      Membership.countDocuments({ orgId }),
      Project.countDocuments({ orgId }),
      Task.countDocuments({ orgId }),
    ]);

    // Check for any recorded metered usage in UsageRecord
    const rawUsageRecords = await UsageRecord.find({ orgId }).sort({ createdAt: -1 }).limit(10);

    res.status(200).json({
      success: true,
      status: 'preliminary',
      message: 'Usage tracking reflects active database resource tallies. Automated period metering will be expanded with billing integrations.',
      plan: {
        id: activePlan.id,
        name: activePlan.name,
        limits: activePlan.limits,
      },
      usage: {
        membersCount,
        maxMembers: activePlan.limits.maxMembers,
        projectsCount,
        maxProjects: activePlan.limits.maxProjects,
        tasksCount,
      },
      records: rawUsageRecords,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlans,
  getUsage,
};
