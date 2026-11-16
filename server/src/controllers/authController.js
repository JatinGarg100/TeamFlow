const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Organisation, Membership } = require('../models');

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
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      organisation: {
        id: organisation._id,
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
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      organisation: membership?.orgId
        ? {
            id: membership.orgId._id,
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
        name: m.orgId.name,
        slug: m.orgId.slug,
        role: m.role,
        plan: m.orgId.plan,
        isOwner: m.orgId.ownerId.toString() === user._id.toString(),
      }));

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      organisations,
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

module.exports = {
  register,
  login,
  getMe,
  logout,
};
