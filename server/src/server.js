const dotenv = require('dotenv');

// Load environment variables from .env file before anything else
dotenv.config();

const { validateEnv } = require('./config/env');
// Validate critical environment variables immediately on startup
validateEnv();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

/**
 * Start the TeamFlow Backend Server
 */
const startServer = async () => {
  // 1. Establish connection to MongoDB Atlas
  await connectDB();

  // 2. Start HTTP listener
  const server = app.listen(PORT, () => {
    console.log(`[TeamFlow Server] Running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`[TeamFlow Server] Local API URL:    http://localhost:${PORT}`);
    console.log(`[TeamFlow Server] Health check:     http://localhost:${PORT}/healthz`);
  });

  // 3. Graceful shutdown handlers
  const handleShutdown = (signal) => {
    console.log(`\n[TeamFlow Server] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('[TeamFlow Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
};

startServer();
