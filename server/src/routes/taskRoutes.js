const express = require('express');
const {
  updateTask,
  getMyTasks,
  uploadTaskAttachments,
  downloadTaskAttachment,
  deleteTaskAttachment,
} = require('../controllers/taskController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateMongoIdParam, updateTaskValidation } = require('../middleware/validators');
const { uploadTaskAttachment } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(requireAuth);

// GET /api/tasks/my — Retrieve all tasks assigned to the authenticated employee
router.get('/my', getMyTasks);

// PATCH /api/tasks/:taskId — Update task status or fields
router.patch('/:taskId', validateMongoIdParam('taskId'), updateTaskValidation, updateTask);

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
