const mongoose = require('mongoose');

/**
 * Connect to MongoDB database.
 * Uses process.env.MONGODB_URI.
 * Ensures credentials and connection string are never printed to console logs.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('[MongoDB] Warning: MONGODB_URI is not set in environment variables.');
    console.warn('[MongoDB] Please copy .env.example to .env and provide your MongoDB Atlas connection string.');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host} (DB: ${conn.connection.name})`);
    return true;
  } catch (error) {
    // Only log the error message, never the full connection string containing passwords
    console.error(`[MongoDB] Connection failed: ${error.message}`);
    return false;
  }
};

module.exports = connectDB;
