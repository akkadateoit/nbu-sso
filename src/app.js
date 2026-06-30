'use strict';
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const session    = require('express-session');
const pgSession  = require('connect-pg-simple')(session);
const config     = require('./config');
const { pool }   = require('./db');
const authRouter  = require('./routes/auth');
const apiRouter   = require('./routes/api');
const adminRouter = require('./routes/adminApi');
const { passport } = require('./routes/auth');
const { loginLimiter } = require('./middleware/rateLimiter');

const app = express();

// ======================================================
// Trust Proxy (สำคัญมากสำหรับ Cloud Run เพื่อให้ Secure Cookie ทำงาน)
// ======================================================
app.set('trust proxy', 1);

// ======================================================
// Security Headers
// ======================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", 'static.cloudflareinsights.com'],
      scriptSrcAttr: ["'none'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      connectSrc:  ["'self'", 'https://cloudflareinsights.com'],
      imgSrc:      ["'self'", 'data:'],
    },
  },
}));

// ======================================================
// CORS — อนุญาต Sub-Apps ที่จะเรียก /api/*
// ======================================================
app.use(cors({
  origin: true,       // ในการใช้งานจริงให้ระบุ origins ที่อนุญาต
  methods: ['GET', 'POST'],
  credentials: true,
}));

// ======================================================
// Body Parser
// ======================================================
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ======================================================
// Session — เก็บใน PostgreSQL (Supabase) เพื่อรองรับ Cloud Run
// ======================================================
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'sso_sessions',
    createTableIfMissing: true,   // สร้างตาราง session อัตโนมัติ
  }),
  secret:            config.sessionSecret,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   !config.isDev,    // HTTPS only ใน production
    httpOnly: true,
    maxAge:   15 * 60 * 1000,   // 15 นาที (สำหรับ OAuth dance เท่านั้น)
    sameSite: 'lax',
  },
  name: 'nbu.sso.sid',
}));

// ======================================================
// Passport (ใช้แค่ initial validate ใน callback route)
// ======================================================
app.use(passport.initialize());

// ======================================================
// Static files — landing page assets (/sso.js ฯลฯ)
// วางไว้ก่อน Routes เพื่อให้ไฟล์ใน public/ ถูก serve ได้
// ======================================================
app.use(express.static(require('path').join(__dirname, 'public')));

// ======================================================
// Routes
// ======================================================
app.get('/demouser', (_req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'demouser.html'));
});
app.get('/demouser2', (_req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'demouser2.html'));
});
app.get('/demouser3', (_req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'demouser3.html'));
});
app.use('/login', loginLimiter);
app.use('/auth', loginLimiter);
app.use('/', authRouter);
app.use('/api/v1', apiRouter);
app.use('/api/v1/admin', adminRouter);

// ======================================================
// Admin UI — serve React build from admin-ui/dist/
// SPA fallback: ทุก path ใต้ /admin/* → index.html
// ======================================================
const adminDistPath = require('path').join(__dirname, '..', 'admin-ui', 'dist');
app.use('/admin', require('express').static(adminDistPath));
app.get('/admin/*', (_req, res) => {
  res.sendFile(require('path').join(adminDistPath, 'index.html'));
});

// ======================================================
// 404 Handler
// ======================================================
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', path: req.path });
});

// ======================================================
// Global Error Handler
// ======================================================
app.use((err, _req, res, _next) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).json({
    error:   'INTERNAL_ERROR',
    message: config.isDev ? err.message : 'เกิดข้อผิดพลาดภายในระบบ',
  });
});

module.exports = app;
