const mongoose = require('mongoose');
const plansConfig = require('../config/plans');
const { Project, Membership, Organisation } = require('../models');

/**
 * GET /api/projects
 * -----------------
 * Lists all projects for the authenticated user's organisation.
 * If ?orgId= is provided, verifies user's membership in that organisation.
 * Otherwise, retrieves projects for all organisations the user belongs to.
 */
const getProjects = async (req, res, next) => {
  try {
    let targetOrgIds = [];

    // 1. If a specific orgId was requested via query or header, verify access
    const requestedOrgId = req.query.orgId || req.headers['x-org-id'];

    if (requestedOrgId) {
      if (!mongoose.Types.ObjectId.isValid(requestedOrgId)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid organisation ID format.' },
        });
      }

      const membership = await Membership.findOne({
        orgId: requestedOrgId,
        userId: req.user._id,
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied. You do not belong to this organisation.' },
        });
      }

      targetOrgIds = [requestedOrgId];
    } else {
      // 2. Default: fetch all organisations the authenticated user belongs to
      const userMemberships = await Membership.find({ userId: req.user._id });
      targetOrgIds = userMemberships.map((m) => m.orgId);
    }

    const projects = await Project.find({ orgId: { $in: targetOrgIds } })
      .populate('teamMembers', 'name email role')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/projects
 * ------------------
 * Creates a new project in the user's organisation.
 * Rules:
 * - Only authenticated users.
 * - Only owner, admin, or project manager can create.
 * - Only verified members of the organisation can be assigned.
 * - createdBy is derived from req.user._id (never trusted from body).
 */
const createProject = async (req, res, next) => {
  try {
    const { name, description = '', deadline, status = 'Planning', teamMembers = [], orgId } = req.body;

    // 1. Validate Project Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Project name is required (at least 2 characters).' },
      });
    }

    // 2. Validate Status
    const allowedStatuses = ['Planning', 'In Progress', 'Completed'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` },
      });
    }

    // 3. Determine target Organisation & verify user role
    const targetOrgId = orgId || req.headers['x-org-id'];
    let membership;

    if (targetOrgId) {
      if (!mongoose.Types.ObjectId.isValid(targetOrgId)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid organisation ID format.' },
        });
      }

      membership = await Membership.findOne({
        orgId: targetOrgId,
        userId: req.user._id,
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied. You do not belong to the specified organisation.' },
        });
      }
    } else {
      // Find user's primary/first organisation where they have elevated rights
      membership = await Membership.findOne({
        userId: req.user._id,
        role: { $in: ['owner', 'admin', 'manager'] },
      });

      if (!membership) {
        // Fallback to any organisation they belong to
        membership = await Membership.findOne({ userId: req.user._id });
      }

      if (!membership) {
        return res.status(400).json({
          success: false,
          error: { message: 'No active organisation found for your user account.' },
        });
      }
    }

    // Rule 3: Only owner, admin, or manager can create projects
    const allowedRoles = ['owner', 'admin', 'manager'];
    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden. Only the organisation owner, admin, or project manager can create projects.' },
      });
    }

    // Plan Project Limit Check (Free tier allows max 3 active projects)
    const org = await Organisation.findById(membership.orgId);
    const planId = org?.plan || 'free';
    const plan = plansConfig.find((p) => p.id === planId) || plansConfig[0];
    const currentProjectCount = await Project.countDocuments({ orgId: membership.orgId });

    if (currentProjectCount >= plan.limits.maxProjects) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Plan project limit reached! The ${plan.name} plan allows a maximum of ${plan.limits.maxProjects} projects. You currently have ${currentProjectCount} projects. Please upgrade your subscription on the Plans page to create more projects.`,
          code: 'PLAN_LIMIT_REACHED',
          limit: plan.limits.maxProjects,
          current: currentProjectCount,
        },
      });
    }

    // Rule 4: Only members of this organisation can be assigned to the project
    let validatedTeamMembers = [];
    if (Array.isArray(teamMembers) && teamMembers.length > 0) {
      // Check that all IDs are valid
      for (const id of teamMembers) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            error: { message: `Invalid user ID in team members: ${id}` },
          });
        }
      }

      // Query database for memberships in this organisation
      const memberDocs = await Membership.find({
        orgId: membership.orgId,
        userId: { $in: teamMembers },
      });

      if (memberDocs.length !== teamMembers.length) {
        return res.status(400).json({
          success: false,
          error: { message: 'One or more selected team members do not belong to this organisation.' },
        });
      }

      validatedTeamMembers = teamMembers;
    }

    // 4. Create Project
    const newProject = await Project.create({
      orgId: membership.orgId,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      deadline: deadline ? new Date(deadline) : null,
      status,
      teamMembers: validatedTeamMembers,
      createdBy: req.user._id, // Derived securely from authenticated user
    });

    const populatedProject = await Project.findById(newProject._id)
      .populate('teamMembers', 'name email role')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      project: populatedProject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:projectId
 * ----------------------------
 * Retrieves a single project.
 * Rule: Prevents guessing IDs from other organisations (checks user's membership in project.orgId).
 */
const getProjectById = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid project ID format.' },
      });
    }

    const project = await Project.findById(projectId)
      .populate('teamMembers', 'name email role')
      .populate('createdBy', 'name email');

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.' },
      });
    }

    // Rule 7: Prevent users from accessing another company's project
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

    res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/projects/:projectId
 * ------------------------------
 * Updates project status, details, or assigned members.
 * Rule: Only owner, admin, or project manager in the owning organisation can update.
 */
const updateProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, description, deadline, status, teamMembers } = req.body;

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

    // Check membership in the owning organisation
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

    // Rule 3: Only owner, admin, or manager can update
    const allowedRoles = ['owner', 'admin', 'manager'];
    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden. Only the organisation owner, admin, or project manager can edit projects.' },
      });
    }

    // Field updates & validations
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: { message: 'Project name must be at least 2 characters.' },
        });
      }
      project.name = name.trim();
    }

    if (description !== undefined) {
      project.description = typeof description === 'string' ? description.trim() : '';
    }

    if (deadline !== undefined) {
      project.deadline = deadline ? new Date(deadline) : null;
    }

    if (status !== undefined) {
      const allowedStatuses = ['Planning', 'In Progress', 'Completed'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: { message: `Status must be one of: ${allowedStatuses.join(', ')}` },
        });
      }
      project.status = status;
    }

    if (teamMembers !== undefined) {
      if (!Array.isArray(teamMembers)) {
        return res.status(400).json({
          success: false,
          error: { message: 'teamMembers must be an array of user IDs.' },
        });
      }

      for (const id of teamMembers) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            error: { message: `Invalid user ID in team members: ${id}` },
          });
        }
      }

      // Verify all members belong to this organisation
      const memberDocs = await Membership.find({
        orgId: project.orgId,
        userId: { $in: teamMembers },
      });

      if (memberDocs.length !== teamMembers.length) {
        return res.status(400).json({
          success: false,
          error: { message: 'One or more selected team members do not belong to this organisation.' },
        });
      }

      project.teamMembers = teamMembers;
    }

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate('teamMembers', 'name email role')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Project updated successfully.',
      project: updatedProject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/projects/:projectId/members
 * -------------------------------------
 * Adds one or more employees to a project's team.
 * Validations:
 * - Caller must be owner, admin, or manager in project's org.
 * - Added users must belong to the project's org.
 * - Prevents duplicates.
 */
const addProjectMembers = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    let { userIds, userId } = req.body;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid project ID format.' },
      });
    }

    if (!userIds && userId) {
      userIds = [userId];
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Please provide userIds array with at least one employee ID.' },
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.' },
      });
    }

    // Role check: Only owner, admin, manager can modify team members
    const callerMembership = await Membership.findOne({
      orgId: project.orgId,
      userId: req.user._id,
    });

    if (!callerMembership || !['owner', 'admin', 'manager'].includes(callerMembership.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden. Only managers can add team members to projects.' },
      });
    }

    // Validate and resolve userIds (accepts either User ID or Membership ID)
    const validUserIds = [];
    for (const rawId of userIds) {
      if (!rawId || !mongoose.Types.ObjectId.isValid(rawId)) {
        return res.status(400).json({
          success: false,
          error: { message: `Invalid user ID format: ${rawId}` },
        });
      }

      // Check if rawId is directly the user's _id in this organisation
      const byUserId = await Membership.findOne({
        orgId: project.orgId,
        userId: rawId,
      });

      if (byUserId) {
        validUserIds.push(byUserId.userId.toString());
        continue;
      }

      // Check if rawId is the membership's _id
      const byMembershipId = await Membership.findOne({
        orgId: project.orgId,
        _id: rawId,
      });

      if (byMembershipId) {
        validUserIds.push(byMembershipId.userId.toString());
        continue;
      }

      return res.status(400).json({
        success: false,
        error: { message: 'One or more users do not belong to this organisation.' },
      });
    }

    // Add without duplicates
    const currentMemberIds = (project.teamMembers || []).map((id) =>
      (typeof id === 'object' ? id._id || id.id : id).toString()
    );
    let addedCount = 0;

    for (const id of validUserIds) {
      if (!currentMemberIds.includes(id)) {
        project.teamMembers.push(id);
        currentMemberIds.push(id);
        addedCount++;
      }
    }

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate('teamMembers', 'name email role')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: `${addedCount} team member(s) added successfully.`,
      project: updatedProject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/projects/:projectId/members/:userId
 * -----------------------------------------------
 * Removes an employee from a project's team.
 * Safety check: If the employee has active tasks (To Do, In Progress) in this project,
 * blocks removal until their open tasks are reassigned or completed.
 * Note: Removing from project does NOT delete the user account or membership.
 */
const removeProjectMember = async (req, res, next) => {
  try {
    const { projectId, userId } = req.params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid project ID format.' },
      });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid user ID format.' },
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.' },
      });
    }

    // Role check
    const callerMembership = await Membership.findOne({
      orgId: project.orgId,
      userId: req.user._id,
    });

    if (!callerMembership || !['owner', 'admin', 'manager'].includes(callerMembership.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden. Only managers can remove team members from projects.' },
      });
    }

    // Resolve target userId (accepts either User ID or Membership ID)
    let targetUserId = userId.toString();
    const mem = await Membership.findOne({ orgId: project.orgId, _id: userId });
    if (mem) {
      targetUserId = mem.userId.toString();
    }

    // Task safety check: Check for active/open tasks assigned to this user in this project
    const Task = require('../models/Task');
    const openTasksCount = await Task.countDocuments({
      projectId: project._id,
      assignedTo: targetUserId,
      status: { $in: ['To Do', 'In Progress', 'Pending'] },
    });

    if (openTasksCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot remove employee: they have ${openTasksCount} active task(s) assigned in this project. Please reassign or complete their open tasks first.`,
          code: 'ACTIVE_TASKS_EXIST',
          openTasksCount,
        },
      });
    }

    // Remove user from teamMembers array
    project.teamMembers = project.teamMembers.filter(
      (mId) => (typeof mId === 'object' ? mId._id || mId.id : mId).toString() !== targetUserId
    );

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate('teamMembers', 'name email role')
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Employee removed from project team successfully.',
      project: updatedProject,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  addProjectMembers,
  removeProjectMember,
};
