const mongoose = require('mongoose');
const { Membership, Project, Task, Organisation } = require('../models');
const { getActivityLogs } = require('../services/activityLog.service');

/**
 * GET /api/dashboard
 * -------------------
 * Returns organisation-specific statistics computed live from MongoDB:
 * - Total employees
 * - Total projects
 * - Active projects (In Progress)
 * - Total tasks
 * - Completed tasks
 * - In Progress tasks
 * - To Do tasks
 * - Pending tasks (To Do / In Progress)
 * - Overdue tasks (dueDate < now AND status != Completed)
 * - Overall completion percentage
 * - Recent projects with live calculated progress
 * - Recent activities timeline scoped to organisation
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
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            todoTasks: 0,
            pendingTasks: 0,
            overdueTasks: 0,
            completionPercentage: 0,
          },
          recentProjects: [],
          recentActivities: [],
        });
      }

      targetOrgId = membership.orgId;
    }

    // 1. Fetch Organisation Info
    const organisation = await Organisation.findById(targetOrgId).select('name slug plan');

    // 2. Fetch Aggregated Statistics & Recent Activities in parallel
    const now = new Date();
    const [membershipCount, projectCount, activeProjectsCount, taskAgg, recentActivitiesResult] = await Promise.all([
      Membership.countDocuments({ orgId: targetOrgId }),
      Project.countDocuments({ orgId: targetOrgId }),
      Project.countDocuments({ orgId: targetOrgId, status: 'In Progress' }),
      Task.aggregate([
        { $match: { orgId: new mongoose.Types.ObjectId(targetOrgId) } },
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
            },
            inProgressTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] },
            },
            todoTasks: {
              $sum: {
                $cond: [
                  { $or: [{ $eq: ['$status', 'To Do'] }, { $eq: ['$status', 'Pending'] }] },
                  1,
                  0,
                ],
              },
            },
            pendingTasks: {
              $sum: { $cond: [{ $ne: ['$status', 'Completed'] }, 1, 0] },
            },
            overdueTasks: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$status', 'Completed'] },
                      { $ne: ['$dueDate', null] },
                      { $lt: ['$dueDate', now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      getActivityLogs({ orgId: targetOrgId, limit: 8 }),
    ]);

    const taskMetrics = taskAgg[0] || {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      todoTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
    };

    const totalEmployees = membershipCount;
    const totalProjects = projectCount;
    const activeProjects = activeProjectsCount;
    const totalTasks = taskMetrics.totalTasks;
    const completedTasks = taskMetrics.completedTasks;
    const inProgressTasks = taskMetrics.inProgressTasks;
    const todoTasks = taskMetrics.todoTasks;
    const pendingTasks = taskMetrics.pendingTasks;
    const overdueTasks = taskMetrics.overdueTasks;

    const completionPercentage =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // 3. Fetch Recent Projects and aggregate their task completion
    const recentProjectsDocs = await Project.find({ orgId: targetOrgId })
      .sort({ createdAt: -1 })
      .limit(5);

    const projectIds = recentProjectsDocs.map((p) => p._id);

    // Aggregate task counts grouped by projectId in one single query
    const projectTaskStats = await Task.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: '$projectId',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
          },
        },
      },
    ]);

    const taskStatsMap = new Map();
    for (const stat of projectTaskStats) {
      taskStatsMap.set(stat._id.toString(), stat);
    }

    const recentProjects = recentProjectsDocs.map((proj) => {
      const stats = taskStatsMap.get(proj._id.toString()) || { total: 0, completed: 0 };
      const projTotalTasks = stats.total;
      const projCompletedTasks = stats.completed;

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
    });

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
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks,
        pendingTasks,
        overdueTasks,
        completionPercentage,
      },
      recentProjects,
      recentActivities: recentActivitiesResult.activities || [],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
};
