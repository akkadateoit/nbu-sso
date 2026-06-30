# NBU SSO — Project Memory (สำหรับ AI อ่านเพื่อพัฒนาต่อ)

> อัปเดตล่าสุด: 2026-06-30
> สถานะ: **✅ Production — ผ่าน Security Review และ Hardening แล้ว**

---

## 0. อ่านไฟล์ไหนก่อน?

```
PROJECT_MEMORY.md (ไฟล์นี้)     → ภาพรวม Infrastructure + สถานะปัจจุบันของ SSO Server เอง
1_SSO_STARTER.md               → คู่มือเริ่มต้นสำหรับสร้าง "แอปย่อยใหม่" ที่เชื่อม SSO
2_FOR_AI_NEW_APP.md             → Checklist 21 ข้อ + code ตัวอย่างหลาย Tech Stack
3_SSO_INTEGRATION_GUIDE.md      → Spec ทางการ (2-Axis Authorization)
```

**ถ้าจะแก้ไข/พัฒนา SSO Server เอง** → อ่านไฟล์นี้ต่อ
**ถ้าจะสร้างแอปย่อยใหม่ที่ใช้ SSO** → ข้ามไปอ่าน `1_SSO_STARTER.md` และ `2_FOR_AI_NEW_APP.md`

---

## 1. โปรเจกต์นี้คืออะไร

ระบบ **Single Sign-On (SSO)** ของมหาวิทยาลัยนอร์ทกรุงเทพ (North Bangkok University)
ให้บุคลากรล็อกอินครั้งเดียวด้วย **Google Workspace Account (@northbkk.ac.th)** แล้วเข้าใช้ได้ทุกระบบย่อยของมหาวิทยาลัย

### Flow หลัก

```
แอปย่อย → Redirect ไป SSO Server พร้อม app_id & redirect_uri
         → SSO ตรวจ app_id มีจริง + redirect_uri อยู่ใน callback_urls allowlist
         → SSO Redirect ไป Google Login (hd=northbkk.ac.th กรอง account)
         → Google ส่ง Code กลับมาที่ SSO Callback
         → SSO ตรวจ Google Group (ว่าเป็นบุคลากรไหม)
         → SSO ตรวจสิทธิ์ใน Database (Role + Dept)
         → SSO ออก JWT Token (RS256)
         → Redirect กลับแอปย่อยพร้อม ?token=eyJ...
         → แอปย่อยเอา Token ไปเช็คที่ /api/v1/validate-token หรือ decode เอง
```

---

## 2. Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Backend | Node.js (v20), Express.js |
| Auth | passport-google-oauth20 |
| JWT | jsonwebtoken (RS256 — RSA Key Pair) |
| Session Storage | connect-pg-simple → Supabase PostgreSQL |
| Database | Supabase (PostgreSQL) — Free Tier |
| Hosting | Google Cloud Run (**asia-southeast1** — Singapore) |
| CDN / Proxy | Cloudflare (Proxied, WAF, Rate Limiting Rules) |
| Admin UI | React 19 + Vite + Tailwind v4 + shadcn-style components |
| CI/CD | GitHub → Cloud Build (auto deploy on push to `main`) |
| Container | Docker — 3-stage build (admin-ui → backend deps → production) |

---

## 3. โครงสร้างไฟล์สำคัญ

```
d:\coding\nbu-sso\
├── src/
│   ├── app.js                  ← Express config: helmet CSP, CORS, session, rate limit, routes
│   ├── index.js                ← Server entry point (PORT จาก env)
│   ├── config/index.js         ← โหลด ENV vars ทั้งหมด, loadKey() function
│   ├── db/index.js             ← PostgreSQL pool (SSL เปิดเสมอ, max 10 connections)
│   ├── middleware/
│   │   └── rateLimiter.js      ← Express rate limit /login,/auth (20 req/15min) + HTML 429 page
│   ├── utils/
│   │   └── security.js         ← escapeHtml(), sendError(), isValidRedirectUri()
│   ├── routes/
│   │   ├── auth.js             ← Google OAuth flow, JWT issuance, Open Redirect protection
│   │   ├── api.js               ← /health, /public-key, /validate-token (public endpoints)
│   │   └── adminApi.js         ← /api/v1/admin/* — ต้องเป็น ADMIN ของ sso-admin เท่านั้น
│   ├── services/
│   │   ├── jwt.js              ← signToken(), verifyToken() (RS256)
│   │   ├── googleGroup.js      ← isGroupMember() ตรวจ Google Workspace Group
│   │   ├── permissions.js      ← upsertUser(), getUserPermission(), getAppByName()
│   │   └── adminService.js     ← CRUD ทั้งหมดสำหรับ Admin Dashboard (apps/users/roles/depts/audit)
│   └── public/                 ← Static pages (ไม่ผ่าน build, serve ตรงจาก express.static)
│       ├── index.html / sso.js          ← หน้าแรก (dark theme, live status)
│       ├── demouser.html / .js          ← Demo: ปุ่ม Login (manual pattern)
│       ├── demouser2.html / .js         ← Demo: Auto-redirect (logout flag pattern)
│       └── demouser3.html / .js         ← Demo: Auto-redirect (theme ต่าง, app_id=demo3)
├── admin-ui/                   ← React Admin Dashboard (build → admin-ui/dist/ → serve ที่ /admin)
│   └── src/
│       ├── pages/               ← Dashboard, Apps, Users, MasterData (Roles+Scope), AuditLog
│       ├── components/Layout.jsx, components/ui/*  ← Sidebar, Dialog, Button ฯลฯ
│       └── lib/api.js, lib/auth.js      ← axios + localStorage token (เฉพาะ admin)
├── scripts/
│   ├── migrate.js                       ← สร้างตาราง DB หลัก (idempotent)
│   ├── migrate-admin.sql                ← audit_logs, apps.is_active, seed sso-admin/demo*
│   └── migrate-callback-urls.sql        ← apps.callback_urls (Open Redirect fix)
├── secrets/                    ← *** ไม่ commit ขึ้น Git ***
├── docs/                       ← เอกสารทั้งหมด (ไฟล์นี้ + starter guides)
├── cloudbuild.yaml              ← Cloud Build → deploy asia-southeast1
├── Dockerfile                   ← 3-stage: admin-ui build → backend deps → production image
└── package.json
```

---

## 4. Database Schema (Supabase)

### ตาราง `apps`
```sql
id, app_name (UNIQUE), app_secret, description, is_active,
callback_urls TEXT[],   -- ⚠️ บังคับมีอย่างน้อย 1 URL ไม่งั้น Login ถูกบล็อกทั้งหมด
created_at
```

### ตาราง `users`
```sql
id, email (UNIQUE), name, is_active, created_at
```

### ตาราง `departments`
```sql
id, dept_name, dept_type (UNIVERSITY|FACULTY|BRANCH|OFFICE), parent_id, created_at
```
ข้อมูลที่มีอยู่: 100=มหาวิทยาลัย(UNIVERSITY), 101=คณะ IT, 102=คณะบริหารธุรกิจ (FACULTY),
201=สาขาวิทยาการคอมพิวเตอร์, 202=สาขาเทคโนโลยีสารสนเทศ (BRANCH)

### ตาราง `roles`
```sql
role_key (PK), role_name, description
-- ค่าเริ่มต้น: ADMIN, DEAN, DIRECTOR, CHAIR, LECTURER, STAFF
```

### ตาราง `user_app_permissions`
```sql
id, user_id→users, app_id→apps, role_key→roles, scope_dept_id→departments, assigned_at
UNIQUE (user_id, app_id, scope_dept_id)
```
"2-axis permission": Role (ทำอะไรได้) × Scope (ข้อมูลของใคร)

### ตาราง `audit_logs`
```sql
id, acted_by_id, acted_by_email, action, target_email, app_name, detail JSONB, created_at
-- action: GRANT/REVOKE/UPDATE/CREATE_APP/DISABLE_APP/CREATE_USER/DELETE_USER/...
-- ตั้ง pg_cron ลบ logs เกิน 30 วันอัตโนมัติ (รันทุกวันที่ 1 ของเดือน)
```

### ตาราง `sso_sessions` (auto-created โดย connect-pg-simple)

---

## 5. Environment Variables

### Local Development (.env)
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./secrets/service-account.json
GOOGLE_WORKSPACE_ADMIN_EMAIL=akkadate.si@northbkk.ac.th
ALLOWED_GOOGLE_GROUP=sso-staff-group@northbkk.ac.th
# ✅ ใส่ nested group ได้ (เช่น เอา nbu.staff@northbkk.ac.th ทั้งกลุ่มมาเป็นสมาชิกของ
# sso-staff-group@ อีกที) เพราะ googleGroup.js ใช้ admin.members.hasMember() ซึ่ง
# เช็คทั้ง direct + nested member ในการเรียก API ครั้งเดียว — ไม่ต้องเพิ่มทีละคน

APP_PORT=3000
NODE_ENV=development
SKIP_GROUP_CHECK=true   # เปิดตอน dev เท่านั้น

JWT_PRIVATE_KEY_PATH=./secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=./secrets/jwt_public.pem
JWT_EXPIRES_IN=8h

DATABASE_URL=...   # Supabase Transaction Pooler (port 6543)
SESSION_SECRET=...  # random 64 hex chars
```

### Cloud Run (Production) — ต่างจาก local ตรงนี้
- `GOOGLE_CALLBACK_URL` → `https://sso.northbkk.ac.th/auth/google/callback`
- `NODE_ENV=production`, ไม่มี `SKIP_GROUP_CHECK` (หรือ `false`)
- ใช้ `JWT_PRIVATE_KEY_RAW` / `JWT_PUBLIC_KEY_RAW` (เนื้อหา .pem ที่ `\n` เป็น literal) แทนไฟล์
- `GOOGLE_SERVICE_ACCOUNT_RAW_JSON` แทนไฟล์ service-account.json

---

## 6. Infrastructure & Deployment

```
Production URL:    https://sso.northbkk.ac.th
Cloud Run URL:      https://nbu-sso-459706050098.asia-southeast1.run.app
Project ID:         nbu-sso-500507
Region:              asia-southeast1 (Singapore — ย้ายจาก europe-west1 แล้ว)
GitHub Repo:         https://github.com/akkadateoit/nbu-sso
CI/CD:               Push ไป main → cloudbuild.yaml → Cloud Build → Cloud Run
DNS/CDN:             Cloudflare (Proxied 🟠) — ไม่ใช่ DNS Only
```

### สิ่งสำคัญที่เรียนรู้จากการ Deploy/Infra

1. **`app.set('trust proxy', 1)`** จำเป็นสำหรับ Secure Cookie บน Cloud Run
2. **asia-southeast3 (Bangkok) ไม่รองรับ Cloud Run Domain Mapping** — ใช้ asia-southeast1 (Singapore) แทน latency ใกล้เคียงกัน
3. **Artifact Registry ต้องสร้างเอง** ในแต่ละ region ก่อน deploy ครั้งแรก (`cloud-run-source-deploy` repo)
4. **Cloud Build ต้อง deploy สำเร็จอย่างน้อย 1 ครั้งพร้อม Env Vars ครบ** ก่อน revision ใหม่ๆ จะ inherit env vars ได้ — ถ้า service ใหม่ไม่มี revision ที่รันได้เลย จะไม่มีอะไรให้ inherit
5. **Cloudflare Custom Rules (WAF) ทำงานก่อน Rate Limiting Rules เสมอ** — ถ้ามี rule "Skip" ครอบคลุม IP บางช่วง (เช่น IP มหาวิทยาลัย) อาจ skip ไปถึง Rate Limiting ด้วยถ้าไม่ exclude path ที่ต้องการป้องกันออกมา
6. **`ip.src` ใน Rate Limiting Rules ต้องการ Cloudflare แผน Advanced Rate Limiting (Business+)** — แผน Free/Pro ใช้ field นี้ใน Rate Limiting ไม่ได้ (แต่ใช้ใน Custom Rules ปกติได้)
7. **Helmet CSP บล็อก 3 อย่างที่ HTML แบบ static มักใช้:**
   - `<script>` inline block → ต้องย้ายเป็นไฟล์ `.js` แยก
   - `onclick="..."` ในแท็บ → ต้องใช้ `addEventListener()`
   - `<style>` inline → ต้องเปิด `'unsafe-inline'` ใน `styleSrc` (CSS ปลอดภัยกว่า script จึงเปิดได้)

---

## 7. Security — สิ่งที่ทำไว้แล้ว (Security Review 2026-06-30)

```
✅ Open Redirect Protection — callback_urls allowlist ต่อแอป, validate origin ก่อน issue token
✅ Reflected XSS Protection — escapeHtml() ทุกค่า user-controlled ก่อนแทรกใน renderError()
✅ Error message ไม่ leak ใน production — sendError() เช็ค config.isDev เสมอ
✅ SQL Injection — parameterized query ($1,$2) ทุกจุด ไม่มี string concat
✅ Rate Limiting 2 ชั้น:
     - Cloudflare Edge: 5 req/10s ต่อ IP (block 10s) ที่ path /login
     - Express (backup): 20 req/15min ต่อ IP
✅ hd=northbkk.ac.th — กรอง Google account picker ตั้งแต่ต้นทาง (กัน admin เผลอใช้ Gmail ส่วนตัว)
✅ Google Group double-check — กรองนักศึกษา/บุคคลภายนอกอีกชั้นหลัง Google OAuth
✅ Cookie: httpOnly + secure + sameSite=lax
✅ Docker: non-root user, multi-stage build, secrets ไม่ copy เข้า image
✅ Audit Log ครบทุก action สำคัญใน Admin Dashboard
```

### ยังไม่ได้ทำ (Backlog — ไม่เร่งด่วน)
```
□ CORS allowlist เฉพาะ origin (ตอนนี้ origin:true เปิดกว้าง — ชดเชยด้วย JWT-only auth,
   ห้าม endpoint ใหม่พึ่ง session/cookie เด็ดขาด ดู 1_SSO_STARTER.md ข้อ 5)
□ Token Revocation / Refresh Token + Access Token อายุสั้น (Phase 2 ตามแผนเดิม)
□ JWKS endpoint (/.well-known/jwks.json) — ถ้าต้องการ Key Rotation ในอนาคต
□ npm audit: 4 moderate vulnerabilities จาก googleapis (ต้อง major upgrade 144→173)
```

---

## 8. Admin Dashboard (`/admin`)

```
Login:  ผ่าน SSO เอง ด้วย app_id="sso-admin", role ต้องเป็น ADMIN เท่านั้น
Token:  เก็บใน localStorage (nbu_admin_token) — ความเสี่ยง XSS ชดเชยด้วยการ escape
        ทุกจุดที่รับ user input แล้วแล้ว (ดูหัวข้อ Security ด้านบน)
```

| หน้า | ทำอะไรได้ |
|------|-----------|
| Dashboard | สถิติรวม + กิจกรรมล่าสุด |
| Apps | CRUD app, จัดการ callback_urls, เปิด/ปิดใช้งาน, search |
| Users | ค้นหา/เพิ่มผู้ใช้ล่วงหน้า, จัดการสิทธิ์ (grant/edit/revoke), filter ตาม role/scope |
| Master Data | CRUD Roles และ Departments (Scope), search+pagination ทั้งคู่ |
| Audit Log | ประวัติทุก action พร้อม pagination เต็มรูปแบบ |

---

## 9. Demo / Test Apps

ใช้ทดสอบ SSO flow แบบ end-to-end โดยไม่ต้องสร้างแอปจริง

| Route | app_id | Pattern | ใช้ทดสอบอะไร |
|-------|--------|---------|---------------|
| `/demouser` | `demo` | ปุ่ม Login (manual) | UX แบบมีปุ่มให้กด |
| `/demouser2` | `demo2` | Auto-redirect | UX ไร้รอยต่อ + logout flag pattern |
| `/demouser3` | `demo3` | Auto-redirect (theme ม่วง) | ทดสอบ SSO ข้ามหลายแอปพร้อมกัน |

---

## 10. API Endpoints

| Method | Path | Auth | คำอธิบาย |
|--------|------|------|---------|
| GET | `/login?app_id=&redirect_uri=` | - | จุดเริ่มต้น SSO Flow (validate callback_urls) |
| GET | `/auth/google`, `/auth/google/callback` | - | Google OAuth dance |
| GET | `/api/v1/health` | - | Health check |
| GET | `/api/v1/public-key` | - | RSA Public Key (PEM) |
| POST | `/api/v1/validate-token` | - | Verify JWT (public, JWT มีในตัวมันเองอยู่แล้ว) |
| `*` | `/api/v1/admin/*` | Bearer JWT (ADMIN+sso-admin) | Admin Dashboard API ทั้งหมด |

---

## 11. JWT Token Structure

```json
{
  "sub": "1",
  "email": "akkadate.si@northbkk.ac.th",
  "name": "Akkadate",
  "application_id": "my-app",
  "permission": {
    "role": "ADMIN",
    "scope_level": "FACULTY",
    "allowed_dept_id": 101,
    "allowed_dept_name": "คณะเทคโนโลยีสารสนเทศ"
  },
  "iss": "sso.northbkk.ac.th",
  "iat": 1234567890,
  "exp": 1234596690
}
```
⚠️ **Decode ฝั่ง client ต้องใช้ `TextDecoder('utf-8')` ไม่ใช่ `atob()` ตรงๆ** — ไม่งั้น `allowed_dept_name` ภาษาไทยจะเพี้ยน (ดูตัวอย่างถูกต้องใน `2_FOR_AI_NEW_APP.md`)

---

## 12. Admin & Key Persons

| ข้อมูล | ค่า |
|--------|-----|
| Admin Email | akkadate.si@northbkk.ac.th |
| Google Cloud Project | nbu-sso-500507 |
| Supabase Project | vlovedyjtwawqepgjpsv |
| Service Account Email | nbu-sso-service-account@nbu-sso-500507.iam.gserviceaccount.com |

---

## 13. วิธีรัน Local Development

```bash
git clone https://github.com/akkadateoit/nbu-sso.git
cd nbu-sso
npm install
cd admin-ui && npm install --legacy-peer-deps && cd ..

# ตั้งค่า .env (ดูหัวข้อ 5) + ใส่ไฟล์ secrets/
node scripts/migrate.js

npm run dev          # backend (nodemon)
npm run dev:admin    # admin-ui dev server (แยก terminal)
```

ทดสอบ: `http://localhost:3000/login?app_id=demo&redirect_uri=http://localhost:3000/demouser`

---

## 14. วิธี Deploy

```bash
git add .
git commit -m "ข้อความอธิบายการเปลี่ยนแปลง"
git push   # → Cloud Build deploy อัตโนมัติไป asia-southeast1
```

**ก่อน deploy ที่เปลี่ยน DB schema** ต้องรัน migration SQL ใน Supabase ก่อนเสมอ (ดูไฟล์ใน `scripts/migrate-*.sql`)

---

## 15. มี App ย่อยใหม่ต้องทำอะไรบ้าง (สรุปสั้น)

```
1. อ่าน 1_SSO_STARTER.md + 2_FOR_AI_NEW_APP.md (มี Checklist 21 ข้อ)
2. ลงทะเบียนแอปผ่าน /admin/apps (ระบุ callback_urls ให้ครบ — บังคับ)
3. กำหนดสิทธิ์ผู้ใช้ผ่าน /admin/users
4. เพิ่ม Authorized redirect URI ใน Google Cloud Console (แยกจาก callback_urls — ต้องทำทั้งคู่)
5. เขียนโค้ดตามตัวอย่างใน 2_FOR_AI_NEW_APP.md (ระวัง UTF-8 decode + logout flag)
6. ทดสอบตาม Checklist ข้อ F (5 test cases) ก่อน Go Live
```

---

## 16. สถานะปัจจุบัน — สรุป

```
✅ SSO Server          — Production, ผ่าน Security Review
✅ Admin Dashboard      — ใช้งานได้เต็มรูปแบบ
✅ Demo Apps (3 ตัว)    — ทดสอบ flow ครบ
✅ Rate Limiting         — Cloudflare + Express (2 ชั้น)
✅ Security Hardening    — Open Redirect, XSS, Error leak ปิดหมดแล้ว
⏳ ยังไม่มีแอปย่อยจริงเชื่อมต่อ — รอแอปแรกจากมหาวิทยาลัย
```
