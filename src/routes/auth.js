'use strict';
const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const config = require('../config');
const { isGroupMember } = require('../services/googleGroup');
const { upsertUser, getUserPermission, getAppByName } = require('../services/permissions');
const { signToken } = require('../services/jwt');
const { escapeHtml, isValidRedirectUri } = require('../utils/security');

const router = express.Router();

// ========================================================
// ตั้งค่า Passport — Google OAuth 2.0 Strategy
// ========================================================
passport.use(new GoogleStrategy(
  {
    clientID:     config.google.clientId,
    clientSecret: config.google.clientSecret,
    callbackURL:  config.google.callbackUrl,
  },
  // Verify callback — ทำงานหลัง Google ยืนยัน identity สำเร็จ
  async (accessToken, refreshToken, profile, done) => {
    // เก็บเฉพาะข้อมูลที่จำเป็น
    const user = {
      googleId: profile.id,
      email:    profile.emails?.[0]?.value,
      name:     profile.displayName,
    };
    return done(null, user);
  }
));

// Serialize/Deserialize สำหรับ session (เก็บแค่ข้อมูลน้อยที่สุด)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ========================================================
// Helper: สร้างหน้า HTML error แบบ inline (dark glassmorphism — เข้าชุดกับหน้าแรก)
// ========================================================
const ERROR_ICONS = {
  // ไม่มีสิทธิ์ / ยืนยันตัวตนไม่ผ่าน (401, 403) — กุญแจล็อก สีแดง-ส้ม
  denied: {
    grad: ['#ef4444', '#f97316'], glow: 'rgba(239,68,68,.35)',
    svg: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  },
  // ระบบขัดข้องฝั่ง server (500) — แปดเหลี่ยม สีแดงเข้ม
  error: {
    grad: ['#dc2626', '#b91c1c'], glow: 'rgba(220,38,38,.4)',
    svg: '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  },
  // ค่าที่ส่งมาไม่ถูกต้อง / ไม่พบข้อมูล (400, 404) — สามเหลี่ยมเตือน สีน้ำเงิน-ม่วง
  warning: {
    grad: ['#6366f1', '#3b82f6'], glow: 'rgba(99,102,241,.35)',
    svg: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  },
};

function renderError(res, statusCode, title, message, detail = '') {
  // escape ทุกค่าก่อนแทรกใน HTML ป้องกัน XSS — title/message มาจาก code คงที่
  // แต่ detail มักมีค่าจาก user input (เช่น app_id, email) จึงต้อง escape เสมอ
  const safeTitle   = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeDetail  = escapeHtml(detail);

  const variant = (statusCode === 401 || statusCode === 403) ? ERROR_ICONS.denied
                : (statusCode === 500) ? ERROR_ICONS.error
                : ERROR_ICONS.warning;

  res.status(statusCode).send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${safeTitle} — NBU SSO</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Inter:wght@600;700;800&display=swap" rel="stylesheet">
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Sarabun', 'Inter', sans-serif;
          background: #060b18; color: #f1f5f9;
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 24px; position: relative; overflow: hidden;
        }
        .ambient {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 700px 500px at 15% 10%, ${variant.glow} 0%, transparent 70%),
            radial-gradient(ellipse 600px 500px at 85% 90%, rgba(59,130,246,.10) 0%, transparent 70%);
        }
        .grid-bg {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 100% 100% at 50% 30%, black 30%, transparent 100%);
        }
        .card {
          position: relative; z-index: 1;
          background: rgba(255,255,255,.04); backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255,255,255,.1); border-radius: 20px;
          padding: 44px 36px; max-width: 440px; width: 100%; text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,.5);
          animation: rise .5s cubic-bezier(.16,1,.3,1);
        }
        @keyframes rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .icon-badge {
          width: 64px; height: 64px; border-radius: 18px; margin: 0 auto 24px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, ${variant.grad[0]}, ${variant.grad[1]});
          box-shadow: 0 0 30px ${variant.glow};
        }
        h1 { font-family: 'Inter', sans-serif; font-size: 21px; font-weight: 700; letter-spacing: -.3px; margin-bottom: 10px; }
        p { color: #94a3b8; font-size: 14.5px; line-height: 1.65; }
        .detail {
          margin-top: 18px; font-size: 12.5px; color: #64748b;
          background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.1);
          border-radius: 10px; padding: 12px 14px; word-break: break-word; text-align: left;
        }
        .btn {
          display: inline-flex; align-items: center; gap: 6px; margin-top: 30px;
          padding: 11px 26px; background: rgba(255,255,255,.06); color: #f1f5f9;
          border: 1px solid rgba(255,255,255,.1); border-radius: 10px; text-decoration: none;
          font-size: 13.5px; font-weight: 600; transition: background .2s, border-color .2s;
        }
        .btn:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.2); }
        .footer { margin-top: 28px; font-size: 11px; color: #475569; letter-spacing: .5px; }
      </style>
    </head>
    <body>
      <div class="ambient"></div>
      <div class="grid-bg"></div>
      <div class="card">
        <div class="icon-badge">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${variant.svg}</svg>
        </div>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
        ${safeDetail ? `<div class="detail">${safeDetail}</div>` : ''}
        <a href="javascript:history.back()" class="btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          ย้อนกลับ
        </a>
        <div class="footer">NORTH BANGKOK UNIVERSITY — CENTRALIZED SSO</div>
      </div>
    </body>
    </html>
  `);
}

// ========================================================
// GET /login?app_id=xxx&redirect_uri=https://...
// จุดเริ่มต้น: แอปย่อย redirect มาที่นี่
// ========================================================
router.get('/login', async (req, res) => {
  const { app_id, redirect_uri } = req.query;

  if (!app_id) {
    return renderError(res, 400, 'ไม่ระบุ Application', 'ต้องส่ง app_id มาด้วยครับ');
  }
  if (!redirect_uri) {
    return renderError(res, 400, 'ไม่ระบุ Redirect URI', 'ต้องส่ง redirect_uri มาด้วยครับ');
  }

  // ---- ป้องกัน Open Redirect: ตรวจ app_id มีจริง + redirect_uri ต้องอยู่ใน allowlist ----
  let app;
  try {
    app = await getAppByName(app_id);
  } catch (err) {
    console.error('[Auth] ❌ Error looking up app:', err);
    return renderError(res, 500, 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง');
  }
  if (!app) {
    return renderError(res, 404, 'ไม่พบ Application',
      `ไม่พบ Application "${app_id}" ในระบบ กรุณาติดต่อผู้ดูแลระบบ`);
  }
  if (!isValidRedirectUri(redirect_uri, app.callback_urls)) {
    // ไม่แสดงรายละเอียดทางเทคนิค (redirect_uri/app_id) ให้ผู้ใช้ทั่วไปเห็น — log ไว้ฝั่ง server แทน
    console.warn(`[Auth] ⚠️ Redirect URI ไม่ได้รับอนุญาต: "${redirect_uri}" (app_id: ${app_id})`);
    return renderError(res, 403, 'ไม่มีสิทธิ์ใช้งาน', 'คุณไม่มีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  }

  // เก็บ app_id และ redirect_uri ไว้ใน session ก่อน redirect ไป Google
  req.session.sso_app_id = app_id;
  req.session.sso_redirect_uri = redirect_uri;

  // Redirect ไป Google OAuth
  res.redirect('/auth/google');
});

// ========================================================
// GET /auth/google — เริ่มต้น Google OAuth flow
// ========================================================
router.get('/auth/google',
  passport.authenticate('google', {
    scope: ['openid', 'email', 'profile'],
    hd: 'northbkk.ac.th',
  })
);

// ========================================================
// GET /auth/google/callback — Google ส่ง user กลับมา
// ========================================================
router.get('/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/error' }),
  async (req, res) => {
    const googleUser = req.user;  // { googleId, email, name }
    const appId    = req.session.sso_app_id;
    const redirectUri = req.session.sso_redirect_uri;

    // ---- Validate session data ----
    if (!appId || !redirectUri) {
      return renderError(res, 400, 'Session หมดอายุ',
        'กรุณาเริ่มต้นการเข้าสู่ระบบใหม่อีกครั้งจากแอปพลิเคชัน');
    }

    try {
      // ---- Step 1: ตรวจสอบ Google Group ----
      const isMember = await isGroupMember(googleUser.email);
      if (!isMember) {
        return renderError(res, 403, 'ไม่มีสิทธิ์เข้าใช้งาน',
          'บัญชีของท่านไม่ได้รับอนุญาตให้เข้าใช้ระบบนี้',
          `อีเมล: ${googleUser.email} — ระบบนี้สำหรับบุคลากรของมหาวิทยาลัยเท่านั้น`);
      }

      // ---- Step 2: ค้นหาแอปใน DB ----
      const app = await getAppByName(appId);
      if (!app) {
        return renderError(res, 404, 'ไม่พบ Application',
          `ไม่พบ Application "${appId}" ในระบบ กรุณาติดต่อผู้ดูแลระบบ`);
      }

      // ---- Step 3: Upsert user ใน DB ----
      const user = await upsertUser(googleUser.email, googleUser.name);
      if (!user.is_active) {
        return renderError(res, 403, 'บัญชีถูกระงับ',
          'บัญชีของท่านถูกระงับการใช้งาน กรุณาติดต่อสำนักเทคโนโลยีสารสนเทศ');
      }

      // ---- Step 4: ดึงสิทธิ์ 2 แกนจาก DB ----
      const permission = await getUserPermission(user.id, app.id);
      if (!permission) {
        return renderError(res, 403, 'ไม่มีสิทธิ์ใน Application นี้',
          `ท่านไม่มีสิทธิ์เข้าใช้งาน "${app.app_name}" กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์`,
          `อีเมล: ${user.email}`);
      }

      // ---- Step 5: สร้าง JWT Payload ตาม spec ----
      const jwtPayload = {
        sub:            String(user.id),
        email:          user.email,
        name:           user.name,
        application_id: app.app_name,
        permission: {
          role:              permission.role_key,
          scope_level:       permission.scope_level,   // FACULTY / BRANCH / OFFICE
          allowed_dept_id:   permission.scope_dept_id,
          allowed_dept_name: permission.allowed_dept_name,
        },
      };

      // ---- Step 6: เซ็น JWT ----
      const token = signToken(jwtPayload);

      // ---- Step 7: ล้าง session SSO แล้ว redirect กลับแอปย่อย ----
      delete req.session.sso_app_id;
      delete req.session.sso_redirect_uri;

      // เติม https:// ถ้า redirect_uri ไม่มี protocol นำหน้า
      let finalRedirectUri = redirectUri;
      if (!/^https?:\/\//i.test(finalRedirectUri)) {
        finalRedirectUri = 'https://' + finalRedirectUri;
      }

      const callbackUrl = new URL(finalRedirectUri);
      callbackUrl.searchParams.set('token', token);

      console.log(`[Auth] ✅ Login สำเร็จ: ${user.email} → ${app.app_name} (${permission.role_key})`);
      return res.redirect(callbackUrl.toString());

    } catch (err) {
      console.error('[Auth] ❌ Error during callback:', err);
      return renderError(res, 500, 'เกิดข้อผิดพลาด',
        'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง',
        config.isDev ? err.message : '');  // แสดง detail เฉพาะ dev เท่านั้น
    }
  }
);

// ---- Error fallback ----
router.get('/auth/error', (req, res) => {
  renderError(res, 401, 'การยืนยันตัวตนล้มเหลว',
    'ไม่สามารถยืนยันตัวตนกับ Google ได้ กรุณาลองใหม่อีกครั้ง');
});

module.exports = router;
module.exports.passport = passport;
