const mongoose = require('mongoose');
const { Membership, Project } = require('../models');
const { getActivityLogs } = require('../services/activityLog.service');
const { parsePagination } = require('../utils/pagination');

/**
 * GET /api/activity
 * -----------------
 * Retrieves activity logs for an organisation with optional project/task filtering.
 * Verifications:
 * - Authenticated user must belong to the organisation.
 * - Prevents cross-organisation activity leakage.
 * - Supports pagination (default: 20 per page, max 50).
 */
const getActivity = async (req, res, next) => {
  try {
    let orgId = req.query.orgId || req.headers['x-org-id'];
    const { projectId, taskId } = req.query;

    // If projectId is provided, verify project and derive orgId if needed
    if (projectId) {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid project ID format.' },
        });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: 'Project not found.' },
        });
      }

      orgId = project.orgId.toString();
    }

    // If orgId is not provided, look up the user's active/first organisation
    if (!orgId) {
      const firstMembership = await Membership.findOne({ userId: req.user._id });
      if (!firstMembership) {
        return res.status(200).json({
          success: true,
          data: [],
          activities: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
            limit: 20,
          },
        });
      }
      orgId = firstMembership.orgId.toString();
    }

    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid organisation ID format.' },
      });
    }

    // Verify user membership in this organisation
    const membership = await Membership.findOne({
      orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to this organisation.' },
      });
    }

    const { page, limit } = parsePagination(req.query, 20, 50);

    const result = await getActivityLogs({
      orgId,
      projectId: projectId || null,
      taskId: taskId || null,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result.activities,
      activities: result.activities,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivity,
};
