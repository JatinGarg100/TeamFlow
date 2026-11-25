const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Invitation, Organisation, Membership, User } = require('../models');
const plansConfig = require('../config/plans');
const { sendInvitationEmail } = require('../services/mailer');
const { logActivity } = require('../services/activityLog.service');
const { createNotification } = require('../services/notificationService');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/orgs/:orgId/invitations
 * ---------------------------------
 * Invites a new team member by email to an existing organisation.
 * Rules:
 * - Caller must be owner, admin, or manager of the organisation.
 * - Plan quota is checked: current members + active invites cannot exceed maxMembers.
 * - Generates cryptographically secure token, stores only SHA-256 hash.
 * - Sends invitation email.
 */
const createInvitation = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { email, role = 'member' } = req.body;

    // 1. Validation
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: { message: 'A valid email address is required.' },
      });
    }

    const allowedRoles = ['admin', 'manager', 'member'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid role. Role must be admin, manager, or member.' },
      });
    }

    // Role check: Caller must be owner, admin, or manager
    const callerMembership = await Membership.findOne({
      orgId,
      userId: req.user._id,
    });

    if (!callerMembership || !['owner', 'admin', 'manager'].includes(callerMembership.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden. Only managers can invite new members.' },
      });
    }

    // Only owners can invite admins
    if (role === 'admin' && callerMembership.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only organisation owners can invite Admin members.' },
      });
    }

    const org = await Organisation.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        error: { message: 'Organisation not found.' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user is already a member
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      const alreadyMember = await Membership.findOne({
        orgId: org._id,
        userId: existingUser._id,
      });

      if (alreadyMember) {
        return res.status(400).json({
          success: false,
          error: { message: 'This user is already an active member of this organisation.' },
        });
      }
    }

    // Check plan quota (Free tier allows max 5 members)
    const currentMemberCount = await Membership.countDocuments({ orgId: org._id });
    const planId = org.plan || 'free';
    const plan = plansConfig.find((p) => p.id === planId) || plansConfig[0];

    if (currentMemberCount >= plan.limits.maxMembers) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Plan limit reached! The ${plan.name} plan allows a maximum of ${plan.limits.maxMembers} members. You currently have ${currentMemberCount} members. Please upgrade your subscription on the Plans page to invite more members.`,
          code: 'PLAN_LIMIT_REACHED',
          limit: plan.limits.maxMembers,
          current: currentMemberCount,
        },
      });
    }

    // 2. Generate random crypto token and SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Revoke any previous pending invitation for this email in this org
    await Invitation.deleteMany({
      orgId: org._id,
      email: cleanEmail,
      status: 'pending',
    });

    const invitation = await Invitation.create({
      orgId: org._id,
      email: cleanEmail,
      role,
      tokenHash,
      invitedBy: req.user._id,
      status: 'pending',
      expiresAt,
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/invite/${rawToken}`;

    // 3. Send email notification via configured provider (Resend -> SMTP -> Dev Simulation)
    let emailResult = null;
    try {
      const inviter = await User.findById(req.user._id);
      emailResult = await sendInvitationEmail({
        recipientEmail: cleanEmail,
        organisationName: org.name,
        inviterName: inviter?.name || 'Administrator',
        role,
        inviteToken: rawToken,
      });
    } catch (err) {
      console.warn('[Invite] Email notification dispatch error:', err.message);
      emailResult = {
        sent: false,
        reason: err.message,
        deliveryStatus: 'failed',
        provider: 'resend',
      };
    }

    let statusMessage = `Invitation email sent successfully to ${cleanEmail}.`;
    if (emailResult?.sent) {
      statusMessage = `Invitation email sent successfully to ${cleanEmail} via ${emailResult.provider === 'resend' ? 'Resend' : 'email provider'}.`;
    } else if (emailResult?.deliveryStatus === 'failed') {
      statusMessage = `Invitation created, but email delivery failed (${emailResult.reason || 'provider error'}). You can copy and share the link manually.`;
    } else if (emailResult?.deliveryStatus === 'simulated_dev_log') {
      statusMessage = `Invitation created. Email was not delivered (Resend is not configured in this environment; simulation logged in console). You can copy the link manually.`;
    }

    res.status(201).json({
      success: true,
      message: statusMessage,
      emailSent: Boolean(emailResult?.sent),
      emailDelivery: emailResult,
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
        inviteToken: rawToken,
        inviteUrl,
      },
      inviteToken: rawToken,
      inviteUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orgs/:orgId/invitations
 * --------------------------------
 * Lists invitations for the organisation.
 * Supports status query (?status=pending|accepted|expired|all).
 */
const getOrgInvitations = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    const callerMembership = await Membership.findOne({
      orgId,
      userId: req.user._id,
    });

    if (!callerMembership || !['owner', 'admin', 'manager'].includes(callerMembership.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. Only managers can view invitations.' },
      });
    }

    const filter = { orgId };
    const statusQuery = req.query.status;

    if (statusQuery && ['pending', 'accepted', 'expired'].includes(statusQuery)) {
      filter.status = statusQuery;
    }

    // Automatically update any pending invitations that have passed their expiresAt date
    await Invitation.updateMany(
      {
        orgId,
        status: 'pending',
        expiresAt: { $lt: new Date() },
      },
      {
        $set: { status: 'expired' },
      }
    );

    const invitations = await Invitation.find(filter)
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: invitations.length,
      invitations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invitations/:token
 * ---------------------------
 * Validates an invitation token (Public endpoint).
 */
const verifyInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invitation token is required.' },
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await Invitation.findOne({
      tokenHash,
      status: 'pending',
    })
      .populate('orgId', 'name slug plan')
      .populate('invitedBy', 'name email');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invalid or already used invitation link.' },
      });
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = 'expired';
      await invitation.save();

      return res.status(400).json({
        success: false,
        error: { message: 'This invitation link has expired. Please request a new one.' },
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: invitation.email });

    res.status(200).json({
      success: true,
      valid: true,
      email: invitation.email,
      role: invitation.role,
      organisation: {
        id: invitation.orgId._id,
        name: invitation.orgId.name,
      },
      invitedBy: invitation.invitedBy
        ? {
            id: invitation.invitedBy._id,
            name: invitation.invitedBy.name,
            email: invitation.invitedBy.email,
          }
        : null,
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        organisation: {
          id: invitation.orgId._id,
          name: invitation.orgId.name,
        },
        invitedBy: invitation.invitedBy
          ? {
              id: invitation.invitedBy._id,
              name: invitation.invitedBy.name,
              email: invitation.invitedBy.email,
            }
          : null,
        expiresAt: invitation.expiresAt,
      },
      hasExistingAccount: Boolean(existingUser),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/invitations/:token/accept
 * -----------------------------------
 * Accepts an invitation:
 * - If new user: registers with name & password.
 * - If existing user: links to organisation without duplicating User document.
 * - Creates Membership.
 * - Marks invitation accepted.
 * - Issues JWT session token.
 */
const acceptInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { name, password } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invitation token is required.' },
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await Invitation.findOne({
      tokenHash,
      status: 'pending',
    }).populate('orgId');

    if (!invitation) {
      return res.status(400).json({
        success: false,
        error: { message: 'This invitation has already been accepted or is no longer valid.' },
      });
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({
        success: false,
        error: { message: 'This invitation has expired. Please ask your administrator to resend it.' },
      });
    }

    const cleanEmail = invitation.email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    // Check if caller is already authenticated as the invited user
    let authenticatedUser = null;
    const authHeader = req.headers.authorization;
    const tokenCookie = req.cookies?.token;
    const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : tokenCookie;
    if (bearer) {
      try {
        const decoded = jwt.verify(bearer, JWT_SECRET);
        authenticatedUser = await User.findById(decoded.userId);
      } catch {
        // invalid token, proceed with normal credentials check
      }
    }

    // Case D: Logged in under a different email account -> reject mismatch with 403
    if (authenticatedUser && authenticatedUser.email.toLowerCase() !== cleanEmail) {
      return res.status(403).json({
        success: false,
        error: {
          message: `You are signed in as ${authenticatedUser.email}, but this invitation was sent to ${invitation.email}. Please sign out and sign in with the invited email address.`,
          code: 'EMAIL_MISMATCH',
        },
      });
    }

    const isAlreadyAuthenticatedAsInvitee =
      Boolean(authenticatedUser && authenticatedUser.email.toLowerCase() === cleanEmail);

    // If new user: create account with supplied name & password
    if (!user) {
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: { message: 'Please enter your full name (at least 2 characters).' },
        });
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          success: false,
          error: { message: 'Please choose a password of at least 6 characters.' },
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
      });
    } else if (isAlreadyAuthenticatedAsInvitee) {
      // User is already logged in as this invitee -> One-click acceptance granted
    } else if (password) {
      // If user exists and provided password, verify credentials
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: { message: 'Incorrect password for this existing account.' },
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: { message: 'Password is required to confirm acceptance for your existing account.' },
      });
    }

    // Check if user is already a member of this organisation
    const existingMembership = await Membership.findOne({
      orgId: invitation.orgId._id,
      userId: user._id,
    });

    if (existingMembership) {
      invitation.status = 'accepted';
      await invitation.save();
      return res.status(409).json({
        success: false,
        error: { message: 'You are already an active member of this organisation.' },
      });
    }

    // Check plan quota limits before joining
    const currentMemberCount = await Membership.countDocuments({ orgId: invitation.orgId._id });
    const planId = invitation.orgId.plan || 'free';
    const plan = plansConfig.find((p) => p.id === planId) || plansConfig[0];

    if (currentMemberCount >= plan.limits.maxMembers) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Workspace member limit reached (${plan.limits.maxMembers} members on ${plan.name} plan). Please ask the organisation owner to upgrade their plan.`,
          code: 'PLAN_LIMIT_REACHED',
        },
      });
    }

    // Create membership linking user to organisation
    const membership = await Membership.create({
      orgId: invitation.orgId._id,
      userId: user._id,
      role: invitation.role,
    });

    // Mark invitation accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();

    // Log Activity
    await logActivity({
      organisation: invitation.orgId._id,
      user,
      action: 'MEMBER_JOINED',
      description: `${user.name} accepted an invitation and joined the organisation as ${membership.role}.`,
      metadata: {
        email: user.email,
        role: membership.role,
        joinedVia: 'invitation',
      },
    });

    // In-app notification to inviter
    if (invitation.invitedBy) {
      createNotification({
        recipient: invitation.invitedBy,
        orgId: invitation.orgId._id,
        sender: user._id,
        type: 'INVITATION_RECEIVED',
        title: `${user.name} joined the workspace`,
        message: `${user.name} (${user.email}) accepted the invitation and joined as ${membership.role}.`,
        link: `/employees`,
        metadata: { userId: user._id, role: membership.role },
      });
    }

    // Fetch user's memberships to return full organisations array
    const memberships = await Membership.find({ userId: user._id })
      .populate('orgId', 'name slug plan ownerId')
      .sort({ createdAt: 1 });

    const organisations = memberships
      .filter((m) => m.orgId)
      .map((m) => ({
        id: m.orgId._id,
        _id: m.orgId._id,
        name: m.orgId.name,
        slug: m.orgId.slug,
        role: m.role,
        plan: m.orgId.plan,
        isOwner: m.role === 'owner',
      }));

    // Issue JWT session token
    const payload = {
      userId: user._id,
      email: user.email,
      name: user.name,
      orgId: invitation.orgId._id,
      role: membership.role,
    };

    const sessionToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Set HttpOnly cookie
    res.cookie('token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: `Welcome to ${invitation.orgId.name}! You have successfully joined the workspace.`,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
      },
      organisation: {
        id: invitation.orgId._id,
        _id: invitation.orgId._id,
        name: invitation.orgId.name,
        slug: invitation.orgId.slug,
        role: membership.role,
        plan: invitation.orgId.plan,
      },
      organisations,
      token: sessionToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orgs/:orgId/invitations/:invitationId/resend
 * ----------------------------------------------------
 * Resends an existing pending invitation with a new cryptographic token and refreshed expiry.
 */
const resendInvitation = async (req, res, next) => {
  try {
    const { orgId, invitationId } = req.params;

    if (!invitationId || !mongoose.Types.ObjectId.isValid(invitationId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid invitation ID format.' },
      });
    }

    const callerMembership = await Membership.findOne({
      orgId,
      userId: req.user._id,
    });

    if (!callerMembership || !['owner', 'admin', 'manager'].includes(callerMembership.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden. Only managers can resend invitations.' },
      });
    }

    const org = await Organisation.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        error: { message: 'Organisation not found.' },
      });
    }

    const invitation = await Invitation.findOne({
      _id: invitationId,
      orgId,
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invitation not found.' },
      });
    }

    if (invitation.status === 'accepted') {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot resend an invitation that has already been accepted.' },
      });
    }

    // Generate new token & SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    invitation.tokenHash = tokenHash;
    invitation.expiresAt = expiresAt;
    invitation.status = 'pending';
    invitation.invitedBy = req.user._id;
    await invitation.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/invite/${rawToken}`;

    // Send email notification via configured provider (Resend -> SMTP -> Dev Simulation)
    let emailResult = null;
    try {
      const inviter = await User.findById(req.user._id);
      emailResult = await sendInvitationEmail({
        recipientEmail: invitation.email,
        organisationName: org.name,
        inviterName: inviter?.name || 'Administrator',
        role: invitation.role,
        inviteToken: rawToken,
      });
    } catch (err) {
      console.warn('[Invite Resend] Email notification dispatch error:', err.message);
      emailResult = {
        sent: false,
        reason: err.message,
        deliveryStatus: 'failed',
        provider: 'resend',
      };
    }

    let statusMessage = `Invitation email resent successfully to ${invitation.email}.`;
    if (emailResult?.sent) {
      statusMessage = `Invitation email resent successfully to ${invitation.email} via ${emailResult.provider === 'resend' ? 'Resend' : 'email provider'}.`;
    } else if (emailResult?.deliveryStatus === 'failed') {
      statusMessage = `Invitation token regenerated, but email delivery failed (${emailResult.reason || 'provider error'}). You can copy and share the link manually.`;
    } else if (emailResult?.deliveryStatus === 'simulated_dev_log') {
      statusMessage = `Invitation resent. Email was not delivered (Resend is not configured in this environment; simulation logged in console). You can copy the link manually.`;
    }

    res.status(200).json({
      success: true,
      message: statusMessage,
      emailSent: Boolean(emailResult?.sent),
      emailDelivery: emailResult,
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
        inviteToken: rawToken,
        inviteUrl,
      },
      inviteToken: rawToken,
      inviteUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/orgs/:orgId/invitations/:invitationId
 * -------------------------------------------------
 * Revokes or cancels a pending invitation.
 */
const revokeInvitation = async (req, res, next) => {
  try {
    const { orgId, invitationId } = req.params;

    if (!invitationId || !mongoose.Types.ObjectId.isValid(invitationId)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid invitation ID format.' },
      });
    }

    const invitation = await Invitation.findOneAndDelete({
      _id: invitationId,
      orgId,
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invitation not found or already removed.' },
      });
    }

    res.status(200).json({
      success: true,
      message: `Invitation for ${invitation.email} has been cancelled.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInvitation,
  getOrgInvitations,
  verifyInvitation,
  acceptInvitation,
  resendInvitation,
  revokeInvitation,
};
