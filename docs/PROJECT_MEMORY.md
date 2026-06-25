# NBU SSO — Project Memory (สำหรับ AI อ่านเพื่อพัฒนาต่อ)

> อัปเดตล่าสุด: 2026-06-25
> สถานะ: **✅ Production ทำงานสำเร็จบน Google Cloud Run**

---

## 1. โปรเจกต์นี้คืออะไร

ระบบ **Single Sign-On (SSO)** ของมหาวิทยาลัยนอร์ทกรุงเทพ (North Bangkok University)
ให้บุคลากรล็อกอินครั้งเดียวด้วย **Google Workspace Account (@northbkk.ac.th)** แล้วเข้าใช้ได้ทุกระบบย่อยของมหาวิทยาลัย

### Flow หลัก

```
แอปย่อย → Redirect ไป SSO Server พร้อม app_id & redirect_uri
         → SSO Redirect ไป Google Login
         → Google ส่ง Code กลับมาที่ SSO Callback
         → SSO ตรวจ Google Group (ว่าเป็นบุคลากรไหม)
         → SSO ตรวจสิทธิ์ใน Database (Role + Dept)
         → SSO ออก JWT Token (RS256)
         → Redirect กลับแอปย่อยพร้อม ?token=eyJ...
         → แอปย่อยเอา Token ไปเช็คที่ /api/v1/verify หรือ decode เอง
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
| Hosting | Google Cloud Run (europe-west1) |
| CI/CD | GitHub → Cloud Build (auto deploy) |
| Container | Docker (Dockerfile ใน root) |

---

## 3. โครงสร้างไฟล์สำคัญ

```
d:\coding\nbu-sso\
├── src/
│   ├── app.js              ← Express app config (trust proxy, session, helmet)
│   ├── index.js            ← Server entry point (PORT จาก env)
│   ├── config/index.js     ← โหลด ENV vars ทั้งหมด, loadKey() function
│   ├── db/index.js         ← PostgreSQL pool (SSL เปิดเสมอ)
│   ├── routes/
│   │   ├── auth.js         ← Google OAuth flow, JWT issuance
│   │   └── api.js          ← /health, /public-key, /verify endpoints
│   └── services/
│       ├── jwt.js          ← signToken(), verifyToken() (RS256)
│       ├── googleGroup.js  ← isGroupMember() ตรวจ Google Workspace Group
│       └── permissions.js  ← upsertUser(), getUserPermission(), getAppByName()
├── scripts/
│   └── migrate.js          ← สร้างตาราง DB (idempotent)
├── secrets/                ← *** ไม่ commit ขึ้น Git ***
│   ├── jwt_private.pem     ← RSA Private Key สำหรับเซ็น JWT
│   ├── jwt_public.pem      ← RSA Public Key สำหรับ verify
│   └── service-account-*.json  ← Google Service Account สำหรับ Admin SDK
├── docs/
│   ├── create_database_5_tables.sql  ← DDL schema
│   ├── SSO_INTEGRATION_GUIDE.md      ← คู่มือสำหรับนักพัฒนาแอปย่อย
│   └── PROJECT_MEMORY.md             ← ไฟล์นี้
├── .env                    ← *** ไม่ commit ขึ้น Git ***
├── .gitignore
├── .dockerignore
├── Dockerfile
└── package.json
```

---

## 4. Database Schema (Supabase)

### ตาราง `apps`
```sql
id, app_name (UNIQUE), app_secret, description, is_active, created_at
```
- `app_name` คือ key ที่แอปย่อยส่งมาใน `app_id` parameter

### ตาราง `users`
```sql
id, email (UNIQUE), name, is_active, created_at
```

### ตาราง `departments`
```sql
id, dept_name, dept_type (UNIVERSITY|FACULTY|BRANCH|OFFICE), parent_id, created_at
```
ข้อมูลที่มีอยู่:
- 100: มหาวิทยาลัยนอร์ทกรุงเทพ (UNIVERSITY)
- 101: คณะเทคโนโลยีสารสนเทศ (FACULTY)
- 102: คณะบริหารธุรกิจ (FACULTY)
- 201: สาขาวิทยาการคอมพิวเตอร์ (BRANCH)
- 202: สาขาเทคโนโลยีสารสนเทศ (BRANCH)

### ตาราง `roles`
```sql
id, role_key (UNIQUE), role_name, description, created_at
```

### ตาราง `user_app_permissions`
```sql
id, user_id→users, app_id→apps, role_key, scope_dept_id→departments, created_at
```
- เป็น "2-axis permission": Role + Department scope

### ตาราง `sso_sessions` (auto-created)
```sql
สร้างอัตโนมัติโดย connect-pg-simple สำหรับเก็บ session
```

---

## 5. Environment Variables ที่ต้องตั้งค่า

### สำหรับ Local Development (.env)
```env
GOOGLE_CLIENT_ID=[ดูใน Google Cloud Console → APIs & Services → Credentials]
GOOGLE_CLIENT_SECRET=[ดูใน Google Cloud Console → APIs & Services → Credentials]
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./secrets/service-account.json
GOOGLE_WORKSPACE_ADMIN_EMAIL=akkadate.si@northbkk.ac.th
ALLOWED_GOOGLE_GROUP=sso-staff-group@northbkk.ac.th

APP_PORT=3000
APP_URL=https://sso.northbkk.ac.th
NODE_ENV=development
SKIP_GROUP_CHECK=true  ← เปิดตอน dev, ปิดตอน production

JWT_PRIVATE_KEY_PATH=./secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=./secrets/jwt_public.pem
JWT_EXPIRES_IN=8h

DATABASE_URL=[ดูใน Supabase → Project Settings → Database → Connection string (Transaction Pooler port 6543)]
SESSION_SECRET=[random 64 hex chars — สร้างด้วย: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"]
```

### สำหรับ Cloud Run (Variables ใน Console)
ใช้ตัวแปรเดียวกัน แต่แตกต่างที่:
- `GOOGLE_CALLBACK_URL` → URL ของ Cloud Run + `/auth/google/callback`
- `APP_URL` → URL ของ Cloud Run
- `NODE_ENV` → `production`
- **ไม่ต้องมี** `SKIP_GROUP_CHECK` (หรือตั้งเป็น `false`)
- **เพิ่มพิเศษสำหรับ Cloud Run** (แทนการใช้ไฟล์):
  - `JWT_PRIVATE_KEY_RAW` → เนื้อหาของ jwt_private.pem (ใช้ `\n` แทนการขึ้นบรรทัดใหม่)
  - `JWT_PUBLIC_KEY_RAW` → เนื้อหาของ jwt_public.pem (ใช้ `\n` แทนการขึ้นบรรทัดใหม่)
  - `GOOGLE_SERVICE_ACCOUNT_RAW_JSON` → เนื้อหาของ service-account.json ทั้งก้อน

---

## 6. Cloud Run Deployment

- **URL หลัก**: `https://nbu-sso-459706050098.europe-west1.run.app`
- **Project ID**: `nbu-sso-500507`
- **Region**: `europe-west1`
- **Service Name**: `nbu-sso`
- **GitHub Repo**: `https://github.com/akkadateoit/nbu-sso`
- **CI/CD**: Push to `main` → Cloud Build auto deploy

### สิ่งสำคัญที่เรียนรู้จากการ Deploy
1. **`app.set('trust proxy', 1)`** จำเป็นมากสำหรับ Secure Cookie บน Cloud Run
2. **`PORT` env var** — Cloud Run inject มาให้อัตโนมัติ (8080) ต้องใช้ `process.env.PORT`
3. **SSL ของ Supabase** — ต้องเปิด `ssl: { rejectUnauthorized: false }` เสมอ ไม่ว่าจะ dev หรือ production
4. **JWT Keys บน Cloud Run** — ต้องส่งเป็น env var พร้อม `\n` literal แทนการขึ้นบรรทัดใหม่จริง แล้วโค้ดจะ `.replace(/\\n/g, '\n')` แปลงกลับ
5. **Ingress ต้องตั้งเป็น "All"** ไม่งั้นเข้าจากอินเทอร์เน็ตไม่ได้ (default เป็น Internal)

---

## 7. API Endpoints

| Method | Path | คำอธิบาย |
|--------|------|---------|
| GET | `/login?app_id=xxx&redirect_uri=https://...` | จุดเริ่มต้น SSO Flow |
| GET | `/auth/google` | Redirect ไป Google |
| GET | `/auth/google/callback` | Google callback, ออก JWT |
| GET | `/auth/error` | หน้า error ถ้า Google auth ล้มเหลว |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/public-key` | ดึง RSA Public Key (PEM format) |
| POST | `/api/v1/verify` | ตรวจสอบ JWT Token |

---

## 8. JWT Token Structure

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

---

## 9. สิ่งที่ยังต้องทำ (Next Steps)

### ✅ เสร็จแล้ว
- [x] SSO Server (Express.js) พร้อม Google OAuth
- [x] JWT RS256 Key Pair
- [x] Database Schema (5 tables)
- [x] Deploy บน Google Cloud Run
- [x] End-to-End Login Flow ทำงานสำเร็จ

### ⏳ ยังไม่ได้ทำ
- [ ] **Custom Domain** — ตั้ง DNS Record สำหรับ `sso.northbkk.ac.th` → Cloud Run URL
- [ ] **Google Group Check** — ต้องตั้ง Domain-Wide Delegation ใน Google Workspace Admin Console
  - ไปที่ admin.google.com → Security → API Controls → Domain-wide Delegation
  - เพิ่ม Service Account Client ID: `106565658878047619070`
  - Scopes: `https://www.googleapis.com/auth/admin.directory.group.member.readonly`
- [ ] **ปิด Error Detail** — เอา `err.message` ออกจาก production response ใน `src/routes/auth.js`
- [ ] **เพิ่ม Apps จริง** — Insert ข้อมูลแอประบบจริงของมหาวิทยาลัยใน Supabase
- [ ] **ทดสอบแอปย่อย** — สร้างแอปตัวอย่างที่รับ Token จาก SSO แล้ว verify
- [ ] **Admin Dashboard** — หน้าจัดการสิทธิ์ผู้ใช้ (optional)

---

## 10. Admin & Key Persons

| ข้อมูล | ค่า |
|--------|-----|
| Admin Email | akkadate.si@northbkk.ac.th |
| Google Cloud Project | nbu-sso-500507 |
| Supabase Project | vlovedyjtwawqepgjpsv |
| Service Account Email | nbu-sso-service-account@nbu-sso-500507.iam.gserviceaccount.com |
| Google Client ID | [ดูใน Google Cloud Console → APIs & Services → Credentials] |

---

## 11. วิธีรัน Local Development

```bash
# 1. Clone และติดตั้ง
git clone https://github.com/akkadateoit/nbu-sso.git
cd nbu-sso
npm install

# 2. ตั้งค่า .env (ดูตัวอย่างข้างบน)
# 3. ใส่ไฟล์ secrets/ (jwt keys + service account)
# 4. รัน migration
node scripts/migrate.js

# 5. Start server
node src/index.js

# 6. ทดสอบ
# เปิด http://localhost:3000/login?app_id=test&redirect_uri=http://localhost:3000/test
```

---

## 12. วิธี Deploy ขึ้น Cloud Run (หลังแก้โค้ด)

```bash
# Push ขึ้น GitHub → Cloud Build Deploy อัตโนมัติ
git add .
git commit -m "ข้อความอธิบายการเปลี่ยนแปลง"
git push
```

หรือถ้าต้องการ trigger deploy โดยไม่มีการเปลี่ยนแปลงโค้ด:
```bash
git commit --allow-empty -m "Trigger Cloud Build"
git push
```
