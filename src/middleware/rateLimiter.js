'use strict';
const rateLimit = require('express-rate-limit');

/**
 * จำกัด request ที่ /login และ /auth/*
 * ป้องกัน brute-force, bot scan, และการยิง Google OAuth ถี่เกินไป
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 นาที
  max: 20,                    // สูงสุด 20 ครั้งต่อ IP ต่อ window
  standardHeaders: true,      // ส่ง RateLimit-* headers กลับ
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'พยายาม Login บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' },
  handler: (req, res, _next, options) => {
    console.warn(`[RateLimit] บล็อก IP: ${req.ip} ที่ ${req.path}`);
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = { loginLimiter };
