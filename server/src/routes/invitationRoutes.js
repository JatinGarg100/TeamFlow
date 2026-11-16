const express = require('express');
const { verifyInvitation, acceptInvitation } = require('../controllers/invitationController');

const router = express.Router();

// GET /api/invitations/:token — Verify an invitation token (Public)
router.get('/:token', verifyInvitation);

// POST /api/invitations/:token/accept — Accept invitation & register/join (Public)
router.post('/:token/accept', acceptInvitation);

module.exports = router;
