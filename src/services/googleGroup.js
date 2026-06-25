'use strict';
const { google } = require('googleapis');
const path = require('path');
const config = require('../config');

/**
 * สร้าง Admin SDK client ที่ impersonate admin email
 * (ต้องมี Domain-wide Delegation บน Service Account)
 */
function getAdminClient() {
  const keyPath = path.resolve(config.google.serviceAccountKeyPath);
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/admin.directory.group.member.readonly'],
    // Impersonate admin เพื่อใช้ Admin SDK
    clientOptions: {
      subject: config.google.workspaceAdminEmail,
    },
  });
  return google.admin({ version: 'directory_v1', auth });
}

/**
 * ตรวจสอบว่า email เป็นสมาชิกของ ALLOWED_GOOGLE_GROUP หรือไม่
 * @param {string} email - อีเมลที่ต้องการตรวจ
 * @returns {Promise<boolean>}
 */
async function isGroupMember(email) {
  // ถ้าตั้ง SKIP_GROUP_CHECK=true ใน .env (สำหรับ local dev) — ข้ามการตรวจ
  if (config.google.skipGroupCheck) {
    console.log(`[GroupCheck] ⚠️  SKIP_GROUP_CHECK=true — ข้ามการตรวจ Group สำหรับ: ${email}`);
    return true;
  }

  try {
    const admin = getAdminClient();
    await admin.members.get({
      groupKey: config.google.allowedGroup,
      memberKey: email,
    });
    // ถ้า API ไม่ throw error แปลว่าพบ member
    console.log(`[GroupCheck] ✅ ${email} เป็นสมาชิกของ ${config.google.allowedGroup}`);
    return true;
  } catch (err) {
    if (err.code === 404) {
      // 404 = ไม่พบใน Group (นักศึกษา หรือบุคคลภายนอก)
      console.log(`[GroupCheck] ❌ ${email} ไม่เป็นสมาชิกของ ${config.google.allowedGroup}`);
      return false;
    }
    // Error อื่นๆ (network, auth) — throw ขึ้นไปให้ caller จัดการ
    console.error(`[GroupCheck] Error checking group membership:`, err.message);
    throw err;
  }
}

module.exports = { isGroupMember };
