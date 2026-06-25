'use strict';
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const session    = require('express-session');
const pgSession  = require('connect-pg-simple')(session);
const config     = require('./config');
const { pool }   = require('./db');
const authRouter = require('./routes/auth');
const apiRouter  = require('./routes/api');
const { passport } = require('./routes/auth');

const app = express();

// ======================================================
// Trust Proxy (สำคัญมากสำหรับ Cloud Run เพื่อให้ Secure Cookie ทำงาน)
// ======================================================
app.set('trust proxy', 1);

// ======================================================
// Security Headers
// ======================================================
app.use(helmet());

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
// Routes
// ======================================================
app.use('/', authRouter);
app.use('/api/v1', apiRouter);

// ======================================================
// 404 Handler
// ======================================================
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', path: req.path });
});

// ======================================================
// Global Error Handler
// ======================================================
app.use((err, req, res, _next) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).json({
    error:   'INTERNAL_ERROR',
    message: config.isDev ? err.message : 'เกิดข้อผิดพลาดภายในระบบ',
  });
});

module.exports = app;
