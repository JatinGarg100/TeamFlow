const { ActivityLog } = require('../models');

/**
 * Creates an activity log entry safely without breaking caller execution.
 *
 * @param {Object} params
 * @param {string|ObjectId} [params.organisation] - Organisation ID
 * @param {string|ObjectId} [params.orgId] - Organisation ID alias
 * @param {string|ObjectId} [params.project] - Project ID
 * @param {string|ObjectId} [params.projectId] - Project ID alias
 * @param {string|ObjectId} [params.task] - Task ID
 * @param {string|ObjectId} [params.taskId] - Task ID alias
 * @param {Object|string|ObjectId} params.user - User document or ID
 * @param {string|ObjectId} [params.userId] - User ID alias
 * @param {string} params.action - Action identifier (e.g. 'TASK_CREATED')
 * @param {string} params.description - Human-readable description
 * @param {Object} [params.metadata] - Extra snapshot data (e.g. { projectName, taskTitle, prevStatus, newStatus })
 */
const logActivity = async ({
  organisation,
  orgId,
  project,
  projectId,
  task,
  taskId,
  user,
  userId,
  action,
  description,
  metadata = {},
}) => {
  try {
    const finalOrgId = organisation || orgId;
    const finalUserId = (user && (user._id || user.id)) || userId;
    const finalProjectId = (project && (project._id || project.id)) || projectId || null;
    const finalTaskId = (task && (task._id || task.id)) || taskId || null;

    if (!finalOrgId || !finalUserId || !action || !description) {
      console.warn('[ActivityLog] Missing required parameters:', {
        hasOrg: Boolean(finalOrgId),
        hasUser: Boolean(finalUserId),
        hasAction: Boolean(action),
        hasDesc: Boolean(description),
      });
      return null;
    }

    const activity = await ActivityLog.create({
      organisation: finalOrgId,
      project: finalProjectId,
      task: finalTaskId,
      user: finalUserId,
      action: action.trim(),
      description: description.trim(),
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
    });

    return activity;
  } catch (err) {
    // Fail safely: Never let activity logging disrupt the primary transaction/request
    console.warn('[ActivityLog Warning] Failed to record activity:', err.message);
    return null;
  }
};

/**
 * Retrieves activity logs for an organisation with optional project/task filtering.
 */
const getActivityLogs = async ({
  orgId,
  projectId = null,
  taskId = null,
  page = 1,
  limit = 20,
}) => {
  const query = { organisation: orgId };
  if (projectId) {
    query.project = projectId;
  }
  if (taskId) {
    query.task = taskId;
  }

  const skip = (page - 1) * limit;

  const [totalItems, rawActivities] = await Promise.all([
    ActivityLog.countDocuments(query),
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email role')
      .populate('project', 'name status')
      .populate('task', 'title status priority')
      .lean(),
  ]);

  // Enhance items so that if project or task document was deleted, metadata fallback is exposed cleanly
  const activities = rawActivities.map((act) => ({
    ...act,
    projectName: act.project?.name || act.metadata?.projectName || null,
    taskTitle: act.task?.title || act.metadata?.taskTitle || null,
    userName: act.user?.name || act.metadata?.userName || 'Team Member',
  }));

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    activities,
    totalItems,
    totalPages,
    currentPage: page,
    limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

module.exports = {
  logActivity,
  getActivityLogs,
};
