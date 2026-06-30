'use strict';
const { google } = require('googleapis');
const path = require('path');
const config = require('../config');

/**
 * สร้าง Admin SDK client ที่ impersonate admin email
 * (ต้องมี Domain-wide Delegation บน Service Account)
 */
function getAdminClient() {
  let auth;
  // ถ้าระบุ JSON แบบ raw มาใน ENV (สำหรับ Cloud Run)
  if (config.google.serviceAccountRawJson) {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(config.google.serviceAccountRawJson),
      scopes: ['https://www.googleapis.com/auth/admin.directory.group.member.readonly'],
      clientOptions: { subject: config.google.workspaceAdminEmail },
    });
  } else {
    // ถ้าไม่มี ให้โหลดจากไฟล์ (สำหรับ Local)
    const keyPath = path.resolve(config.google.serviceAccountKeyPath);
    auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/admin.directory.group.member.readonly'],
      clientOptions: { subject: config.google.workspaceAdminEmail },
    });
  }

  return google.admin({ version: 'directory_v1', auth });
}

/**
 * ตรวจสอบว่า email เป็นสมาชิกของ ALLOWED_GOOGLE_GROUP หรือไม่
 * ใช้ hasMember() แทน get() เพราะรองรับทั้ง direct member และ nested member
 * (เช่น เอา group อื่นทั้งกลุ่มมาเป็นสมาชิกของ ALLOWED_GOOGLE_GROUP อีกที)
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
    const res = await admin.members.hasMember({
      groupKey: config.google.allowedGroup,
      memberKey: email,
    });
    const isMember = res.data.isMember === true;
    console.log(`[GroupCheck] ${isMember ? '✅' : '❌'} ${email} ${isMember ? 'เป็น' : 'ไม่เป็น'}สมาชิกของ ${config.google.allowedGroup}`);
    return isMember;
  } catch (err) {
    if (err.code === 404) {
      // 404 = ไม่พบ email นี้ในระบบ Workspace เลย (เช่น เป็น gmail.com ส่วนตัว)
      console.log(`[GroupCheck] ❌ ${email} ไม่พบในระบบ Workspace`);
      return false;
    }
    // Error อื่นๆ (network, auth) — throw ขึ้นไปให้ caller จัดการ
    console.error(`[GroupCheck] Error checking group membership:`, err.message);
    throw err;
  }
}

module.exports = { isGroupMember };
