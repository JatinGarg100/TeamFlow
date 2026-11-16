const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

// GET /api/dashboard
router.get('/', getDashboardStats);

module.exports = router;
