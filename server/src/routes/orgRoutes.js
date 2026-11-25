const express = require('express');
const {
  getMembers,
  addMember,
  removeMember,
  getOrganisation,
  updateOrganisation,
  updateMemberRole,
  getMemberProfile,
} = require('../controllers/orgController');
const {
  createInvitation,
  getOrgInvitations,
  resendInvitation,
  revokeInvitation,
} = require('../controllers/invitationController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireOrgAccess, requireAdminOrOwner } = require('../middleware/orgMiddleware');
const { addEmployeeValidation, validateMongoIdParam } = require('../middleware/validators');

const router = express.Router();

// Protected: View organisation details
router.get('/:orgId', requireAuth, requireOrgAccess, getOrganisation);

// Protected: Update organisation details (Owner or Admin only)
router.patch('/:orgId', requireAuth, requireOrgAccess, requireAdminOrOwner, updateOrganisation);

// Protected: View organisation members
router.get('/:orgId/members', requireAuth, requireOrgAccess, getMembers);

// Protected: View member profile details & statistics
router.get('/:orgId/members/:memberId', requireAuth, requireOrgAccess, validateMongoIdParam('memberId'), getMemberProfile);

// Protected: Add employee/member directly to organisation (Owner or Admin only)
router.post(
  '/:orgId/members',
  requireAuth,
  requireOrgAccess,
  requireAdminOrOwner,
  addEmployeeValidation,
  addMember
);

// Protected: Update employee role within organisation (Owner or Admin only)
router.patch(
  '/:orgId/members/:memberId',
  requireAuth,
  requireOrgAccess,
  requireAdminOrOwner,
  validateMongoIdParam('memberId'),
  updateMemberRole
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

// Protected: Resend pending invitation
router.post('/:orgId/invitations/:invitationId/resend', requireAuth, requireOrgAccess, resendInvitation);

// Protected: Revoke/delete pending invitation
router.delete('/:orgId/invitations/:invitationId', requireAuth, requireOrgAccess, requireAdminOrOwner, revokeInvitation);

module.exports = router;
