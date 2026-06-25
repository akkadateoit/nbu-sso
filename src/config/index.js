'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * ตรวจสอบว่ามีค่า env ที่จำเป็นครบหรือไม่
 */
function require_env(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * โหลด RSA Key จากไฟล์ .pem
 */
function loadKey(envPathKey) {
  const filePath = path.resolve(process.env[envPathKey] || '');
  if (!fs.existsSync(filePath)) {
    throw new Error(`[Config] Key file not found: ${filePath} (set by ${envPathKey})`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

const config = {
  // ---- Server ----
  port: parseInt(process.env.APP_PORT || '3000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',

  // ---- Session ----
  sessionSecret: require_env('SESSION_SECRET'),

  // ---- Google OAuth ----
  google: {
    clientId:     require_env('GOOGLE_CLIENT_ID'),
    clientSecret: require_env('GOOGLE_CLIENT_SECRET'),
    callbackUrl:  require_env('GOOGLE_CALLBACK_URL'),
    // Admin SDK (สำหรับตรวจ Google Group)
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './secrets/service-account.json',
    workspaceAdminEmail:   require_env('GOOGLE_WORKSPACE_ADMIN_EMAIL'),
    allowedGroup:          require_env('ALLOWED_GOOGLE_GROUP'),
    // ตั้ง SKIP_GROUP_CHECK=true ใน .env สำหรับ local dev ที่ไม่มี Workspace
    skipGroupCheck: process.env.SKIP_GROUP_CHECK === 'true',
  },

  // ---- JWT ----
  jwt: {
    privateKey:  loadKey('JWT_PRIVATE_KEY_PATH'),
    publicKey:   loadKey('JWT_PUBLIC_KEY_PATH'),
    expiresIn:   process.env.JWT_EXPIRES_IN || '8h',
    algorithm:   'RS256',
    issuer:      'sso.northbkk.ac.th',
  },

  // ---- Database ----
  database: {
    connectionString: require_env('DATABASE_URL'),
    ssl: (process.env.NODE_ENV === 'production')
      ? { rejectUnauthorized: false }
      : false,
  },
};

module.exports = config;
