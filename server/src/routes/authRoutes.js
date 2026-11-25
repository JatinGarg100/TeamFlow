const express = require('express');
const {
  register,
  login,
  googleAuth,
  getMe,
  logout,
  uploadUserAvatar,
  serveAvatar,
  updateProfile,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { registerValidation, loginValidation } = require('../middleware/validators');
const { uploadAvatar } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public routes with structured validation
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/google', googleAuth);
router.post('/logout', logout);

// Public route to view/stream user avatar images safely
router.get('/avatar/:filename', serveAvatar);

// Protected routes
router.get('/me', requireAuth, getMe);
router.patch('/profile', requireAuth, updateProfile);
router.post('/avatar', requireAuth, uploadAvatar.single('avatar'), uploadUserAvatar);

module.exports = router;
