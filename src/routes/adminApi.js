'use strict';
const express      = require('express');
const { verifyToken } = require('../services/jwt');
const svc          = require('../services/adminService');

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
    res.status(500).json({ error: e.message });
  }
});

// ── Apps ──────────────────────────────────────────────────────
router.get('/apps', async (req, res) => {
  try {
    res.json(await svc.listApps());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/apps', async (req, res) => {
  const { app_name, description } = req.body;
  if (!app_name) return res.status(400).json({ error: 'app_name is required' });
  if (!/^[a-z0-9-]+$/.test(app_name))
    return res.status(400).json({ error: 'app_name ใช้ได้เฉพาะตัวพิมพ์เล็ก ตัวเลข และ -' });
  try {
    const app = await svc.createApp(app_name, description || '');
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: 'CREATE_APP', appName: app_name, detail: { description },
    });
    res.status(201).json(app);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'App ID นี้มีอยู่แล้ว' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/apps/:id', async (req, res) => {
  const { description, is_active } = req.body;
  try {
    const app = await svc.updateApp(req.params.id, { description, is_active });
    if (!app) return res.status(404).json({ error: 'ไม่พบ App' });
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: is_active === false ? 'DISABLE_APP' : 'UPDATE_APP',
      appName: app.app_name, detail: { is_active, description },
    });
    res.json(app);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Users ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  const { search = '', page = '1', limit = '20' } = req.query;
  try {
    res.json(await svc.listUsers({ search, page: +page, limit: +limit }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/users/:id/permissions', async (req, res) => {
  try {
    res.json(await svc.getUserPermissions(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
});

router.patch('/permissions/:id', async (req, res) => {
  const { role_key } = req.body;
  if (!role_key) return res.status(400).json({ error: 'ต้องส่ง role_key' });
  try {
    const perm = await svc.updatePermission(req.params.id, role_key);
    if (!perm) return res.status(404).json({ error: 'ไม่พบ Permission' });
    await svc.writeAuditLog({
      actedById: req.adminUser.sub, actedByEmail: req.adminUser.email,
      action: 'UPDATE', detail: { permission_id: req.params.id, role_key },
    });
    res.json(perm);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
});

// ── Master Data ───────────────────────────────────────────────
router.get('/departments', async (req, res) => {
  try { res.json(await svc.listDepartments()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/roles', async (req, res) => {
  try { res.json(await svc.listRoles()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Audit Logs ────────────────────────────────────────────────
router.get('/audit-logs', async (req, res) => {
  const { page = '1', limit = '30' } = req.query;
  try { res.json(await svc.listAuditLogs({ page: +page, limit: +limit })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
