const express = require('express');
const { getMembers, addMember, removeMember } = require('../controllers/orgController');
const { createInvitation, getOrgInvitations, revokeInvitation } = require('../controllers/invitationController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireOrgAccess, requireAdminOrOwner } = require('../middleware/orgMiddleware');
const { addEmployeeValidation, validateMongoIdParam } = require('../middleware/validators');

const router = express.Router();

// Protected: View organisation members
router.get('/:orgId/members', requireAuth, requireOrgAccess, getMembers);

// Protected: Add employee/member directly to organisation (Owner or Admin only)
router.post(
  '/:orgId/members',
  requireAuth,
  requireOrgAccess,
  requireAdminOrOwner,
  addEmployeeValidation,
  addMember
);

// Protected: Remove employee from organisation (Owner or Admin only)
router.delete(
  '/:orgId/members/:memberId',
  requireAuth,
  requireOrgAccess,
  requireAdminOrOwner,
  validateMongoIdParam('memberId'),
  removeMember
);

// Protected: Invite team member by email
router.post('/:orgId/invitations', requireAuth, requireOrgAccess, createInvitation);

// Protected: View pending invitations
router.get('/:orgId/invitations', requireAuth, requireOrgAccess, getOrgInvitations);

// Protected: Revoke/delete pending invitation
router.delete('/:orgId/invitations/:invitationId', requireAuth, requireOrgAccess, requireAdminOrOwner, revokeInvitation);

module.exports = router;
