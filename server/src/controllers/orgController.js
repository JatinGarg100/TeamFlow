const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const plansConfig = require('../config/plans');
const { User, Membership, Organisation, Project, Task, Invitation } = require('../models');
const { parsePagination, formatPaginatedResponse, escapeRegex } = require('../utils/pagination');

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
        .populate('userId', 'name email createdAt')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
    ]);

    const members = memberships
      .filter((m) => m.userId) // Ensure user document exists
      .map((m) => ({
        id: m.userId._id,
        _id: m.userId._id,
        userId: m.userId._id,
        membershipId: m._id,
        name: m.userId.name,
        email: m.userId.email,
        role: m.role,
        status: 'Active',
        joinedAt: m.createdAt,
      }));

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

module.exports = {
  getMembers,
  addMember,
  removeMember,
};
