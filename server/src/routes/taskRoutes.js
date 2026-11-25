const express = require('express');
const {
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getMyTasks,
  uploadTaskAttachments,
  downloadTaskAttachment,
  deleteTaskAttachment,
} = require('../controllers/taskController');
const {
  getTaskComments,
  createTaskComment,
} = require('../controllers/commentController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateMongoIdParam, updateTaskValidation } = require('../middleware/validators');
const { uploadTaskAttachment } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(requireAuth);

// GET /api/tasks — Retrieve tasks across organisation (Calendar / Overview)
router.get('/', getTasks);

// GET /api/tasks/my — Retrieve all tasks assigned to the authenticated employee
router.get('/my', getMyTasks);

// GET /api/tasks/:taskId — Retrieve a single task by ID
router.get('/:taskId', validateMongoIdParam('taskId'), getTaskById);

// PATCH /api/tasks/:taskId — Update task status or fields
router.patch('/:taskId', validateMongoIdParam('taskId'), updateTaskValidation, updateTask);

// DELETE /api/tasks/:taskId — Delete task and cascade delete its attachments
router.delete('/:taskId', validateMongoIdParam('taskId'), deleteTask);

// Task comments endpoints
// GET /api/tasks/:taskId/comments — Retrieve comments for a task
router.get('/:taskId/comments', validateMongoIdParam('taskId'), getTaskComments);

// POST /api/tasks/:taskId/comments — Add a new comment to a task
router.post('/:taskId/comments', validateMongoIdParam('taskId'), createTaskComment);

// POST /api/tasks/:taskId/attachments — Upload attachments to a task
router.post(
  '/:taskId/attachments',
  validateMongoIdParam('taskId'),
  uploadTaskAttachment.array('files', 5),
  uploadTaskAttachments
);

// GET /api/tasks/:taskId/attachments/:attachmentId — Download or view attachment
router.get(
  '/:taskId/attachments/:attachmentId',
  validateMongoIdParam('taskId'),
  validateMongoIdParam('attachmentId'),
  downloadTaskAttachment
);

// DELETE /api/tasks/:taskId/attachments/:attachmentId — Delete attachment
router.delete(
  '/:taskId/attachments/:attachmentId',
  validateMongoIdParam('taskId'),
  validateMongoIdParam('attachmentId'),
  deleteTaskAttachment
);

module.exports = router;
