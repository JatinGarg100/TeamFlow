const mongoose = require('mongoose');
const { Comment, Task, Membership } = require('../models');
const { logActivity } = require('../services/activityLog.service');
const { parsePagination, formatPaginatedResponse } = require('../utils/pagination');

/**
 * GET /api/tasks/:taskId/comments
 * -------------------------------
 * Retrieves comments for a task in chronological order.
 * Verifications:
 * - taskId format.
 * - Task exists.
 * - Authenticated user belongs to the organisation owning the task.
 */
const getTaskComments = async (req, res, next) => {
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

    // Verify caller belongs to the task's organisation
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

    // Pagination (optional, default up to 50 comments)
    const { page, limit, skip } = parsePagination(req.query, 50, 100);

    const [totalItems, comments] = await Promise.all([
      Comment.countDocuments({ task: task._id }),
      Comment.find({ task: task._id })
        .sort({ createdAt: 1 }) // Chronological order
        .skip(skip)
        .limit(limit)
        .populate('author', 'name email role'),
    ]);

    const formatted = formatPaginatedResponse({
      data: comments,
      totalItems,
      page,
      limit,
      extra: { comments },
    });

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tasks/:taskId/comments
 * --------------------------------
 * Adds a new comment to a task.
 * Verifications:
 * - taskId format.
 * - Task exists.
 * - Authenticated user belongs to the organisation owning the task.
 * - Validates comment text (cannot be empty).
 * - Sets author securely to req.user._id.
 * - Records activity log.
 */
const createTaskComment = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid task ID format.' },
      });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Comment text cannot be empty.' },
      });
    }

    if (text.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        error: { message: 'Comment text cannot exceed 2000 characters.' },
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found.' },
      });
    }

    // Verify caller belongs to the task's organisation
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

    // Create comment
    const comment = await Comment.create({
      task: task._id,
      project: task.projectId,
      organisation: task.orgId,
      author: req.user._id,
      text: text.trim(),
    });

    const populatedComment = await Comment.findById(comment._id).populate(
      'author',
      'name email role'
    );

    // Record activity
    await logActivity({
      orgId: task.orgId,
      projectId: task.projectId,
      taskId: task._id,
      user: req.user,
      action: 'COMMENT_ADDED',
      description: `${req.user.name} commented on task "${task.title}".`,
      metadata: {
        taskTitle: task.title,
        commentSnippet: text.trim().substring(0, 100),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      comment: populatedComment,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTaskComments,
  createTaskComment,
};
