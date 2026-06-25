'use strict';
const { pool } = require('../db');

/**
 * Upsert ผู้ใช้ในตาราง users (สร้างถ้าไม่มี, update name ถ้ามีแล้ว)
 * @param {string} email
 * @param {string} name
 * @returns {Promise<{ id: number, email: string, name: string }>}
 */
async function upsertUser(email, name) {
  const sql = `
    INSERT INTO users (email, name)
    VALUES ($1, $2)
    ON CONFLICT (email)
    DO UPDATE SET name = EXCLUDED.name
    RETURNING id, email, name, is_active
  `;
  const { rows } = await pool.query(sql, [email, name]);
  return rows[0];
}

/**
 * ดึงสิทธิ์ 2 แกนของผู้ใช้สำหรับแอปที่ระบุ
 * JOIN กับ departments เพื่อดึงชื่อหน่วยงาน
 * @param {number} userId
 * @param {number} appId
 * @returns {Promise<object|null>}
 */
async function getUserPermission(userId, appId) {
  const sql = `
    SELECT
      uap.role_key,
      uap.scope_dept_id,
      d.dept_name  AS allowed_dept_name,
      d.dept_type  AS scope_level
    FROM user_app_permissions uap
    JOIN departments d ON d.id = uap.scope_dept_id
    WHERE uap.user_id = $1
      AND uap.app_id  = $2
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [userId, appId]);
  return rows[0] || null;
}

/**
 * ดึงข้อมูลแอปจาก app_name
 * @param {string} appName - APPLICATION_ID ที่แอปย่อยส่งมา
 * @returns {Promise<{ id: number, app_name: string }|null>}
 */
async function getAppByName(appName) {
  const sql = `SELECT id, app_name FROM apps WHERE app_name = $1 LIMIT 1`;
  const { rows } = await pool.query(sql, [appName]);
  return rows[0] || null;
}

module.exports = { upsertUser, getUserPermission, getAppByName };
