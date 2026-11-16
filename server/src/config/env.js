/**
 * Environment Configuration and Validation
 * ----------------------------------------
 * Validates that all mission-critical environment variables are defined.
 * Fails fast with a helpful, descriptive error message if any are missing.
 * Prevents insecure defaults (such as hardcoded JWT secrets) in production.
 */

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
];

const validateEnv = () => {
  const missing = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar] || process.env[envVar].trim() === '') {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('\n======================================================');
    console.error(' [CRITICAL ERROR] Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error(' Please define these in your server/.env file.');
    console.error(' Refer to server/.env.example for guidance.');
    console.error('======================================================\n');
    process.exit(1);
  }

  // Security check: Block insecure placeholder secrets in production
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.JWT_SECRET.includes('teamflow_super_secret')
  ) {
    console.error('\n======================================================');
    console.error(' [SECURITY ERROR] Insecure JWT_SECRET detected in production!');
    console.error(' Please set a strong, unique JWT_SECRET in server/.env.');
    console.error('======================================================\n');
    process.exit(1);
  }
};

module.exports = {
  validateEnv,
};
