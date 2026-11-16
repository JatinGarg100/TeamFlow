const mongoose = require('mongoose');
const { Task, Project, Membership, User } = require('../models');
const { sendTaskAssignmentEmail } = require('../services/mailer');

/**
 * GET /api/projects/:projectId/tasks
 * ----------------------------------
 * Retrieves all tasks for a project.
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

    const tasks = await Task.find({ projectId: project._id })
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tasks/my
 * -----------------
 * Retrieves all tasks assigned to the current authenticated employee across all projects.
 */
const getMyTasks = async (req, res, next) => {
  try {
    // Find all organisations user belongs to
    const userMemberships = await Membership.find({ userId: req.user._id });
    const orgIds = userMemberships.map((m) => m.orgId);

    // Query tasks where current user is in assignedTo array
    const tasks = await Task.find({
      orgId: { $in: orgIds },
      assignedTo: req.user._id,
    })
      .populate('projectId', 'name status deadline')
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
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

        // Verify user belongs to this organisation
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

        // Auto-add employee to project.teamMembers if not already present
        const isTeamMember = project.teamMembers.some(
          (memberId) => memberId.toString() === id.toString()
        );

        if (!isTeamMember) {
          project.teamMembers.push(id);
          await project.save();
        }

        validAssigneeIds.push(id.toString());
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

    // 8. Send Email Notifications to newly assigned employees (non-blocking)
    if (validAssigneeIds.length > 0) {
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

    // Calculate metrics directly from actual Task documents in MongoDB
    const totalTasks = await Task.countDocuments({ projectId: project._id });
    const completedTasks = await Task.countDocuments({
      projectId: project._id,
      status: 'Completed',
    });

    const pendingTasks = totalTasks - completedTasks;
    const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    res.status(200).json({
      success: true,
      projectId: project._id,
      totalTasks,
      completedTasks,
      pendingTasks,
      percentage,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjectTasks,
  getMyTasks,
  createTask,
  updateTask,
  getProjectProgress,
};
