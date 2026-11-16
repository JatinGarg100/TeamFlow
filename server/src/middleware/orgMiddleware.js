const mongoose = require('mongoose');
const { Membership, Organisation } = require('../models');

/**
 * Organisation Access Middleware
 * ------------------------------
 * Ensures the authenticated user is an active member of the organisation in req.params.orgId.
 * Attaches the membership record to req.membership.
 */
const requireOrgAccess = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid organisation ID format.',
          statusCode: 400,
        },
      });
    }

    // Verify organisation exists
    const org = await Organisation.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Organisation not found.',
          statusCode: 404,
        },
      });
    }

    // Find the user's membership in this organisation
    const membership = await Membership.findOne({
      orgId,
      userId: req.user._id,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. You do not belong to this organisation.',
          statusCode: 403,
        },
      });
    }

    // Attach organisation and membership to request
    req.organisation = org;
    req.membership = membership;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Organisation Admin / Owner Middleware
 * --------------------------------------
 * Ensures the member holds an elevated role ('owner' or 'admin')
 * before modifying organisation members, settings, or plans.
 */
const requireAdminOrOwner = (req, res, next) => {
  if (!req.membership) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Membership context not established.',
        statusCode: 403,
      },
    });
  }

  const { role } = req.membership;
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Forbidden. Owner or Admin privileges required for this action.',
        statusCode: 403,
      },
    });
  }

  next();
};

module.exports = {
  requireOrgAccess,
  requireAdminOrOwner,
};
