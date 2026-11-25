const express = require('express');
const {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  addProjectMembers,
  removeProjectMember,
  deleteProject,
} = require('../controllers/projectController');
const {
  getProjectTasks,
  createTask,
  getProjectProgress,
} = require('../controllers/taskController');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  validateMongoIdParam,
  createProjectValidation,
  updateProjectValidation,
  createTaskValidation,
} = require('../middleware/validators');

const router = express.Router();

// All project routes require valid authentication
router.use(requireAuth);

// Project endpoints
router.get('/', getProjects);
router.post('/', createProjectValidation, createProject);
router.get('/:projectId', validateMongoIdParam('projectId'), getProjectById);
router.patch('/:projectId', validateMongoIdParam('projectId'), updateProjectValidation, updateProject);
router.delete('/:projectId', validateMongoIdParam('projectId'), deleteProject);

// Project team member management endpoints
router.post('/:projectId/members', validateMongoIdParam('projectId'), addProjectMembers);
router.delete('/:projectId/members/:userId', validateMongoIdParam('projectId'), validateMongoIdParam('userId'), removeProjectMember);

// Project tasks & progress endpoints
router.get('/:projectId/tasks', validateMongoIdParam('projectId'), getProjectTasks);
router.post('/:projectId/tasks', validateMongoIdParam('projectId'), createTaskValidation, createTask);
router.get('/:projectId/progress', validateMongoIdParam('projectId'), getProjectProgress);

module.exports = router;
