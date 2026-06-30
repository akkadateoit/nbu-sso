'use strict';
const rateLimit = require('express-rate-limit');

function renderRateLimitPage(res) {
  res.status(429).type('html').send(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ลองใหม่อีกครั้ง — NBU SSO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Inter:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #060b18; --card: rgba(255,255,255,.05);
      --border: rgba(255,255,255,.1); --text: #f1f5f9;
      --muted: #94a3b8; --amber: #f59e0b;
    }
    body {
      font-family: 'Sarabun', sans-serif; background: var(--bg); color: var(--text);
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 24px; overflow: hidden;
    }
    .ambient {
      position: fixed; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse 700px 500px at 50% 30%, rgba(245,158,11,.1) 0%, transparent 70%);
    }
    .card {
      position: relative; z-index: 1; max-width: 420px; width: 100%;
      text-align: center; border: 1px solid var(--border); border-radius: 24px;
      background: var(--card); backdrop-filter: blur(16px); padding: 44px 32px;
    }
    .icon-wrap { position: relative; margin: 0 auto 28px; width: 76px; height: 76px; }
    .icon-glow {
      position: absolute; inset: -16px; border-radius: 50%;
      background: radial-gradient(circle, rgba(245,158,11,.3) 0%, transparent 70%);
      animation: pulse 2.5s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100%{opacity:.6;transform:scale(1);} 50%{opacity:1;transform:scale(1.1);} }
    .icon {
      position: relative; width: 76px; height: 76px; border-radius: 22px;
      background: linear-gradient(135deg, rgba(245,158,11,.2), rgba(249,115,22,.2));
      border: 1px solid rgba(245,158,11,.4);
      display: flex; align-items: center; justify-content: center;
    }
    h1 { font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 12px; letter-spacing: -.3px; }
    p { font-size: 14px; color: var(--muted); line-height: 1.7; margin-bottom: 8px; }
    .countdown {
      display: inline-flex; align-items: center; gap: 8px; margin-top: 20px;
      border: 1px solid rgba(245,158,11,.3); border-radius: 999px;
      background: rgba(245,158,11,.08); padding: 8px 18px;
      font-family: 'Inter', monospace; font-size: 13px; font-weight: 700; color: var(--amber);
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--amber); animation: blink 1.2s ease infinite; }
    @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:.3;} }
    footer { margin-top: 28px; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="ambient"></div>
  <div class="card">
    <div class="icon-wrap">
      <div class="icon-glow"></div>
      <div class="icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
    </div>
    <h1>พยายามเข้าสู่ระบบบ่อยเกินไป</h1>
    <p>เพื่อความปลอดภัยของระบบ กรุณารอสักครู่</p>
    <p>แล้วลองเข้าสู่ระบบอีกครั้ง</p>
    <div class="countdown">
      <span class="dot"></span>
      <span id="timer">รอประมาณ 10-15 วินาที</span>
    </div>
    <footer>North Bangkok University — Centralized SSO</footer>
  </div>
</body>
</html>
  `);
}

/**
 * จำกัด request ที่ /login และ /auth/*
 * ป้องกัน brute-force, bot scan, และการยิง Google OAuth ถี่เกินไป
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 นาที
  max: 20,                    // สูงสุด 20 ครั้งต่อ IP ต่อ window
  standardHeaders: true,      // ส่ง RateLimit-* headers กลับ
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RateLimit] บล็อก IP: ${req.ip} ที่ ${req.path}`);
    renderRateLimitPage(res);
  },
});

module.exports = { loginLimiter };
