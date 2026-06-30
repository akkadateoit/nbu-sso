'use strict';
const config = require('../config');

/**
 * Escape ค่าก่อนแทรกลง HTML ป้องกัน XSS
 * ใช้กับทุกค่าที่มาจาก user input (query string, form) ก่อน interpolate ใน template string
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ส่ง error response แบบปลอดภัย — ซ่อนรายละเอียด internal ใน production
 * ใช้แทน res.status(500).json({ error: e.message }) ทุกที่
 */
function sendError(res, statusCode, err, fallbackMessage = 'เกิดข้อผิดพลาดภายในระบบ') {
  console.error('[Error]', err);
  res.status(statusCode).json({
    error: config.isDev ? err.message : fallbackMessage,
  });
}

/**
 * ตรวจสอบว่า redirect_uri อยู่ใน allowlist ของแอป (เทียบที่ origin)
 * ป้องกัน Open Redirect — แอปที่ยังไม่ลงทะเบียน callback_urls จะถูกปฏิเสธเสมอ
 * @param {string} redirectUri
 * @param {string[]} allowedUrls - app.callback_urls จาก DB
 * @returns {boolean}
 */
function isValidRedirectUri(redirectUri, allowedUrls) {
  if (!allowedUrls || allowedUrls.length === 0) return false;

  let normalized = redirectUri;
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

  let target;
  try {
    target = new URL(normalized);
  } catch {
    return false;
  }

  return allowedUrls.some((allowed) => {
    let allowedNormalized = allowed;
    if (!/^https?:\/\//i.test(allowedNormalized)) allowedNormalized = 'https://' + allowedNormalized;
    try {
      return target.origin === new URL(allowedNormalized).origin;
    } catch {
      return false;
    }
  });
}

module.exports = { escapeHtml, sendError, isValidRedirectUri };
