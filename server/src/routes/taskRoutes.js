const express = require('express');
const { updateTask, getMyTasks } = require('../controllers/taskController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateMongoIdParam, updateTaskValidation } = require('../middleware/validators');

const router = express.Router();

router.use(requireAuth);

// GET /api/tasks/my — Retrieve all tasks assigned to the authenticated employee
router.get('/my', getMyTasks);

// PATCH /api/tasks/:taskId — Update task status or fields
router.patch('/:taskId', validateMongoIdParam('taskId'), updateTaskValidation, updateTask);

module.exports = router;
