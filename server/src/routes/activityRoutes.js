const express = require('express');
const { getActivity } = require('../controllers/activityController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

// GET /api/activity — Retrieve activity history with org/project filtering
router.get('/', getActivity);

module.exports = router;
