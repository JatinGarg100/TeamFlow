const mongoose = require('mongoose');
const { Task, Project, Membership, User } = require('../models');
const { sendTaskAssignmentEmail } = require('../services/mailer');
const { createNotification } = require('../services/notificationService');
const { parsePagination, formatPaginatedResponse, escapeRegex } = require('../utils/pagination');
const { logActivity } = require('../services/activityLog.service');

/**
 * GET /api/projects/:projectId/tasks
 * ----------------------------------
 * Retrieves tasks for a project with:
 * - Pagination (?page=1&limit=10)
 * - Search (?search=keyword in title or description)
 * - Filtering (?status=...&priority=...&assignedTo=...)
 * - Sorting (?sortBy=createdAt|dueDate|priority|status&sortOrder=asc|desc)
 *
 * Verified: Authenticated user must belong to the organisation owning the project.
 */
const getProjectTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
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

    // Check membership in the organisation
    const membership = await Membership.findOne({
      orgId: project.orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to the organisation that owns this project.' },
      });
    }

    // Build filter
    const filter = {
      projectId: project._id,
    };

    if (req.query.status && ['To Do', 'In Progress', 'Completed', 'Pending'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.priority && ['Low', 'Medium', 'High'].includes(req.query.priority)) {
      filter.priority = req.query.priority;
    }

    if (req.query.assignedTo && mongoose.Types.ObjectId.isValid(req.query.assignedTo)) {
      filter.assignedTo = new mongoose.Types.ObjectId(req.query.assignedTo);
    }

    // Overdue & Due Date Filters
    if (req.query.overdue === 'true' || req.query.dueDateFilter === 'overdue') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: 'Completed' };
    } else if (req.query.dueDateFilter === 'upcoming') {
      filter.dueDate = { $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
    } else if (req.query.dueDateFilter === 'past_due') {
      filter.dueDate = { $lt: new Date() };
    } else if (req.query.dueBefore || req.query.dueAfter) {
      filter.dueDate = {};
      if (req.query.dueBefore) {
        filter.dueDate.$lte = new Date(req.query.dueBefore);
      }
      if (req.query.dueAfter) {
        filter.dueDate.$gte = new Date(req.query.dueAfter);
      }
    }

    // Search keyword
    if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
      const sanitized = escapeRegex(req.query.search.trim());
      filter.$or = [
        { title: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
      ];
    }

    // Sorting
    const allowedSortFields = ['createdAt', 'dueDate', 'priority', 'status', 'title'];
    const sortBy = allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    // Pagination
    const { page, limit, skip } = parsePagination(req.query, 10, 50);

    const [totalItems, tasks] = await Promise.all([
      Task.countDocuments(filter),
      Task.find(filter)
        .populate('assignedTo', 'name email role')
        .populate('createdBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json(
      formatPaginatedResponse({
        data: tasks,
        totalItems,
        page,
        limit,
        extra: {
          count: tasks.length,
          tasks,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tasks/my
 * -----------------
 * Retrieves all tasks assigned to the current authenticated employee across all projects with:
 * - Pagination (?page=1&limit=10)
 * - Filtering (?status=...&priority=...&projectId=...)
 * - Search (?search=keyword)
 */
const getMyTasks = async (req, res, next) => {
  try {
    if (req.query.orgId && !mongoose.Types.ObjectId.isValid(req.query.orgId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid organisation ID format.' },
      });
    }

    // Find all organisations user belongs to
    const userMemberships = await Membership.find({ userId: req.user._id });
    const orgIds = userMemberships.map((m) => m.orgId);

    // Organisation scoping
    let targetOrgFilter = { $in: orgIds };
    let activeMembership = userMemberships[0];

    if (req.query.orgId) {
      const matched = userMemberships.find((m) => m.orgId.toString() === req.query.orgId);
      if (!matched) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied. You do not belong to this organisation.' },
        });
      }
      targetOrgFilter = new mongoose.Types.ObjectId(req.query.orgId);
      activeMembership = matched;
    }

    const isManager = activeMembership && ['owner', 'admin', 'manager'].includes(activeMembership.role);

    // Query filter
    const filter = {
      orgId: targetOrgFilter,
    };

    // Assignee filtering: Default to current user; allow managers or specific queries to filter by assignee
    if (req.query.assignedTo) {
      if (req.query.assignedTo === 'all' && isManager) {
        // Managers can view all tasks in the organisation
      } else if (mongoose.Types.ObjectId.isValid(req.query.assignedTo)) {
        filter.assignedTo = new mongoose.Types.ObjectId(req.query.assignedTo);
      } else {
        filter.assignedTo = req.user._id;
      }
    } else {
      filter.assignedTo = req.user._id;
    }

    // Status filtering
    if (req.query.status && ['To Do', 'In Progress', 'Completed', 'Pending'].includes(req.query.status)) {
      filter.status = req.query.status === 'Pending' ? 'To Do' : req.query.status;
    }

    // Priority filtering
    if (req.query.priority && ['Low', 'Medium', 'High'].includes(req.query.priority)) {
      filter.priority = req.query.priority;
    }

    // Overdue & Due Date Filters
    if (req.query.overdue === 'true' || req.query.dueDateFilter === 'overdue') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: 'Completed' };
    } else if (req.query.dueDateFilter === 'upcoming') {
      filter.dueDate = { $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
    } else if (req.query.dueDateFilter === 'past_due') {
      filter.dueDate = { $lt: new Date() };
    } else if (req.query.dueBefore || req.query.dueAfter) {
      filter.dueDate = {};
      if (req.query.dueBefore) {
        filter.dueDate.$lte = new Date(req.query.dueBefore);
      }
      if (req.query.dueAfter) {
        filter.dueDate.$gte = new Date(req.query.dueAfter);
      }
    }

    if (req.query.projectId && mongoose.Types.ObjectId.isValid(req.query.projectId)) {
      filter.projectId = new mongoose.Types.ObjectId(req.query.projectId);
    }

    if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
      const sanitized = escapeRegex(req.query.search.trim());
      filter.$or = [
        { title: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
      ];
    }

    // Sorting
    const allowedSortFields = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'status'];
    const sortBy = allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : 'updatedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const { page, limit, skip } = parsePagination(req.query, 10, 50);

    const [totalItems, tasks] = await Promise.all([
      Task.countDocuments(filter),
      Task.find(filter)
        .populate('projectId', 'name status deadline')
        .populate('assignedTo', 'name email role')
        .populate('createdBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit),
    ]);

    res.status(200).json(
      formatPaginatedResponse({
        data: tasks,
        totalItems,
        page,
        limit,
        extra: {
          count: tasks.length,
          tasks,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/projects/:projectId/tasks
 * -----------------------------------
 * Creates a new task in the specified project.
 * Rules:
 * - Only authorised managers (owner, admin, manager) can create tasks and assign them.
 * - Supports multiple assignees (assignedTo: [userId1, userId2]).
 * - Every assigned employee must belong to the organisation AND the project team.
 * - Automatically dispatches email notifications to newly assigned employees.
 * - createdBy is derived securely from req.user._id.
 */
const createTask = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { title, description = '', assignedTo, priority = 'Medium', dueDate, status = 'To Do' } = req.body;

    // 1. Validate Project ID & Existence
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
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

    // 2. Check user's membership in organisation
    const membership = await Membership.findOne({
      orgId: project.orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to this organisation.' },
      });
    }

    // 3. Rule 3: Only authorised managers can create tasks
    const isManager = ['owner', 'admin', 'manager'].includes(membership.role);
    if (!isManager) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden. Only organisation owners, admins, or project managers can create tasks.' },
      });
    }

    // 4. Validate Task Title
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Task title is required (at least 2 characters).' },
      });
    }

    // 5. Validate Priority & Status enums
    const allowedPriorities = ['Low', 'Medium', 'High'];
    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: { message: `Priority must be one of: ${allowedPriorities.join(', ')}` },
      });
    }

    const allowedStatuses = ['To Do', 'In Progress', 'Completed', 'Pending'];
    const taskStatus = status === 'Pending' ? 'To Do' : status;
    if (taskStatus && !allowedStatuses.includes(taskStatus)) {
      return res.status(400).json({
        success: false,
        error: { message: `Status must be one of: To Do, In Progress, Completed` },
      });
    }

    // 6. Handle multiple assignees: validate every assignee belongs to project team
    let validAssigneeIds = [];
    if (assignedTo !== undefined && assignedTo !== null) {
      const incomingAssignees = Array.isArray(assignedTo) ? assignedTo : [assignedTo];

      for (const id of incomingAssignees) {
        if (!id) continue;
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            error: { message: `Invalid assignee user ID format: ${id}` },
          });
        }

        // Verify user belongs to this organisation (allow both User ID or Membership ID)
        let isOrgMember = await Membership.findOne({
          orgId: project.orgId,
          userId: id,
        });

        if (!isOrgMember) {
          isOrgMember = await Membership.findOne({
            orgId: project.orgId,
            _id: id,
          });
        }

        if (!isOrgMember) {
          return res.status(400).json({
            success: false,
            error: { message: 'All assigned employees must belong to this organisation.' },
          });
        }

        const actualUserId = isOrgMember.userId.toString();

        // Auto-add employee to project.teamMembers if not already present
        const isTeamMember = project.teamMembers.some(
          (memberId) => memberId.toString() === actualUserId
        );

        if (!isTeamMember) {
          project.teamMembers.push(actualUserId);
          await project.save();
        }

        validAssigneeIds.push(actualUserId);
      }

      // Deduplicate
      validAssigneeIds = [...new Set(validAssigneeIds)];
    }

    // 7. Create Task document
    const task = await Task.create({
      orgId: project.orgId,
      projectId: project._id,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      assignedTo: validAssigneeIds,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: taskStatus,
      createdBy: req.user._id,
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email');

    // Record activity
    await logActivity({
      orgId: project.orgId,
      projectId: project._id,
      taskId: task._id,
      user: req.user,
      action: 'TASK_CREATED',
      description: `${req.user.name} created task "${task.title}".`,
      metadata: {
        projectName: project.name,
        taskTitle: task.title,
        priority: task.priority,
        status: task.status,
      },
    });

    // 8. Send In-App & Email Notifications to newly assigned employees (non-blocking)
    if (validAssigneeIds.length > 0) {
      // In-app notifications
      for (const assigneeId of validAssigneeIds) {
        createNotification({
          recipient: assigneeId,
          orgId: project.orgId,
          sender: req.user._id,
          type: 'TASK_ASSIGNED',
          title: `New task assigned: ${task.title}`,
          message: `${req.user.name} assigned you to "${task.title}" in project "${project.name}".`,
          link: `/projects/${project._id}?task=${task._id}`,
          metadata: { taskId: task._id, projectId: project._id },
        });
      }

      (async () => {
        try {
          const assignees = await User.find({ _id: { $in: validAssigneeIds } });
          for (const assignee of assignees) {
            await sendTaskAssignmentEmail({
              recipientEmail: assignee.email,
              recipientName: assignee.name,
              taskTitle: task.title,
              projectName: project.name,
              taskDescription: task.description,
              dueDate: task.dueDate,
              priority: task.priority,
              taskId: task._id,
              projectId: project._id,
            });
          }
        } catch (emailErr) {
          console.warn('[Task] Task created, but email notification failed:', emailErr.message);
        }
      })();
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully.',
      task: populatedTask,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/tasks/:taskId
 * ------------------------
 * Updates a task.
 * Rules:
 * - Managers can update any field (title, description, priority, dueDate, status, assignedTo).
 * - Employees may update ONLY the status of tasks assigned to them.
 * - Supports multiple assignees.
 * - Shared task status: any assigned employee may update status, applies to the task for everyone.
 * - Dispatches email notifications only to newly added assignees when assignedTo is modified.
 */
const updateTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid task ID format.' },
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.' },
      });
    }

    // Verify user belongs to the organisation
    const membership = await Membership.findOne({
      orgId: task.orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to the organisation that owns this task.' },
      });
    }

    const isManager = ['owner', 'admin', 'manager'].includes(membership.role);
    const isAssigned = Array.isArray(task.assignedTo) && task.assignedTo.some(
      (assigneeId) => assigneeId.toString() === req.user._id.toString()
    );

    // Rule: Normal employees can update ONLY tasks assigned to them, and ONLY the status field
    if (!isManager) {
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: { message: 'Employees can only update tasks assigned directly to them.' },
        });
      }

      // Check if employee tried to modify non-status fields
      const attemptedFields = Object.keys(req.body);
      const invalidFields = attemptedFields.filter((field) => field !== 'status');

      if (invalidFields.length > 0) {
        return res.status(403).json({
          success: false,
          error: { message: 'Employees are only permitted to update the status of their assigned tasks.' },
        });
      }
    }

    const { title, description, priority, dueDate, status, assignedTo } = req.body;
    const previousStatus = task.status;

    // Status update (Shared status: updates task for everyone)
    if (status !== undefined) {
      const allowedStatuses = ['To Do', 'In Progress', 'Completed', 'Pending'];
      const standardStatus = status === 'Pending' ? 'To Do' : status;

      if (!allowedStatuses.includes(standardStatus)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Status must be one of: To Do, In Progress, Completed' },
        });
      }
      task.status = standardStatus;
    }

    let newlyAddedAssigneeIds = [];

    // Manager-only updates
    if (isManager) {
      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length < 2) {
          return res.status(400).json({
            success: false,
            error: { message: 'Task title must be at least 2 characters.' },
          });
        }
        task.title = title.trim();
      }

      if (description !== undefined) {
        task.description = typeof description === 'string' ? description.trim() : '';
      }

      if (priority !== undefined) {
        const allowedPriorities = ['Low', 'Medium', 'High'];
        if (!allowedPriorities.includes(priority)) {
          return res.status(400).json({
            success: false,
            error: { message: `Priority must be one of: ${allowedPriorities.join(', ')}` },
          });
        }
        task.priority = priority;
      }

      if (dueDate !== undefined) {
        task.dueDate = dueDate ? new Date(dueDate) : null;
      }

      // Update assignees (Multiple assignees support)
      if (assignedTo !== undefined) {
        const project = await Project.findById(task.projectId);
        let newAssigneeIds = [];

        if (Array.isArray(assignedTo)) {
          for (const id of assignedTo) {
            if (!id) continue;
            if (!mongoose.Types.ObjectId.isValid(id)) {
              return res.status(400).json({
                success: false,
                error: { message: `Invalid assignedTo user ID format: ${id}` },
              });
            }

            // Verify assigned user belongs to this organisation
            const isOrgMember = await Membership.findOne({
              orgId: project.orgId,
              userId: id,
            });

            if (!isOrgMember) {
              return res.status(400).json({
                success: false,
                error: { message: 'All assigned employees must belong to this organisation.' },
              });
            }

            // Auto-add assigned user to project.teamMembers if not already present
            const isTeamMember = project.teamMembers.some(
              (mId) => mId.toString() === id.toString()
            );

            if (!isTeamMember) {
              project.teamMembers.push(id);
              await project.save();
            }

            newAssigneeIds.push(id.toString());
          }
        } else if (assignedTo !== null) {
          if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
            return res.status(400).json({
              success: false,
              error: { message: 'Invalid assignedTo user ID format.' },
            });
          }

          const isOrgMember = await Membership.findOne({
            orgId: project.orgId,
            userId: assignedTo,
          });

          if (!isOrgMember) {
            return res.status(400).json({
              success: false,
              error: { message: 'Assigned employee must belong to this organisation.' },
            });
          }

          const isTeamMember = project.teamMembers.some(
            (mId) => mId.toString() === assignedTo.toString()
          );

          if (!isTeamMember) {
            project.teamMembers.push(assignedTo);
            await project.save();
          }

          newAssigneeIds.push(assignedTo.toString());
        }

        // Deduplicate
        newAssigneeIds = [...new Set(newAssigneeIds)];

        // Calculate newly added assignees for email notifications
        const currentAssigneeStrings = (task.assignedTo || []).map((id) => id.toString());
        newlyAddedAssigneeIds = newAssigneeIds.filter(
          (id) => !currentAssigneeStrings.includes(id)
        );

        task.assignedTo = newAssigneeIds;
      }
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email');

    // Notify newly added assignees only (avoiding duplicates)
    if (newlyAddedAssigneeIds.length > 0) {
      for (const assigneeId of newlyAddedAssigneeIds) {
        createNotification({
          recipient: assigneeId,
          orgId: task.orgId,
          sender: req.user._id,
          type: 'TASK_ASSIGNED',
          title: `Assigned to task: ${task.title}`,
          message: `${req.user.name} assigned you to "${task.title}".`,
          link: `/projects/${task.projectId}?task=${task._id}`,
          metadata: { taskId: task._id, projectId: task.projectId },
        });
      }

      (async () => {
        try {
          const project = await Project.findById(task.projectId);
          const newAssignees = await User.find({ _id: { $in: newlyAddedAssigneeIds } });
          for (const assignee of newAssignees) {
            await sendTaskAssignmentEmail({
              recipientEmail: assignee.email,
              recipientName: assignee.name,
              taskTitle: task.title,
              projectName: project.name,
              taskDescription: task.description,
              dueDate: task.dueDate,
              priority: task.priority,
              taskId: task._id,
              projectId: project._id,
            });
          }
        } catch (emailErr) {
          console.warn('[Task] Assignees updated, email notification error:', emailErr.message);
        }
      })();
    }

    // In-app notification for status change
    if (previousStatus !== task.status) {
      const recipientsToNotify = new Set();
      if (task.createdBy) recipientsToNotify.add(task.createdBy.toString());
      if (Array.isArray(task.assignedTo)) {
        task.assignedTo.forEach((a) => recipientsToNotify.add(a.toString()));
      }
      for (const rId of recipientsToNotify) {
        createNotification({
          recipient: rId,
          orgId: task.orgId,
          sender: req.user._id,
          type: 'TASK_STATUS_CHANGED',
          title: `Task status updated: ${task.title}`,
          message: `${req.user.name} updated status to "${task.status}".`,
          link: `/projects/${task.projectId}?task=${task._id}`,
          metadata: { taskId: task._id, projectId: task.projectId, oldStatus: previousStatus, newStatus: task.status },
        });
      }
    }

    // Record activity
    let activityAction = 'TASK_UPDATED';
    let activityDesc = `${req.user.name} updated task "${task.title}".`;

    if (previousStatus !== task.status) {
      if (task.status === 'Completed') {
        activityAction = 'TASK_COMPLETED';
        activityDesc = `${req.user.name} completed task "${task.title}".`;
      } else {
        activityAction = 'TASK_STATUS_CHANGED';
        activityDesc = `${req.user.name} changed task "${task.title}" status from "${previousStatus}" to "${task.status}".`;
      }
    } else if (newlyAddedAssigneeIds.length > 0) {
      activityAction = 'TASK_ASSIGNED';
      activityDesc = `${req.user.name} assigned task "${task.title}" to ${newlyAddedAssigneeIds.length} team member(s).`;
    }

    await logActivity({
      orgId: task.orgId,
      projectId: task.projectId,
      taskId: task._id,
      user: req.user,
      action: activityAction,
      description: activityDesc,
      metadata: {
        taskTitle: task.title,
        previousStatus,
        newStatus: task.status,
        priority: task.priority,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Task updated successfully.',
      task: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:projectId/progress
 * -------------------------------------
 * Calculates project progress based on live task records:
 * Progress = completed tasks / total tasks × 100.
 * If total tasks is 0, progress is 0%.
 */
/**
 * GET /api/projects/:projectId/progress
 * -------------------------------------
 * TASK 7: MongoDB Aggregation
 * Computes comprehensive task progress breakdown using an aggregation pipeline:
 * - totalTasks
 * - completedTasks
 * - inProgressTasks
 * - todoTasks
 * - pendingTasks
 * - percentage
 *
 * Replaces multiple separate countDocuments queries with a single atomic aggregation pipeline.
 */
const getProjectProgress = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
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

    // Check membership in the organisation
    const membership = await Membership.findOne({
      orgId: project.orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to the organisation that owns this project.' },
      });
    }

    // TASK 7: Single-pass MongoDB Aggregation pipeline for project metrics
    const stats = await Task.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
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
            $sum: { $cond: [{ $eq: ['$status', 'To Do'] }, 1, 0] },
          },
          pendingTasks: {
            $sum: { $cond: [{ $ne: ['$status', 'Completed'] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      todoTasks: 0,
      pendingTasks: 0,
    };

    const percentage =
      result.totalTasks === 0
        ? 0
        : Math.round((result.completedTasks / result.totalTasks) * 100);

    res.status(200).json({
      success: true,
      projectId: project._id,
      totalTasks: result.totalTasks,
      completedTasks: result.completedTasks,
      inProgressTasks: result.inProgressTasks,
      todoTasks: result.todoTasks,
      pendingTasks: result.pendingTasks,
      percentage,
    });
  } catch (error) {
    next(error);
  }
};

const fs = require('fs');
const path = require('path');
const { uploadDir } = require('../middleware/uploadMiddleware');

/**
 * POST /api/tasks/:taskId/attachments
 * -----------------------------------
 * Uploads one or multiple files as attachments to a task.
 * Rules:
 * - User must belong to the organisation owning the task.
 * - Files are written to disk with secure random filenames.
 * - Metadata is pushed to task.attachments in MongoDB.
 * - If a database error occurs, uploaded files on disk are safely rolled back/cleaned up.
 */
const uploadTaskAttachments = async (req, res, next) => {
  const uploadedFiles = req.files || (req.file ? [req.file] : []);

  try {
    const { taskId } = req.params;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded. Please select a valid document or image.' },
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      // Clean up uploaded files since task doesn't exist
      for (const file of uploadedFiles) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.' },
      });
    }

    // Verify user belongs to task's organisation
    const membership = await Membership.findOne({
      orgId: task.orgId,
      userId: req.user._id,
    });

    if (!membership) {
      for (const file of uploadedFiles) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to the organisation that owns this task.' },
      });
    }

    // Create attachment metadata records
    const newAttachments = uploadedFiles.map((file) => ({
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    }));

    task.attachments.push(...newAttachments);
    await task.save();

    // Populate uploader details for response
    const updatedTask = await Task.findById(task._id)
      .populate('attachments.uploadedBy', 'name email');

    // Record activity
    await logActivity({
      orgId: task.orgId,
      projectId: task.projectId,
      taskId: task._id,
      user: req.user,
      action: 'ATTACHMENT_UPLOADED',
      description: `${req.user.name} attached ${uploadedFiles.length} file(s) to task "${task.title}".`,
      metadata: {
        taskTitle: task.title,
        fileCount: uploadedFiles.length,
        fileNames: uploadedFiles.map((f) => f.originalname),
      },
    });

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${uploadedFiles.length} file(s).`,
      attachments: updatedTask.attachments,
    });
  } catch (error) {
    // Rollback uploaded files on disk in case of database or runtime error
    for (const file of uploadedFiles) {
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupErr) {
          console.warn('[Cleanup Error] Could not delete file:', file.path);
        }
      }
    }
    next(error);
  }
};

/**
 * GET /api/tasks/:taskId/attachments/:attachmentId
 * ------------------------------------------------
 * Serves an attachment file for viewing or downloading.
 * Rules:
 * - User must belong to the organisation.
 * - Prevents path traversal using strict basename resolution.
 * - Sets safe Content-Disposition and MIME headers.
 */
const downloadTaskAttachment = async (req, res, next) => {
  try {
    const { taskId, attachmentId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.' },
      });
    }

    // Verify user belongs to the organisation
    const membership = await Membership.findOne({
      orgId: task.orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to the organisation that owns this task.' },
      });
    }

    // Find attachment subdocument
    const attachment = task.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Attachment not found.' },
      });
    }

    // Secure path resolution: ensure it stays within uploadDir
    const safeFilename = path.basename(attachment.storedName);
    const filePath = path.join(uploadDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: { message: 'Attachment file does not exist on disk.' },
      });
    }

    // Query param ?download=true forces download, otherwise preview/inline
    const isDownload = req.query.download === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(attachment.originalName)}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tasks/:taskId/attachments/:attachmentId
 * ---------------------------------------------------
 * Removes an attachment from MongoDB and deletes the physical file from disk.
 * Rules:
 * - User must belong to organisation.
 * - Only the uploader, task manager, or organisation admin/owner may delete attachments.
 */
const deleteTaskAttachment = async (req, res, next) => {
  try {
    const { taskId, attachmentId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.' },
      });
    }

    // Check membership
    const membership = await Membership.findOne({
      orgId: task.orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to the organisation that owns this task.' },
      });
    }

    const attachment = task.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Attachment not found on this task.' },
      });
    }

    // Permission check: uploader or admin/owner
    const isUploader = attachment.uploadedBy.toString() === req.user._id.toString();
    const isAdminOrOwner = ['owner', 'admin'].includes(membership.role);

    if (!isUploader && !isAdminOrOwner) {
      return res.status(403).json({
        success: false,
        error: { message: 'You do not have permission to delete this attachment.' },
      });
    }

    // Delete file from disk safely
    const safeFilename = path.basename(attachment.storedName);
    const filePath = path.join(uploadDir, safeFilename);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (fsErr) {
        console.warn('[Attachment Delete Warning] Could not delete file from disk:', fsErr.message);
      }
    }

    // Remove subdocument from MongoDB
    const deletedOriginalName = attachment.originalName;
    task.attachments.pull(attachmentId);
    await task.save();

    // Record activity
    await logActivity({
      orgId: task.orgId,
      projectId: task.projectId,
      taskId: task._id,
      user: req.user,
      action: 'ATTACHMENT_DELETED',
      description: `${req.user.name} removed attachment "${deletedOriginalName}" from task "${task.title}".`,
      metadata: {
        taskTitle: task.title,
        attachmentName: deletedOriginalName,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Attachment deleted successfully.',
      attachmentId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tasks/:taskId
 * -------------------------
 * Deletes a task and performs safe cleanup:
 * 1. Checks that caller belongs to the task's organization.
 * 2. Checks permission: Only organization owner, admin, or manager can delete tasks.
 * 3. Safely removes all associated physical attachment files from disk.
 * 4. Deletes the task from MongoDB.
 */
const deleteTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid task ID format.' },
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.' },
      });
    }

    // Verify caller belongs to the organisation that owns this task
    const membership = await Membership.findOne({
      orgId: task.orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to the organisation that owns this task.' },
      });
    }

    // Role check: Only owner, admin, or manager can delete tasks
    const allowedRoles = ['owner', 'admin', 'manager'];
    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden. Only organization owners, admins, or managers can delete tasks.' },
      });
    }

    // Safely remove any attachments on disk
    let deletedFilesCount = 0;
    if (Array.isArray(task.attachments) && task.attachments.length > 0) {
      for (const att of task.attachments) {
        if (att.storedName) {
          const safeFilename = path.basename(att.storedName);
          const filePath = path.join(uploadDir, safeFilename);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              deletedFilesCount++;
            } catch (fsErr) {
              console.warn('[Task Delete Warning] Could not delete attachment file:', fsErr.message);
            }
          }
        }
      }
    }

    // Delete task from MongoDB
    await Task.deleteOne({ _id: task._id });

    // Record activity
    await logActivity({
      orgId: task.orgId,
      projectId: task.projectId,
      taskId: task._id,
      user: req.user,
      action: 'TASK_DELETED',
      description: `${req.user.name} deleted task "${task.title}".`,
      metadata: {
        taskTitle: task.title,
        projectId: task.projectId,
        deletedFilesCount,
      },
    });

    res.status(200).json({
      success: true,
      message: `Task "${task.title}" was deleted successfully.`,
      deletedTaskId: task._id,
      projectId: task.projectId,
      deletedFilesCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tasks
 * --------------
 * Retrieves tasks across the organisation (used by Calendar View and multi-project overviews).
 * Supports filters:
 * - orgId (from header x-org-id or query)
 * - projectId
 * - hasDueDate=true
 * - startDate / dueAfter ($gte)
 * - endDate / dueBefore ($lte)
 * - status, priority, assignedTo
 * Protected by requireAuth and verified via Membership check.
 */
const getTasks = async (req, res, next) => {
  try {
    const rawOrgId = req.query.orgId || req.headers['x-org-id'];

    if (!rawOrgId || !mongoose.Types.ObjectId.isValid(rawOrgId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Valid organisation ID is required via query param ?orgId= or x-org-id header.' },
      });
    }

    const orgObjectId = new mongoose.Types.ObjectId(rawOrgId);

    // Verify user belongs to the organisation
    const membership = await Membership.findOne({
      orgId: orgObjectId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to this organisation.' },
      });
    }

    const filter = { orgId: orgObjectId };

    // Project filter
    if (req.query.projectId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.projectId)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid project ID format.' },
        });
      }
      const project = await Project.findOne({
        _id: req.query.projectId,
        orgId: orgObjectId,
      });
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: 'Project not found in this organisation.' },
        });
      }
      filter.projectId = project._id;
    }

    // Due date presence requirement (essential for calendar views)
    if (req.query.hasDueDate === 'true') {
      filter.dueDate = { $ne: null, $exists: true };
    }

    // Date range filtering
    const start = req.query.startDate || req.query.dueAfter;
    const end = req.query.endDate || req.query.dueBefore;

    if (start || end) {
      filter.dueDate = filter.dueDate || {};
      if (start) {
        filter.dueDate.$gte = new Date(start);
      }
      if (end) {
        filter.dueDate.$lte = new Date(end);
      }
    }

    // Status filter
    if (req.query.status && ['To Do', 'In Progress', 'Completed', 'Pending'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    // Priority filter
    if (req.query.priority && ['Low', 'Medium', 'High'].includes(req.query.priority)) {
      filter.priority = req.query.priority;
    }

    // AssignedTo filter
    if (req.query.assignedTo && mongoose.Types.ObjectId.isValid(req.query.assignedTo)) {
      filter.assignedTo = new mongoose.Types.ObjectId(req.query.assignedTo);
    }

    const tasks = await Task.find(filter)
      .populate('projectId', 'name status')
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .sort({ dueDate: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tasks/:taskId
 * ----------------------
 * Retrieves a single task with populated references.
 * Protected by requireAuth and organization membership check.
 */
const getTaskById = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid task ID format.' },
      });
    }

    const task = await Task.findById(taskId)
      .populate('projectId', 'name status deadline')
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.' },
      });
    }

    // Check membership in the organisation
    const membership = await Membership.findOne({
      orgId: task.orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not belong to the organisation that owns this task.' },
      });
    }

    res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjectTasks,
  getMyTasks,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getProjectProgress,
  uploadTaskAttachments,
  downloadTaskAttachment,
  deleteTaskAttachment,
};
