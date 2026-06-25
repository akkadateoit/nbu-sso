'use strict';
const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const config = require('../config');
const { isGroupMember } = require('../services/googleGroup');
const { upsertUser, getUserPermission, getAppByName } = require('../services/permissions');
const { signToken } = require('../services/jwt');

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
// Helper: สร้างหน้า HTML error แบบ inline
// ========================================================
function renderError(res, statusCode, title, message, detail = '') {
  res.status(statusCode).send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} — NBU SSO</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .icon { font-size: 56px; margin-bottom: 24px; }
        h1 { color: #1a1a2e; font-size: 22px; margin-bottom: 12px; }
        p { color: #555; font-size: 15px; line-height: 1.6; }
        .detail { margin-top: 16px; font-size: 13px; color: #999; background: #f8f8f8; border-radius: 8px; padding: 12px; }
        .btn { display: inline-block; margin-top: 28px; padding: 12px 28px; background: #1a73e8; color: white; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }
        .logo { font-size: 13px; color: #aaa; margin-top: 32px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🔒</div>
        <h1>${title}</h1>
        <p>${message}</p>
        ${detail ? `<div class="detail">${detail}</div>` : ''}
        <a href="javascript:history.back()" class="btn">← ย้อนกลับ</a>
        <div class="logo">North Bangkok University — Centralized SSO</div>
      </div>
    </body>
    </html>
  `);
}

// ========================================================
// GET /login?app_id=xxx&redirect_uri=https://...
// จุดเริ่มต้น: แอปย่อย redirect มาที่นี่
// ========================================================
router.get('/login', (req, res) => {
  const { app_id, redirect_uri } = req.query;

  if (!app_id) {
    return renderError(res, 400, 'ไม่ระบุ Application', 'ต้องส่ง app_id มาด้วยครับ');
  }
  if (!redirect_uri) {
    return renderError(res, 400, 'ไม่ระบุ Redirect URI', 'ต้องส่ง redirect_uri มาด้วยครับ');
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
    prompt: 'select_account',  // บังคับให้เลือก account ทุกครั้ง
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
        err.message);  // แสดง error detail เพื่อ debug
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
