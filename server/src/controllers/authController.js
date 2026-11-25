const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User, Organisation, Membership } = require('../models');
const { avatarUploadDir } = require('../middleware/uploadMiddleware');

// Helper to sign JWT tokens
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured on the server.');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId }, secret, { expiresIn });
};

// Helper to set cookie
const setAuthCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Helper to generate a unique lowercase URL-safe slug
const generateUniqueSlug = async (name) => {
  let baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';

  let slug = baseSlug;
  let counter = 1;

  while (await Organisation.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

/**
 * POST /api/auth/register
 * -----------------------
 * Registers a new user, creates their primary organisation and assigns them as owner.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, organisationName } = req.body;

    // 1. Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Name is required (at least 2 characters).' },
      });
    }

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: { message: 'Please provide a valid email address.' },
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { message: 'Password is required (minimum 6 characters).' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 2. Prevent duplicate registrations
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { message: 'An account with this email already exists. Please sign in instead.' },
      });
    }

    // 3. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Create User
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
    });

    // 5. Create Organisation
    const orgDisplayName = (organisationName && organisationName.trim())
      ? organisationName.trim()
      : `${name.trim().split(' ')[0]}'s Workspace`;

    const slug = await generateUniqueSlug(orgDisplayName);

    const organisation = await Organisation.create({
      name: orgDisplayName,
      slug,
      ownerId: user._id,
      plan: 'free',
    });

    // 6. Create Owner Membership
    const membership = await Membership.create({
      orgId: organisation._id,
      userId: user._id,
      role: 'owner',
    });

    // 7. Sign JWT and set cookie
    const token = generateToken(user._id);
    setAuthCookie(res, token);

    // 8. Return safe user & organisation response
    res.status(201).json({
      success: true,
      message: 'Account and organisation created successfully.',
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        authProvider: user.authProvider || 'local',
        createdAt: user.createdAt,
      },
      organisation: {
        id: organisation._id,
        _id: organisation._id,
        name: organisation.name,
        slug: organisation.slug,
        role: membership.role,
        plan: organisation.plan,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * --------------------
 * Authenticates user via email + password, issues JWT cookie.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Both email and password are required.' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Look up user
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' },
      });
    }

    // 2. Verify password hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' },
      });
    }

    // 3. Find primary organisation membership
    const membership = await Membership.findOne({ userId: user._id })
      .populate('orgId', 'name slug plan')
      .sort({ createdAt: 1 });

    // 4. Generate token and set cookie
    const token = generateToken(user._id);
    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        authProvider: user.authProvider || 'local',
        createdAt: user.createdAt,
      },
      organisation: membership?.orgId
        ? {
            id: membership.orgId._id,
            _id: membership.orgId._id,
            name: membership.orgId.name,
            slug: membership.orgId.slug,
            role: membership.role,
            plan: membership.orgId.plan,
          }
        : null,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * ----------------
 * Returns current authenticated user and all organisations they belong to.
 */
const getMe = async (req, res, next) => {
  try {
    const user = req.user;

    // Fetch user's memberships
    const memberships = await Membership.find({ userId: user._id })
      .populate('orgId', 'name slug plan ownerId')
      .sort({ createdAt: 1 });

    const organisations = memberships
      .filter((m) => m.orgId) // Guard against any deleted orgs
      .map((m) => ({
        id: m.orgId._id,
        _id: m.orgId._id,
        name: m.orgId.name,
        slug: m.orgId.slug,
        role: m.role,
        plan: m.orgId.plan,
        isOwner: m.orgId.ownerId.toString() === user._id.toString(),
      }));

    const activeOrganisation = organisations.length > 0 ? organisations[0] : null;

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        authProvider: user.authProvider || 'local',
        createdAt: user.createdAt,
      },
      organisation: activeOrganisation,
      membership: activeOrganisation ? { role: activeOrganisation.role } : null,
      organisations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/google
 * ---------------------
 * Authenticates user via Google OAuth ID token.
 * Verifies token cryptographically with Google, handles account linking or
 * creates new User + default Organisation + Owner Membership.
 */
const googleAuth = async (req, res, next) => {
  try {
    const { idToken, credential, organisationName } = req.body;
    const tokenToVerify = idToken || credential;

    if (!tokenToVerify) {
      return res.status(400).json({
        success: false,
        error: { message: 'Google ID token or credential is required.' },
      });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return res.status(503).json({
        success: false,
        error: {
          message: 'Google Sign-In is not configured on the server. Please set GOOGLE_CLIENT_ID.',
        },
      });
    }

    // Initialize OAuth2 client
    const client = new OAuth2Client(googleClientId);

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: tokenToVerify,
        audience: googleClientId,
      });
    } catch (verifyErr) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired Google authentication token: ' + (verifyErr.message || 'Verification failed'),
        },
      });
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        error: { message: 'Unable to retrieve user profile from Google token payload.' },
      });
    }

    if (!payload.email_verified) {
      return res.status(400).json({
        success: false,
        error: { message: 'Your Google email address is not verified by Google.' },
      });
    }

    const cleanEmail = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const name = payload.name || cleanEmail.split('@')[0];
    const picture = payload.picture || '';

    // Check if user exists by googleId or email
    let user = await User.findOne({
      $or: [
        { googleId },
        { email: cleanEmail },
      ],
    });

    let isNewUser = false;

    if (user) {
      // Existing user found: securely link googleId without overwriting existing password
      let modified = false;
      if (!user.googleId) {
        user.googleId = googleId;
        modified = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    } else {
      // New user registration via Google
      isNewUser = true;
      user = await User.create({
        name,
        email: cleanEmail,
        googleId,
        authProvider: 'google',
        avatar: picture,
      });
    }

    // Find primary organisation membership
    let membership = await Membership.findOne({ userId: user._id })
      .populate('orgId', 'name slug plan')
      .sort({ createdAt: 1 });

    let organisation = membership?.orgId || null;

    if (!organisation) {
      // User has no workspace, create default primary workspace
      const orgDisplayName = (organisationName && organisationName.trim())
        ? organisationName.trim()
        : `${name.split(' ')[0]}'s Workspace`;

      const slug = await generateUniqueSlug(orgDisplayName);

      organisation = await Organisation.create({
        name: orgDisplayName,
        slug,
        ownerId: user._id,
        plan: 'free',
      });

      membership = await Membership.create({
        orgId: organisation._id,
        userId: user._id,
        role: 'owner',
      });
    }

    // Sign JWT and set cookie
    const token = generateToken(user._id);
    setAuthCookie(res, token);

    return res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser ? 'Account registered successfully with Google.' : 'Signed in with Google.',
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        authProvider: user.authProvider || 'google',
        createdAt: user.createdAt,
      },
      organisation: {
        id: organisation._id,
        _id: organisation._id,
        name: organisation.name,
        slug: organisation.slug,
        role: membership.role,
        plan: organisation.plan,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * ---------------------
 * Clears authentication cookie.
 */
const logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({
    success: true,
    message: 'Signed out successfully.',
  });
};

/**
 * POST /api/auth/avatar
 * ---------------------
 * Uploads user profile avatar and updates user document.
 */
const uploadUserAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'Please provide an image file to upload.' },
      });
    }

    const avatarUrl = `/api/auth/avatar/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-passwordHash');

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully.',
      avatar: avatarUrl,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/avatar/:filename
 * ------------------------------
 * Serves user avatar image safely with traversal protection.
 */
const serveAvatar = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(avatarUploadDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: { message: 'Avatar image not found.' },
      });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/auth/profile
 * -----------------------
 * Updates current user's profile details (e.g. name, avatar).
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, avatar } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: { message: 'Name must be at least 2 characters long.' },
        });
      }
      updates.name = name.trim();
    }

    if (avatar !== undefined) {
      updates.avatar = typeof avatar === 'string' ? avatar.trim() : '';
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-passwordHash');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  getMe,
  logout,
  uploadUserAvatar,
  serveAvatar,
  updateProfile,
};
