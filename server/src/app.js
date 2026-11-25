const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const planRoutes = require('./routes/planRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const activityRoutes = require('./routes/activityRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const securityHeaders = require('./middleware/securityHeaders');
const { authRateLimiter } = require('./middleware/rateLimiter');

const app = express();

/**
 * 1. Global Middleware
 */
// Set standard HTTP security headers (Helmet equivalent)
app.use(securityHeaders);

// Enable Cross-Origin Resource Sharing with credentials for the React frontend
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

// Parse JSON, URL-encoded request bodies, and incoming cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP request logging via Morgan (concise 'dev' format for local development; skipped in test runs)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

/**
 * 2. API Routes
 */
// Root welcome endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'TeamFlow SaaS API',
    phase: 'Phase 6 - Dynamic Dashboard & Subscriptions',
    healthCheck: '/healthz',
    endpoints: {
      auth: '/api/auth',
      organisations: '/api/orgs',
      projects: '/api/projects',
      tasks: '/api/tasks',
      dashboard: '/api/dashboard',
      plans: '/api/plans',
      usage: '/api/usage',
    },
  });
});

// Health check endpoint
app.use('/healthz', healthRoutes);

// Core API routes (with rate limiting on sensitive authentication & invitation flows)
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invitations', authRateLimiter, invitationRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', planRoutes);

/**
 * 3. 404 Not Found & Central Error Handling
 */
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
