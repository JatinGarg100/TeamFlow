const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Invitation, Organisation, Membership, User } = require('../models');
const plansConfig = require('../config/plans');
const { sendInvitationEmail } = require('../services/mailer');

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

    // 3. Send email notification (non-blocking)
    (async () => {
      try {
        const inviter = await User.findById(req.user._id);
        await sendInvitationEmail({
          recipientEmail: cleanEmail,
          organisationName: org.name,
          inviterName: inviter?.name || 'Administrator',
          role,
          inviteToken: rawToken,
        });
      } catch (err) {
        console.warn('[Invite] Email notification failed:', err.message);
      }
    })();

    res.status(201).json({
      success: true,
      message: `Invitation generated successfully for ${cleanEmail}.`,
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
 * Lists all pending invitations for the organisation.
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

    const invitations = await Invitation.find({
      orgId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
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
    }).populate('orgId', 'name slug plan');

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
    } else if (password) {
      // If user exists and provided password, verify credentials
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: { message: 'Incorrect password for this existing account.' },
        });
      }
    }

    // Create membership linking user to organisation
    let membership = await Membership.findOne({
      orgId: invitation.orgId._id,
      userId: user._id,
    });

    if (!membership) {
      membership = await Membership.create({
        orgId: invitation.orgId._id,
        userId: user._id,
        role: invitation.role,
      });
    }

    // Mark invitation accepted
    invitation.status = 'accepted';
    await invitation.save();

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
        name: user.name,
        email: user.email,
      },
      organisation: {
        id: invitation.orgId._id,
        name: invitation.orgId.name,
        role: membership.role,
      },
      token: sessionToken,
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
  revokeInvitation,
};
