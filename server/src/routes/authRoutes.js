const express = require('express');
const { register, login, getMe, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { registerValidation, loginValidation } = require('../middleware/validators');

const router = express.Router();

// Public routes with structured validation
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', logout);

// Protected routes
router.get('/me', requireAuth, getMe);

module.exports = router;
