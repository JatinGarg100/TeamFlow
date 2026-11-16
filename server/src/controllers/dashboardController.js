const mongoose = require('mongoose');
const { Membership, Project, Task, Organisation } = require('../models');

/**
 * GET /api/dashboard
 * -------------------
 * Returns organisation-specific statistics computed live from MongoDB:
 * - Total employees
 * - Total projects
 * - Active projects (In Progress)
 * - Pending tasks (To Do / In Progress)
 * - Completed tasks
 * - Recent projects with name, status, deadline, and live calculated progress
 *
 * Strictly scoped to the authenticated user's organisation.
 */
const getDashboardStats = async (req, res, next) => {
  try {
    let targetOrgId = req.query.orgId || req.headers['x-org-id'];

    if (targetOrgId) {
      if (!mongoose.Types.ObjectId.isValid(targetOrgId)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid organisation ID format.' },
        });
      }

      // Check membership
      const membership = await Membership.findOne({
        orgId: targetOrgId,
        userId: req.user._id,
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied. You do not belong to this organisation.' },
        });
      }
    } else {
      // Find primary organisation membership for user
      const membership = await Membership.findOne({ userId: req.user._id });

      if (!membership) {
        return res.status(200).json({
          success: true,
          organisation: null,
          stats: {
            totalEmployees: 0,
            totalProjects: 0,
            activeProjects: 0,
            pendingTasks: 0,
            completedTasks: 0,
            totalTasks: 0,
          },
          recentProjects: [],
        });
      }

      targetOrgId = membership.orgId;
    }

    // 1. Fetch Organisation Info
    const organisation = await Organisation.findById(targetOrgId).select('name slug plan');

    // 2. Compute live metric tallies directly from MongoDB
    const [totalEmployees, totalProjects, activeProjects, pendingTasks, completedTasks] =
      await Promise.all([
        Membership.countDocuments({ orgId: targetOrgId }),
        Project.countDocuments({ orgId: targetOrgId }),
        Project.countDocuments({ orgId: targetOrgId, status: 'In Progress' }),
        Task.countDocuments({ orgId: targetOrgId, status: { $ne: 'Completed' } }),
        Task.countDocuments({ orgId: targetOrgId, status: 'Completed' }),
      ]);

    const totalTasks = pendingTasks + completedTasks;

    // 3. Fetch Recent Projects and compute their real task progress
    const recentProjectsDocs = await Project.find({ orgId: targetOrgId })
      .sort({ createdAt: -1 })
      .limit(5);

    const recentProjects = await Promise.all(
      recentProjectsDocs.map(async (proj) => {
        const [projTotalTasks, projCompletedTasks] = await Promise.all([
          Task.countDocuments({ projectId: proj._id }),
          Task.countDocuments({ projectId: proj._id, status: 'Completed' }),
        ]);

        // Calculate progress dynamically from task records
        const progressPercentage =
          projTotalTasks === 0
            ? proj.status === 'Completed'
              ? 100
              : proj.status === 'In Progress'
              ? 50
              : 0
            : Math.round((projCompletedTasks / projTotalTasks) * 100);

        const formattedDeadline = proj.deadline
          ? new Date(proj.deadline).toISOString().split('T')[0]
          : 'No deadline';

        return {
          id: proj._id,
          name: proj.name,
          status: proj.status,
          deadline: formattedDeadline,
          progress: progressPercentage,
          totalTasks: projTotalTasks,
          completedTasks: projCompletedTasks,
        };
      })
    );

    res.status(200).json({
      success: true,
      organisation: organisation
        ? {
            id: organisation._id,
            name: organisation.name,
            slug: organisation.slug,
            plan: organisation.plan || 'free',
          }
        : null,
      stats: {
        totalEmployees,
        totalProjects,
        activeProjects,
        pendingTasks,
        completedTasks,
        totalTasks,
      },
      recentProjects,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
};
