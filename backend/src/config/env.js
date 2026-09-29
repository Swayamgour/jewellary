require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// Secrets must never fall back to a hard-coded value in production.
if (isProd) {
  const missing = ['MONGO_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long in production');
  }
}

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV,
  IS_PROD: isProd,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me_0123456789',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000,
  // Money-moving flows are only atomic on a replica set / Atlas cluster.
  // In production we refuse to run them without transactions (set to "false" to override).
  REQUIRE_TRANSACTIONS:
    process.env.REQUIRE_TRANSACTIONS !== undefined
      ? process.env.REQUIRE_TRANSACTIONS === 'true'
      : isProd
};
