/**
 * Validation Middleware & Schemas (express-validator)
 * ----------------------------------------------------
 * Provides structured request validation and sanitization for:
 * - Authentication (Registration & Login)
 * - Employee Creation
 * - Project Creation & Updates
 * - Task Creation & Updates
 * - Common MongoDB ObjectIds
 *
 * Ensures all bad inputs are rejected early with consistent, descriptive error payloads
 * before reaching database or business logic.
 */

const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Common middleware that evaluates the validation result.
 * If errors are detected, formats them into a standardized HTTP 400 response.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return res.status(400).json({
      success: false,
      error: {
        message: formattedErrors[0].message, // Top-level readable summary
        statusCode: 400,
        details: formattedErrors,
      },
    });
  }
  next();
};

/**
 * Validates a MongoDB ObjectId parameter
 */
const validateMongoIdParam = (paramName) => [
  param(paramName)
    .notEmpty()
    .withMessage(`${paramName} parameter is required`)
    .bail()
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage(`Invalid ${paramName} format. Must be a 24-character hexadecimal ObjectId`),
  validate,
];

/**
 * Registration Validation Rules
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .bail()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .bail()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .bail()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('organisationName')
    .trim()
    .notEmpty()
    .withMessage('Organisation / Workspace name is required')
    .bail()
    .isLength({ min: 2, max: 100 })
    .withMessage('Organisation name must be between 2 and 100 characters'),

  validate,
];

/**
 * Login Validation Rules
 */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .bail()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  validate,
];

/**
 * Direct Employee Account Creation Validation Rules
 */
const addEmployeeValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Employee full name is required')
    .bail()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Employee email address is required')
    .bail()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long if provided'),

  body('role')
    .optional()
    .isIn(['admin', 'member'])
    .withMessage("Role must be either 'admin' or 'member'"),

  validate,
];

/**
 * Project Creation Validation Rules
 */
const createProjectValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Project title is required')
    .bail()
    .isLength({ min: 2, max: 120 })
    .withMessage('Project title must be between 2 and 120 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),

  body('status')
    .optional()
    .isIn(['Planning', 'In Progress', 'Completed', 'On Hold'])
    .withMessage("Status must be one of: 'Planning', 'In Progress', 'Completed', 'On Hold'"),

  body('deadline')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Deadline must be a valid ISO 8601 date string (e.g. YYYY-MM-DD)'),

  body('teamMembers')
    .optional()
    .isArray()
    .withMessage('teamMembers must be an array of user IDs')
    .bail()
    .custom((arr) => arr.every((id) => mongoose.Types.ObjectId.isValid(id)))
    .withMessage('Every item in teamMembers must be a valid MongoDB ObjectId'),

  validate,
];

/**
 * Project Update Validation Rules
 */
const updateProjectValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Project title cannot be empty')
    .isLength({ min: 2, max: 120 })
    .withMessage('Project title must be between 2 and 120 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),

  body('status')
    .optional()
    .isIn(['Planning', 'In Progress', 'Completed', 'On Hold'])
    .withMessage("Status must be one of: 'Planning', 'In Progress', 'Completed', 'On Hold'"),

  body('deadline')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Deadline must be a valid ISO 8601 date string'),

  body('teamMembers')
    .optional()
    .isArray()
    .withMessage('teamMembers must be an array of user IDs')
    .bail()
    .custom((arr) => arr.every((id) => mongoose.Types.ObjectId.isValid(id)))
    .withMessage('Every item in teamMembers must be a valid MongoDB ObjectId'),

  validate,
];

/**
 * Task Creation Validation Rules
 * Note: projectId comes from req.params.projectId in /api/projects/:projectId/tasks
 */
const createTaskValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required')
    .bail()
    .isLength({ min: 2, max: 150 })
    .withMessage('Task title must be between 2 and 150 characters'),

  body('projectId')
    .optional()
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid projectId format. Must be a valid MongoDB ObjectId'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),

  body('status')
    .optional()
    .isIn(['To Do', 'In Progress', 'Completed', 'Pending'])
    .withMessage("Status must be one of: 'To Do', 'In Progress', 'Completed', 'Pending'"),

  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage("Priority must be one of: 'Low', 'Medium', 'High', 'Critical'"),

  body('dueDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('dueDate must be a valid ISO 8601 date string'),

  body('assignedTo')
    .optional()
    .custom((val) => {
      if (Array.isArray(val)) {
        return val.every((id) => mongoose.Types.ObjectId.isValid(id));
      }
      return mongoose.Types.ObjectId.isValid(val);
    })
    .withMessage('assignedTo must be a valid ObjectId or an array of valid ObjectIds'),

  validate,
];

/**
 * Task Update Validation Rules
 */
const updateTaskValidation = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Task title cannot be empty')
    .isLength({ min: 2, max: 150 })
    .withMessage('Task title must be between 2 and 150 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),

  body('status')
    .optional()
    .isIn(['To Do', 'In Progress', 'Completed', 'Pending'])
    .withMessage("Status must be one of: 'To Do', 'In Progress', 'Completed', 'Pending'"),

  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage("Priority must be one of: 'Low', 'Medium', 'High', 'Critical'"),

  body('dueDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('dueDate must be a valid ISO 8601 date string'),

  body('assignedTo')
    .optional()
    .custom((val) => {
      if (Array.isArray(val)) {
        return val.every((id) => mongoose.Types.ObjectId.isValid(id));
      }
      return mongoose.Types.ObjectId.isValid(val);
    })
    .withMessage('assignedTo must be a valid ObjectId or an array of valid ObjectIds'),

  validate,
];

/**
 * Task Status Only Update Validation (For individual employees updating their status)
 */
const updateTaskStatusValidation = [
  body('status')
    .notEmpty()
    .withMessage('status is required')
    .bail()
    .isIn(['To Do', 'In Progress', 'Completed', 'Pending'])
    .withMessage("Status must be one of: 'To Do', 'In Progress', 'Completed', 'Pending'"),

  validate,
];

module.exports = {
  validate,
  validateMongoIdParam,
  registerValidation,
  loginValidation,
  addEmployeeValidation,
  createProjectValidation,
  updateProjectValidation,
  createTaskValidation,
  updateTaskValidation,
  updateTaskStatusValidation,
};
