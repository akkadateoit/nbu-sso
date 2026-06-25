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
 * โหลด RSA Key จากไฟล์ .pem หรือจาก Environment Variable โดยตรง
 */
function loadKey(envPathKey, envRawKey) {
  // รองรับการใส่เนื้อหา Key โดยตรง (สำหรับ Cloud Run)
  if (envRawKey && process.env[envRawKey]) {
    // แปลง \n ที่เป็น string ให้เป็นขึ้นบรรทัดใหม่จริง
    return process.env[envRawKey].replace(/\\n/g, '\n');
  }

  const filePath = path.resolve(process.env[envPathKey] || '');
  if (!fs.existsSync(filePath)) {
    throw new Error(`[Config] Key file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

const config = {
  // ---- Server ----
  // Cloud Run จะส่งพอร์ตมาทางตัวแปร PORT อัตโนมัติ (ปกติคือ 8080)
  port: parseInt(process.env.PORT || process.env.APP_PORT || '3000', 10),
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
    serviceAccountRawJson: process.env.GOOGLE_SERVICE_ACCOUNT_RAW_JSON,
    workspaceAdminEmail:   require_env('GOOGLE_WORKSPACE_ADMIN_EMAIL'),
    allowedGroup:          require_env('ALLOWED_GOOGLE_GROUP'),
    // ตั้ง SKIP_GROUP_CHECK=true ใน .env สำหรับ local dev ที่ไม่มี Workspace
    skipGroupCheck: process.env.SKIP_GROUP_CHECK === 'true',
  },

  // ---- JWT ----
  jwt: {
    privateKey:  loadKey('JWT_PRIVATE_KEY_PATH', 'JWT_PRIVATE_KEY_RAW'),
    publicKey:   loadKey('JWT_PUBLIC_KEY_PATH', 'JWT_PUBLIC_KEY_RAW'),
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
