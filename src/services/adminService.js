'use strict';
const { pool } = require('../db');
const crypto   = require('crypto');

// ── Stats ─────────────────────────────────────────────────────
async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM apps    WHERE is_active = true)  AS active_apps,
      (SELECT COUNT(*) FROM apps)                             AS total_apps,
      (SELECT COUNT(*) FROM users   WHERE is_active = true)  AS active_users,
      (SELECT COUNT(*) FROM users)                            AS total_users,
      (SELECT COUNT(*) FROM user_app_permissions)             AS total_permissions
  `);
  return rows[0];
}

async function getRecentAuditLogs(limit = 8) {
  const { rows } = await pool.query(`
    SELECT id, acted_by_email, action, target_email, app_name, detail, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

// ── Apps ──────────────────────────────────────────────────────
async function listApps() {
  const { rows } = await pool.query(`
    SELECT
      a.id, a.app_name, a.description, a.is_active, a.created_at,
      COUNT(uap.id)::int AS permission_count
    FROM apps a
    LEFT JOIN user_app_permissions uap ON uap.app_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `);
  return rows;
}

async function createApp(appName, description) {
  const secret = crypto.randomBytes(32).toString('hex');
  const { rows } = await pool.query(`
    INSERT INTO apps (app_name, app_secret, description)
    VALUES ($1, $2, $3)
    RETURNING id, app_name, description, is_active, created_at
  `, [appName, secret, description]);
  return { ...rows[0], app_secret: secret };
}

async function updateApp(id, fields) {
  const sets   = [];
  const values = [];
  let   idx    = 1;
  if (fields.description !== undefined) { sets.push(`description = $${idx++}`); values.push(fields.description); }
  if (fields.is_active   !== undefined) { sets.push(`is_active   = $${idx++}`); values.push(fields.is_active); }
  if (!sets.length) return null;
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE apps SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, app_name, description, is_active`,
    values
  );
  return rows[0] || null;
}

// ── Users ─────────────────────────────────────────────────────
async function listUsers({ search = '', page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const pattern = `%${search}%`;
  const { rows } = await pool.query(`
    SELECT
      u.id, u.email, u.name, u.is_active, u.created_at,
      COUNT(uap.id)::int AS permission_count
    FROM users u
    LEFT JOIN user_app_permissions uap ON uap.user_id = u.id
    WHERE u.email ILIKE $1 OR u.name ILIKE $1
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT $2 OFFSET $3
  `, [pattern, limit, offset]);

  const { rows: countRows } = await pool.query(`
    SELECT COUNT(*)::int AS total FROM users
    WHERE email ILIKE $1 OR name ILIKE $1
  `, [pattern]);

  return { users: rows, total: countRows[0].total, page, limit };
}

async function getUserPermissions(userId) {
  const { rows } = await pool.query(`
    SELECT
      uap.id, uap.role_key, uap.scope_dept_id, uap.assigned_at,
      a.app_name, a.description AS app_description,
      d.dept_name, d.dept_type AS scope_level
    FROM user_app_permissions uap
    JOIN apps        a ON a.id = uap.app_id
    JOIN departments d ON d.id = uap.scope_dept_id
    WHERE uap.user_id = $1
    ORDER BY a.app_name
  `, [userId]);
  return rows;
}

async function setUserActive(userId, isActive) {
  const { rows } = await pool.query(`
    UPDATE users SET is_active = $1 WHERE id = $2
    RETURNING id, email, name, is_active
  `, [isActive, userId]);
  return rows[0] || null;
}

// ── Permissions ───────────────────────────────────────────────
async function grantPermission(userId, appId, roleKey, scopeDeptId) {
  const { rows } = await pool.query(`
    INSERT INTO user_app_permissions (user_id, app_id, role_key, scope_dept_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, app_id, scope_dept_id)
    DO UPDATE SET role_key = EXCLUDED.role_key
    RETURNING id, user_id, app_id, role_key, scope_dept_id
  `, [userId, appId, roleKey, scopeDeptId]);
  return rows[0];
}

async function updatePermission(permId, roleKey) {
  const { rows } = await pool.query(`
    UPDATE user_app_permissions SET role_key = $1 WHERE id = $2
    RETURNING id, user_id, app_id, role_key, scope_dept_id
  `, [roleKey, permId]);
  return rows[0] || null;
}

async function revokePermission(permId) {
  const { rows } = await pool.query(`
    DELETE FROM user_app_permissions WHERE id = $1
    RETURNING id, user_id, app_id, role_key
  `, [permId]);
  return rows[0] || null;
}

// ── Departments & Roles ───────────────────────────────────────
async function listDepartments() {
  const { rows } = await pool.query(`
    SELECT id, dept_name, dept_type, parent_id FROM departments ORDER BY id
  `);
  return rows;
}

async function listRoles() {
  const { rows } = await pool.query(`
    SELECT role_key, role_name, description FROM roles ORDER BY role_key
  `);
  return rows;
}

// ── Audit Logs ────────────────────────────────────────────────
async function listAuditLogs({ page = 1, limit = 30 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(`
    SELECT id, acted_by_email, action, target_email, app_name, detail, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
  const { rows: c } = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_logs`);
  return { logs: rows, total: c[0].total, page, limit };
}

async function writeAuditLog({ actedById, actedByEmail, action, targetEmail, appName, detail }) {
  await pool.query(`
    INSERT INTO audit_logs (acted_by_id, acted_by_email, action, target_email, app_name, detail)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [actedById || null, actedByEmail, action, targetEmail || null, appName || null, JSON.stringify(detail || {})]);
}

module.exports = {
  getStats, getRecentAuditLogs,
  listApps, createApp, updateApp,
  listUsers, getUserPermissions, setUserActive,
  grantPermission, updatePermission, revokePermission,
  listDepartments, listRoles,
  listAuditLogs, writeAuditLog,
};
