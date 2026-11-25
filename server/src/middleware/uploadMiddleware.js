const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Dedicated uploads directory outside client source tree
const uploadDir = path.join(__dirname, '../../uploads/task-attachments');
const avatarUploadDir = path.join(__dirname, '../../uploads/avatars');

// Ensure upload directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

// Maximum file sizes
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB for attachments
const MAX_AVATAR_SIZE = 3 * 1024 * 1024; // 3 MB for avatar pictures

// Allowed file extensions and corresponding MIME types
const ALLOWED_MIME_TYPES = new Map([
  ['.pdf', ['application/pdf']],
  ['.png', ['image/png']],
  ['.jpg', ['image/jpeg', 'image/jpg']],
  ['.jpeg', ['image/jpeg', 'image/jpg']],
  ['.doc', ['application/msword']],
  ['.docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  ['.xls', ['application/vnd.ms-excel']],
  ['.xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
]);

// Allowed image formats for avatars
const ALLOWED_AVATAR_MIMES = new Map([
  ['.png', ['image/png']],
  ['.jpg', ['image/jpeg', 'image/jpg']],
  ['.jpeg', ['image/jpeg', 'image/jpg']],
  ['.webp', ['image/webp']],
]);

// Storage configuration with unique randomized filenames to prevent collision and path traversal
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const safeFilename = `att_${timestamp}_${randomHash}${ext}`;
    cb(null, safeFilename);
  },
});

// Storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const safeFilename = `avatar_${timestamp}_${randomHash}${ext}`;
    cb(null, safeFilename);
  },
});

// File filter validating both extension and MIME type
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(ext)) {
    const error = new Error(`Unsupported file type: ${ext}. Allowed formats: PDF, PNG, JPG/JPEG, DOC/DOCX, XLS/XLSX.`);
    error.statusCode = 400;
    return cb(error, false);
  }

  const validMimes = ALLOWED_MIME_TYPES.get(ext);
  if (!validMimes.includes(file.mimetype)) {
    const error = new Error(`File MIME type mismatch (${file.mimetype} for ${ext}). File rejected.`);
    error.statusCode = 400;
    return cb(error, false);
  }

  cb(null, true);
};

// Avatar filter validating image extension and MIME type
const avatarFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_AVATAR_MIMES.has(ext)) {
    const error = new Error(`Unsupported image type: ${ext}. Allowed formats: PNG, JPG, JPEG, WEBP.`);
    error.statusCode = 400;
    return cb(error, false);
  }

  const validMimes = ALLOWED_AVATAR_MIMES.get(ext);
  if (!validMimes.includes(file.mimetype)) {
    const error = new Error(`Image MIME type mismatch (${file.mimetype} for ${ext}). File rejected.`);
    error.statusCode = 400;
    return cb(error, false);
  }

  cb(null, true);
};

// Configure Multer instance (max 5 files per request, 5MB limit each)
const uploadTaskAttachment = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
  fileFilter,
});

// Configure Multer instance for avatar images (max 1 file, 3MB limit)
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: MAX_AVATAR_SIZE,
    files: 1,
  },
  fileFilter: avatarFileFilter,
});

module.exports = {
  uploadTaskAttachment,
  uploadAvatar,
  uploadDir,
  avatarUploadDir,
  MAX_FILE_SIZE,
  MAX_AVATAR_SIZE,
};
