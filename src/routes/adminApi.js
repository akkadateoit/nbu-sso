'use strict';
const express      = require('express');
const { verifyToken } = require('../services/jwt');
const svc          = require('../services/adminService');
const { sendError } = require('../utils/security');

const router = express.Router();

// ── Auth Middleware (ADMIN role ใน sso-admin เท่านั้น) ────────
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const result = verifyToken(token);
  if (!result.valid) return res.status(401).json({ error: result.error });

  const { permission, application_id } = result.payload;
  if (application_id !== 'sso-admin' || permission?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'ต้องเป็น ADMIN ของ sso-admin เท่านั้น' });
  }

  req.adminUser = result.payload;
  next();
}

router.use(requireAdmin);

// ── Dashboard Stats ───────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [stats, recentLogs] = await Promise.all([
      svc.getStats(),
      svc.getRecentAuditLogs(8),
    ]);
    res.json({ stats, recentLogs });
  } catch (e) {
    sendError(res, 500, e);
  }
});

// ── Apps ──────────────────────────────────────────────────────
router.get('/apps', async (req, res) => {
  try {
    res.json(await svc.listApps());
  } catch (e) {
    sendError(res, 500, e);
  }
});

router.post('/apps', async (req, res) => {
  const { app_name, description, callback_urls } = req.body;
  if (!app_name) return res.status(400).json({ error: 'app_name is required' });
  if (!/^[a-z0-9-]+$/.test(app_name))
    return res.status(400).json({ error: 'app_name ใช้ได้เฉพาะตัวพิมพ์เล็ก ตัวเลข และ -' });

  const urls = Array.isArray(callback_urls) ? callback_urls.filter(Boolean) : [];
  if (!urls.length)
    return res.status(400).json({ error: 'ต้องระบุ callback_urls อย่างน้อย 1 URL (ป้องกัน Open Redirect)' });
  for (const u of urls) {
    try { new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); }
    catch { return res.status(400).json({ error: `callback_url ไม่ถูกต้อง: ${u}` }); }
  }

  try {
    const app = await svc.createApp(app_name, description || '', urls);
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: 'CREATE_APP', appName: app_name, detail: { description, callback_urls: urls },
    });
    res.status(201).json(app);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'App ID นี้มีอยู่แล้ว' });
    sendError(res, 500, e);
  }
});

router.patch('/apps/:id', async (req, res) => {
  const { description, is_active, callback_urls } = req.body;

  let urls;
  if (callback_urls !== undefined) {
    urls = Array.isArray(callback_urls) ? callback_urls.filter(Boolean) : [];
    for (const u of urls) {
      try { new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); }
      catch { return res.status(400).json({ error: `callback_url ไม่ถูกต้อง: ${u}` }); }
    }
  }

  try {
    const app = await svc.updateApp(req.params.id, { description, is_active, callback_urls: urls });
    if (!app) return res.status(404).json({ error: 'ไม่พบ App' });
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: is_active === false ? 'DISABLE_APP' : 'UPDATE_APP',
      appName: app.app_name, detail: { is_active, description, callback_urls: urls },
    });
    res.json(app);
  } catch (e) {
    sendError(res, 500, e);
  }
});

// ── Users ─────────────────────────────────────────────────────
router.post('/users', async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'ต้องส่ง email' });
  if (!email.endsWith('@northbkk.ac.th'))
    return res.status(400).json({ error: 'อีเมลต้องลงท้ายด้วย @northbkk.ac.th เท่านั้น' });
  try {
    const user = await svc.createUser(email.toLowerCase().trim(), name?.trim() || '');
    if (!user) return res.status(409).json({ error: `อีเมล ${email} มีในระบบแล้ว` });
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: 'CREATE_USER', targetEmail: email,
      detail: { name: user.name },
    });
    res.status(201).json(user);
  } catch (e) {
    sendError(res, 500, e);
  }
});

router.get('/users', async (req, res) => {
  const { search = '', page = '1', limit = '20' } = req.query;
  try {
    res.json(await svc.listUsers({ search, page: +page, limit: +limit }));
  } catch (e) {
    sendError(res, 500, e);
  }
});

router.get('/users/:id/permissions', async (req, res) => {
  try {
    res.json(await svc.getUserPermissions(req.params.id));
  } catch (e) {
    sendError(res, 500, e);
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await svc.deleteUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบ User' });
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: 'DELETE_USER', targetEmail: user.email,
      detail: { user_id: req.params.id },
    });
    res.json({ success: true, deleted: user });
  } catch (e) {
    sendError(res, 500, e);
  }
});

// คัดลอกสิทธิ์ทั้งหมดของ user คนนี้ (:id = ต้นทาง) ไปให้ email ปลายทาง
// ถ้า email ปลายทางยังไม่มี user ในระบบ จะสร้างให้อัตโนมัติ (เหมือน "เพิ่มผู้ใช้ล่วงหน้า")
router.post('/users/:id/copy-permissions', async (req, res) => {
  const { target_email, target_name } = req.body;
  if (!target_email) return res.status(400).json({ error: 'ต้องส่ง target_email' });
  const email = target_email.toLowerCase().trim();
  if (!email.endsWith('@northbkk.ac.th'))
    return res.status(400).json({ error: 'อีเมลต้องลงท้ายด้วย @northbkk.ac.th เท่านั้น' });

  try {
    const { pool } = require('../db');
    const { rows: sr } = await pool.query('SELECT id, email FROM users WHERE id=$1', [req.params.id]);
    const sourceUser = sr[0];
    if (!sourceUser) return res.status(404).json({ error: 'ไม่พบ User ต้นทาง' });
    if (sourceUser.email === email)
      return res.status(400).json({ error: 'อีเมลปลายทางต้องไม่ใช่คนเดียวกับต้นทาง' });

    const { user: targetUser, created } = await svc.findOrCreateUser(email, target_name?.trim());
    const copied = await svc.copyPermissions(sourceUser.id, targetUser.id);

    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: 'COPY_PERMISSIONS', targetEmail: email,
      detail: { source_email: sourceUser.email, target_user_created: created, permission_count: copied.length },
    });

    res.status(201).json({ target_user: targetUser, target_user_created: created, copied_count: copied.length });
  } catch (e) {
    sendError(res, 500, e);
  }
});

router.patch('/users/:id/active', async (req, res) => {
  const { is_active } = req.body;
  try {
    const user = await svc.setUserActive(req.params.id, is_active);
    if (!user) return res.status(404).json({ error: 'ไม่พบ User' });
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: is_active ? 'ENABLE_USER' : 'DISABLE_USER',
      targetEmail: user.email, detail: { is_active },
    });
    res.json(user);
  } catch (e) {
    sendError(res, 500, e);
  }
});

// ── Permissions ───────────────────────────────────────────────
router.post('/permissions', async (req, res) => {
  const { user_id, app_id, role_key, scope_dept_id } = req.body;
  if (!user_id || !app_id || !role_key || !scope_dept_id)
    return res.status(400).json({ error: 'ต้องส่ง user_id, app_id, role_key, scope_dept_id' });
  try {
    const perm = await svc.grantPermission(user_id, app_id, role_key, scope_dept_id);

    // ดึง email + app_name สำหรับ log
    const { pool } = require('../db');
    const [{ rows: ur }, { rows: ar }] = await Promise.all([
      pool.query('SELECT email FROM users WHERE id=$1', [user_id]),
      pool.query('SELECT app_name FROM apps WHERE id=$1', [app_id]),
    ]);
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: 'GRANT', targetEmail: ur[0]?.email,
      appName: ar[0]?.app_name, detail: { role_key, scope_dept_id },
    });
    res.status(201).json(perm);
  } catch (e) {
    sendError(res, 500, e);
  }
});

router.patch('/permissions/:id', async (req, res) => {
  const { role_key, scope_dept_id } = req.body;
  if (!role_key && !scope_dept_id)
    return res.status(400).json({ error: 'ต้องส่งอย่างน้อย role_key หรือ scope_dept_id' });
  try {
    const perm = await svc.updatePermission(req.params.id, {
      roleKey:     role_key,
      scopeDeptId: scope_dept_id,
    });
    if (!perm) return res.status(404).json({ error: 'ไม่พบ Permission' });
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: 'UPDATE', detail: { permission_id: req.params.id, role_key, scope_dept_id },
    });
    res.json(perm);
  } catch (e) {
    sendError(res, 500, e);
  }
});

router.delete('/permissions/:id', async (req, res) => {
  try {
    const perm = await svc.revokePermission(req.params.id);
    if (!perm) return res.status(404).json({ error: 'ไม่พบ Permission' });
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: 'REVOKE', detail: { permission_id: req.params.id, role_key: perm.role_key },
    });
    res.json({ success: true });
  } catch (e) {
    sendError(res, 500, e);
  }
});

// ── Roles CRUD ────────────────────────────────────────────────
router.get('/roles', async (req, res) => {
  try { res.json(await svc.listRoles()); }
  catch (e) { sendError(res, 500, e); }
});

router.post('/roles', async (req, res) => {
  const { role_key, role_name, description } = req.body;
  if (!role_key || !role_name) return res.status(400).json({ error: 'ต้องส่ง role_key และ role_name' });
  if (!/^[A-Z0-9_]+$/.test(role_key))
    return res.status(400).json({ error: 'role_key ใช้ได้เฉพาะตัวพิมพ์ใหญ่ ตัวเลข และ _' });
  try {
    const role = await svc.createRole(role_key, role_name, description || '');
    await svc.writeAuditLog({ actedById: req.adminUser.sub, actedByEmail: req.adminUser.email, action: 'CREATE_ROLE', detail: { role_key, role_name } });
    res.status(201).json(role);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Role Key นี้มีอยู่แล้ว' });
    sendError(res, 500, e);
  }
});

router.patch('/roles/:key', async (req, res) => {
  const { role_name, description } = req.body;
  try {
    const role = await svc.updateRole(req.params.key, { role_name, description });
    if (!role) return res.status(404).json({ error: 'ไม่พบ Role' });
    res.json(role);
  } catch (e) { sendError(res, 500, e); }
});

router.delete('/roles/:key', async (req, res) => {
  try {
    const role = await svc.deleteRole(req.params.key);
    if (!role) return res.status(404).json({ error: 'ไม่พบ Role' });
    res.json({ success: true });
  } catch (e) {
    if (e.code === '23503') return res.status(409).json({ error: 'ไม่สามารถลบได้ เพราะมีผู้ใช้ที่ใช้ Role นี้อยู่' });
    sendError(res, 500, e);
  }
});

// ── Departments CRUD ──────────────────────────────────────────
router.get('/departments', async (req, res) => {
  try { res.json(await svc.listDepartments()); }
  catch (e) { sendError(res, 500, e); }
});

router.post('/departments', async (req, res) => {
  const { dept_name, dept_type, parent_id } = req.body;
  if (!dept_name || !dept_type) return res.status(400).json({ error: 'ต้องส่ง dept_name และ dept_type' });
  const validTypes = ['UNIVERSITY', 'FACULTY', 'BRANCH', 'OFFICE'];
  if (!validTypes.includes(dept_type)) return res.status(400).json({ error: `dept_type ต้องเป็น: ${validTypes.join(', ')}` });
  try {
    const dept = await svc.createDepartment(dept_name, dept_type, parent_id || null);
    await svc.writeAuditLog({ actedById: req.adminUser.sub, actedByEmail: req.adminUser.email, action: 'CREATE_DEPT', detail: { dept_name, dept_type } });
    res.status(201).json(dept);
  } catch (e) { sendError(res, 500, e); }
});

router.patch('/departments/:id', async (req, res) => {
  const { dept_name, dept_type, parent_id } = req.body;
  try {
    const dept = await svc.updateDepartment(req.params.id, { dept_name, dept_type, parent_id });
    if (!dept) return res.status(404).json({ error: 'ไม่พบ Department' });
    res.json(dept);
  } catch (e) { sendError(res, 500, e); }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    const dept = await svc.deleteDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'ไม่พบ Department' });
    res.json({ success: true });
  } catch (e) {
    if (e.code === '23503') return res.status(409).json({ error: 'ไม่สามารถลบได้ เพราะมีผู้ใช้ที่ใช้ Scope นี้อยู่' });
    sendError(res, 500, e);
  }
});

// ── Audit Logs ────────────────────────────────────────────────
router.get('/audit-logs', async (req, res) => {
  const { page = '1', limit = '30' } = req.query;
  try { res.json(await svc.listAuditLogs({ page: +page, limit: +limit })); }
  catch (e) { sendError(res, 500, e); }
});

module.exports = router;
