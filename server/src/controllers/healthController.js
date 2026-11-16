const mongoose = require('mongoose');

/**
 * Health Controller
 * -----------------
 * Handles health check queries to verify server status and database connectivity.
 */
const getHealth = (req, res) => {
  // Check Mongoose connection state: 1 = connected, 2 = connecting, 0 = disconnected
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    status: 'ok',
    service: 'TeamFlow API',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: isDbConnected ? 'connected' : 'disconnected',
  });
};

module.exports = {
  getHealth,
};
