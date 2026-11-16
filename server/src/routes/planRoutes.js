const express = require('express');
const { getPlans, getUsage } = require('../controllers/planController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/plans
router.get('/plans', requireAuth, getPlans);

// GET /api/usage
router.get('/usage', requireAuth, getUsage);

module.exports = router;
