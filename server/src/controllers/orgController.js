const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const plansConfig = require('../config/plans');
const { User, Membership, Organisation, Project, Task, Invitation } = require('../models');
const { parsePagination, formatPaginatedResponse, escapeRegex } = require('../utils/pagination');
const { logActivity } = require('../services/activityLog.service');

/**
 * GET /api/orgs/:orgId/members
 * ----------------------------
 * Lists employees/members in the specified organisation with:
 * - Pagination (?page=1&limit=10)
 * - Filtering by role (?role=admin|member|manager|owner)
 * - Search by employee name or email (?search=keyword)
 * Protected by requireAuth and requireOrgAccess.
 */
const getMembers = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid organisation ID format.' },
      });
    }

    const filter = { orgId };

    if (req.query.role && ['owner', 'admin', 'manager', 'member'].includes(req.query.role)) {
      filter.role = req.query.role;
    }

    // Search by name or email across User model
    if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
      const sanitized = escapeRegex(req.query.search.trim());
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: sanitized, $options: 'i' } },
          { email: { $regex: sanitized, $options: 'i' } },
        ],
      }).select('_id');

      const userIds = matchingUsers.map((u) => u._id);
      filter.userId = { $in: userIds };
    }

    const { page, limit, skip } = parsePagination(req.query, 10, 50);

    const [totalItems, memberships] = await Promise.all([
      Membership.countDocuments(filter),
      Membership.find(filter)
        .populate('userId', 'name email avatar createdAt')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
    ]);

    const validMemberships = memberships.filter((m) => m.userId);
    const userIds = validMemberships.map((m) => m.userId._id);

    // Calculate actual project assignment counts and task stats in active organisation
    const projectCountMap = new Map();
    const taskStatsMap = new Map();

    if (userIds.length > 0) {
      const orgObjectId = new mongoose.Types.ObjectId(orgId);

      const [projectCounts, taskCounts] = await Promise.all([
        Project.aggregate([
          { $match: { orgId: orgObjectId, teamMembers: { $in: userIds } } },
          { $unwind: '$teamMembers' },
          { $match: { teamMembers: { $in: userIds } } },
          { $group: { _id: '$teamMembers', count: { $sum: 1 } } },
        ]),
        Task.aggregate([
          { $match: { orgId: orgObjectId, assignedTo: { $in: userIds } } },
          { $unwind: '$assignedTo' },
          { $match: { assignedTo: { $in: userIds } } },
          {
            $group: {
              _id: {
                userId: '$assignedTo',
                isCompleted: { $eq: ['$status', 'Completed'] },
              },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      projectCounts.forEach((p) => {
        projectCountMap.set(p._id.toString(), p.count);
      });

      taskCounts.forEach((t) => {
        const uId = t._id.userId.toString();
        if (!taskStatsMap.has(uId)) {
          taskStatsMap.set(uId, { completed: 0, pending: 0, total: 0 });
        }
        const stats = taskStatsMap.get(uId);
        if (t._id.isCompleted) {
          stats.completed += t.count;
        } else {
          stats.pending += t.count;
        }
        stats.total += t.count;
      });
    }

    const members = validMemberships.map((m) => {
      const uid = m.userId._id.toString();
      const userTasks = taskStatsMap.get(uid) || { completed: 0, pending: 0, total: 0 };
      const assignedProjects = projectCountMap.get(uid) || 0;

      return {
        id: m.userId._id,
        _id: m.userId._id,
        userId: m.userId._id,
        membershipId: m._id,
        name: m.userId.name,
        email: m.userId.email,
        avatar: m.userId.avatar || '',
        role: m.role,
        status: 'Active',
        joinedAt: m.createdAt,
        assignedProjectsCount: assignedProjects,
        completedTasksCount: userTasks.completed,
        pendingTasksCount: userTasks.pending,
        totalTasksCount: userTasks.total,
      };
    });

    res.status(200).json(
      formatPaginatedResponse({
        data: members,
        totalItems,
        page,
        limit,
        extra: {
          count: members.length,
          members,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orgs/:orgId/members
 * -----------------------------
 * Adds an employee directly to the organisation.
 * Protected by requireAuth, requireOrgAccess, and requireAdminOrOwner.
 */
const addMember = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { name, email, password, role = 'member' } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Employee name is required (at least 2 characters).' },
      });
    }

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: { message: 'A valid email address is required.' },
      });
    }

    // Role validation
    const allowedRoles = ['member', 'manager', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid role. Role must be "member", "manager", or "admin".' },
      });
    }

    // Security check: Only an 'owner' can assign 'admin' role
    if (role === 'admin' && req.membership.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only organisation owners can promote members to Admin.' },
      });
    }

    // 2. Plan Limit Check (Free tier allows max 5 members)
    const org = await Organisation.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        error: { message: 'Organisation not found.' },
      });
    }

    const planId = org.plan || 'free';
    const plan = plansConfig.find((p) => p.id === planId) || plansConfig[0];
    const currentMemberCount = await Membership.countDocuments({ orgId });

    if (currentMemberCount >= plan.limits.maxMembers) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Plan member limit reached! The ${plan.name} plan allows a maximum of ${plan.limits.maxMembers} members. You currently have ${currentMemberCount} members. Please upgrade your subscription on the Plans page to add more team members.`,
          code: 'PLAN_LIMIT_REACHED',
          limit: plan.limits.maxMembers,
          current: currentMemberCount,
        },
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 3. Find or create the User
    let targetUser = await User.findOne({ email: cleanEmail });
    let isNewUserCreated = false;

    if (!targetUser) {
      // Validate password if supplied
      if (password !== undefined && (!password || typeof password !== 'string' || password.length < 6)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Password must be at least 6 characters long.' },
        });
      }

      const rawPassword = password || 'TempPassword123!';
      const passwordHash = await bcrypt.hash(rawPassword, 10);

      targetUser = await User.create({
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
      });

      isNewUserCreated = true;
    } else {
      // If user exists and a new password was provided, update their password so they can log in
      if (password && typeof password === 'string' && password.length >= 6) {
        targetUser.passwordHash = await bcrypt.hash(password, 10);
        await targetUser.save();
      }
    }

    // 4. Prevent duplicate memberships in the same organisation
    const existingMembership = await Membership.findOne({
      orgId,
      userId: targetUser._id,
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        error: { message: 'This employee is already a member of this organisation.' },
      });
    }

    // 5. Create Membership record
    const membership = await Membership.create({
      orgId,
      userId: targetUser._id,
      role,
    });

    res.status(201).json({
      success: true,
      message: isNewUserCreated
        ? `Employee account created with password and added to organisation as ${role}.`
        : `Existing user added to organisation as ${role}.`,
      member: {
        id: membership._id,
        userId: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: membership.role,
        status: 'Active',
        joinedAt: membership.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/orgs/:orgId/members/:memberId
 * -----------------------------------------
 * Removes an employee from the organisation.
 * Protected by requireAuth, requireOrgAccess, and requireAdminOrOwner.
 */
const removeMember = async (req, res, next) => {
  try {
    const { orgId, memberId } = req.params;

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid member ID format.' },
      });
    }

    // Find the membership by Membership _id or by userId
    const targetMembership = await Membership.findOne({
      orgId,
      $or: [{ _id: memberId }, { userId: memberId }],
    }).populate('userId', 'name email');

    if (!targetMembership) {
      return res.status(404).json({
        success: false,
        error: { message: 'Member not found in this organisation.' },
      });
    }

    // Rule 1: Cannot remove the organization owner
    if (targetMembership.role === 'owner') {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot remove the organisation owner.' },
      });
    }

    // Rule 2: Cannot remove yourself from this panel
    if (targetMembership.userId._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: { message: 'You cannot remove yourself from the organisation.' },
      });
    }

    // Rule 3: Only the owner can remove an admin
    if (targetMembership.role === 'admin' && req.membership.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only organisation owners can remove an Admin member.' },
      });
    }

    const targetUserId = targetMembership.userId._id;

    // Rule 4: Active tasks safety check across all projects in this organisation
    const activeTasks = await Task.find({
      orgId,
      assignedTo: targetUserId,
      status: { $in: ['To Do', 'In Progress', 'Pending'] },
    }).populate('projectId', 'name');

    if (activeTasks.length > 0) {
      const taskTitles = activeTasks.slice(0, 3).map((t) => `"${t.title}"`).join(', ');
      const moreCount = activeTasks.length > 3 ? ` and ${activeTasks.length - 3} more` : '';
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot remove employee with ${activeTasks.length} active open task(s) (${taskTitles}${moreCount}). Please reassign or complete their tasks before removing them.`,
          activeTaskCount: activeTasks.length,
        },
      });
    }

    // Clean up:
    // 1. Remove Membership
    await Membership.deleteOne({ _id: targetMembership._id });

    // 2. Remove user from all project teamMembers in this organisation
    await Project.updateMany(
      { orgId, teamMembers: targetUserId },
      { $pull: { teamMembers: targetUserId } }
    );

    // 3. Remove user from assignedTo array of remaining tasks in this org
    await Task.updateMany(
      { orgId, assignedTo: targetUserId },
      { $pull: { assignedTo: targetUserId } }
    );

    // 4. Revoke any pending invitations for this user's email in this org
    if (targetMembership.userId.email) {
      await Invitation.deleteMany({
        orgId,
        email: targetMembership.userId.email.toLowerCase(),
      });
    }

    res.status(200).json({
      success: true,
      message: `Employee "${targetMembership.userId.name}" was successfully removed from the organisation.`,
      removedUserId: targetUserId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orgs/:orgId
 * --------------------
 * Retrieves details of the specified organisation including member count,
 * project count, and owner profile.
 * Protected by requireAuth and requireOrgAccess.
 */
const getOrganisation = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    const org = await Organisation.findById(orgId).populate('ownerId', 'name email');
    if (!org) {
      return res.status(404).json({
        success: false,
        error: { message: 'Organisation not found.' },
      });
    }

    const [memberCount, projectCount] = await Promise.all([
      Membership.countDocuments({ orgId }),
      Project.countDocuments({ orgId }),
    ]);

    const planId = org.plan || 'free';
    const plan = plansConfig.find((p) => p.id === planId) || plansConfig[0];

    res.status(200).json({
      success: true,
      organisation: {
        id: org._id,
        _id: org._id,
        name: org.name,
        slug: org.slug,
        plan: org.plan || 'free',
        planDetails: plan,
        owner: org.ownerId
          ? {
              id: org.ownerId._id,
              name: org.ownerId.name,
              email: org.ownerId.email,
            }
          : null,
        memberCount,
        projectCount,
        createdAt: org.createdAt,
        currentUserRole: req.membership ? req.membership.role : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/orgs/:orgId
 * ----------------------
 * Updates organisation profile details (e.g. name).
 * Protected by requireAuth, requireOrgAccess, and requireAdminOrOwner.
 */
const updateOrganisation = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Organisation name is required (minimum 2 characters).' },
      });
    }

    if (name.trim().length > 120) {
      return res.status(400).json({
        success: false,
        error: { message: 'Organisation name cannot exceed 120 characters.' },
      });
    }

    const org = await Organisation.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        error: { message: 'Organisation not found.' },
      });
    }

    const oldName = org.name;
    org.name = name.trim();
    await org.save();

    await logActivity({
      organisation: org._id,
      user: req.user,
      action: 'ORGANISATION_UPDATED',
      description: `${req.user.name} updated the organisation name from "${oldName}" to "${org.name}".`,
      metadata: {
        oldName,
        newName: org.name,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Organisation profile updated successfully.',
      organisation: {
        id: org._id,
        _id: org._id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        updatedAt: org.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/orgs/:orgId/members/:memberId
 * ----------------------------------------
 * Updates an employee's role within the organisation.
 * Protected by requireAuth, requireOrgAccess, and requireAdminOrOwner.
 */
const updateMemberRole = async (req, res, next) => {
  try {
    const { orgId, memberId } = req.params;
    const { role } = req.body;

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid member ID format.' },
      });
    }

    const allowedRoles = ['admin', 'manager', 'member'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid role. Role must be admin, manager, or member.' },
      });
    }

    // Find the target membership
    const targetMembership = await Membership.findOne({
      orgId,
      $or: [{ _id: memberId }, { userId: memberId }],
    }).populate('userId', 'name email');

    if (!targetMembership) {
      return res.status(404).json({
        success: false,
        error: { message: 'Member not found in this organisation.' },
      });
    }

    // Guard 1: Cannot change the organisation owner's role
    if (targetMembership.role === 'owner') {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot modify the role of the organisation owner.' },
      });
    }

    // Guard 2: Cannot change own role
    if (targetMembership.userId._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: { message: 'You cannot change your own role.' },
      });
    }

    // Guard 3: Only the owner can promote or demote an Admin
    if (role === 'admin' && req.membership.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only organisation owners can promote members to Admin.' },
      });
    }

    if (targetMembership.role === 'admin' && req.membership.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only organisation owners can change the role of an Admin.' },
      });
    }

    const previousRole = targetMembership.role;
    targetMembership.role = role;
    await targetMembership.save();

    await logActivity({
      organisation: orgId,
      user: req.user,
      action: 'MEMBER_ROLE_UPDATED',
      description: `${req.user.name} changed ${targetMembership.userId.name}'s role from ${previousRole} to ${role}.`,
      metadata: {
        targetUserId: targetMembership.userId._id,
        targetUserName: targetMembership.userId.name,
        previousRole,
        newRole: role,
      },
    });

    res.status(200).json({
      success: true,
      message: `Role for ${targetMembership.userId.name} was updated to ${role}.`,
      member: {
        id: targetMembership._id,
        userId: targetMembership.userId._id,
        name: targetMembership.userId.name,
        email: targetMembership.userId.email,
        role: targetMembership.role,
        updatedAt: targetMembership.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orgs/:orgId/members/:memberId
 * --------------------------------------
 * Retrieves comprehensive member profile details:
 * - Personal info (name, email, avatar, role, joinedAt)
 * - Work statistics (assigned projects, completed tasks, pending tasks, total tasks)
 * - Projects list (projects in this org assigned to this member)
 * - Tasks list (tasks in this org assigned to this member)
 * Protected by requireAuth and requireOrgAccess.
 */
const getMemberProfile = async (req, res, next) => {
  try {
    const { orgId, memberId } = req.params;

    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid organisation ID format.' },
      });
    }

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid member ID format.' },
      });
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const targetObjectId = new mongoose.Types.ObjectId(memberId);

    // Support memberId as either Membership._id or User._id
    const membership = await Membership.findOne({
      orgId: orgObjectId,
      $or: [{ userId: targetObjectId }, { _id: targetObjectId }],
    }).populate('userId', 'name email avatar createdAt authProvider');

    if (!membership || !membership.userId) {
      return res.status(404).json({
        success: false,
        error: { message: 'Member not found in this organisation.' },
      });
    }

    const targetUserId = membership.userId._id;

    // Fetch projects assigned to this member in this organisation
    const projects = await Project.find({
      orgId: orgObjectId,
      teamMembers: targetUserId,
    })
      .select('name description status deadline createdAt')
      .sort({ createdAt: -1 });

    // Fetch tasks assigned to this member in this organisation
    const tasks = await Task.find({
      orgId: orgObjectId,
      assignedTo: targetUserId,
    })
      .populate('projectId', 'name')
      .select('title description status priority dueDate projectId createdAt')
      .sort({ dueDate: 1, createdAt: -1 });

    const completedTasksCount = tasks.filter((t) => t.status === 'Completed').length;
    const pendingTasksCount = tasks.filter((t) => t.status !== 'Completed').length;

    res.status(200).json({
      success: true,
      member: {
        id: membership.userId._id,
        _id: membership.userId._id,
        userId: membership.userId._id,
        membershipId: membership._id,
        name: membership.userId.name,
        email: membership.userId.email,
        avatar: membership.userId.avatar || '',
        role: membership.role,
        authProvider: membership.userId.authProvider || 'local',
        joinedAt: membership.createdAt,
        stats: {
          assignedProjectsCount: projects.length,
          completedTasksCount,
          pendingTasksCount,
          totalTasksCount: tasks.length,
        },
      },
      projects,
      tasks,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMembers,
  addMember,
  removeMember,
  getOrganisation,
  updateOrganisation,
  updateMemberRole,
  getMemberProfile,
};
