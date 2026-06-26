# คู่มือสร้างแอปใหม่ที่ใช้ NBU SSO (สำหรับ AI)

> ไฟล์นี้ให้ AI อ่านก่อนสร้างแอปย่อยใหม่ที่ต้องการ Authentication ผ่าน NBU SSO
> อ่านร่วมกับ `PROJECT_MEMORY.md` เพื่อเข้าใจภาพรวม

---

## ภาพรวม: แอปย่อยทำงานกับ SSO อย่างไร

```
1. ผู้ใช้เข้าแอปย่อย (เช่น https://myapp.northbkk.ac.th)
2. แอปตรวจว่ามี JWT Token ไหม → ถ้าไม่มี Redirect ไป SSO
3. SSO Login ด้วย Google Workspace (@northbkk.ac.th)
4. SSO ตรวจ Group + สิทธิ์ใน DB แล้วออก JWT Token
5. Redirect กลับแอปพร้อม ?token=eyJ...
6. แอปรับ Token → decode → รู้ว่าใครเข้า + มีสิทธิ์อะไร
7. ส่ง API requests ได้โดยแนบ Token ใน Header
```

---

## ขั้นตอนที่ต้องทำทุกครั้งก่อนสร้างแอปใหม่

### ขั้นตอนที่ 1 — ลงทะเบียนแอปใน Supabase

เข้าที่ **Supabase → SQL Editor** แล้วรัน:

```sql
-- 1. สร้าง App Secret (สุ่มด้วย: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
INSERT INTO apps (app_name, app_secret, description)
VALUES (
  'ชื่อแอป',        -- เช่น 'hr-system', 'e-learning', 'finance'
  'APP_SECRET_HERE', -- สุ่มค่า hex 64 ตัวอักษร
  'คำอธิบายแอป'
);

-- 2. กำหนดสิทธิ์ให้ผู้ใช้ที่ต้องการ
INSERT INTO user_app_permissions (user_id, app_id, role_key, scope_dept_id)
SELECT u.id, a.id, 'ROLE_KEY', DEPT_ID
FROM users u CROSS JOIN apps a
WHERE u.email = 'email@northbkk.ac.th'
  AND a.app_name = 'ชื่อแอป';
```

**ค่าที่ใช้ได้สำหรับ `role_key`:**
| role_key | คำอธิบาย |
|----------|----------|
| `ADMIN` | ผู้ดูแลระบบ — สิทธิ์สูงสุด |
| `DEAN` | คณบดี — จัดการระดับคณะ |
| `DIRECTOR` | ผู้อำนวยการสำนัก |
| `CHAIR` | หัวหน้าสาขา |
| `LECTURER` | อาจารย์ |
| `STAFF` | เจ้าหน้าที่ |

**ค่าที่ใช้สำหรับ `scope_dept_id`:**
| dept_id | ชื่อหน่วยงาน | ระดับ |
|---------|-------------|-------|
| 100 | มหาวิทยาลัยนอร์ทกรุงเทพ | UNIVERSITY |
| 101 | คณะเทคโนโลยีสารสนเทศ | FACULTY |
| 102 | คณะบริหารธุรกิจ | FACULTY |
| 201 | สาขาวิทยาการคอมพิวเตอร์ | BRANCH |
| 202 | สาขาเทคโนโลยีสารสนเทศ | BRANCH |

---

### ขั้นตอนที่ 2 — เพิ่ม Redirect URI ใน Google Cloud Console

ไปที่ **Google Cloud Console → APIs & Services → Credentials → OAuth Client**
เพิ่มใน **Authorized redirect URIs**:
```
https://URL-ของแอปใหม่/auth/callback
```
*(เปลี่ยน `/auth/callback` ให้ตรงกับ callback route ของแอป)*

---

## JWT Token ที่ได้จาก SSO มีข้อมูลอะไรบ้าง

```json
{
  "sub": "1",
  "email": "akkadate.si@northbkk.ac.th",
  "name": "Akkadate Siripongwattana",
  "application_id": "ชื่อแอป",
  "permission": {
    "role": "ADMIN",
    "scope_level": "FACULTY",
    "allowed_dept_id": 101,
    "allowed_dept_name": "คณะเทคโนโลยีสารสนเทศ"
  },
  "iat": 1234567890,
  "exp": 1234596690,
  "iss": "sso.northbkk.ac.th"
}
```

**Algorithm**: RS256 (RSA)
**Public Key**: ดึงได้จาก `https://sso.northbkk.ac.th/api/v1/public-key`

---

## Code สำหรับแต่ละ Tech Stack

### 🟨 Vanilla JavaScript / HTML (Frontend Only)

```html
<script>
const SSO_URL  = 'https://sso.northbkk.ac.th';
const APP_ID   = 'ชื่อแอป';
const APP_URL  = window.location.origin;

// ตรวจ Token เมื่อหน้าโหลด
window.onload = function() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');
  
  if (token) {
    // ล้าง token ออกจาก URL
    history.replaceState({}, '', window.location.pathname);
    sessionStorage.setItem('nbu_token', token);
    showApp(decodeToken(token));
  } else {
    const saved = sessionStorage.getItem('nbu_token');
    if (saved && !isExpired(saved)) {
      showApp(decodeToken(saved));
    } else {
      loginWithSSO();
    }
  }
};

function loginWithSSO() {
  const redirect = encodeURIComponent(APP_URL);
  window.location.href = `${SSO_URL}/login?app_id=${APP_ID}&redirect_uri=${redirect}`;
}

function decodeToken(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

function isExpired(token) {
  const { exp } = decodeToken(token);
  return Date.now() >= exp * 1000;
}

function logout() {
  sessionStorage.removeItem('nbu_token');
  loginWithSSO();
}

// ตัวอย่างการเช็คสิทธิ์
function showApp(payload) {
  const { email, name, permission } = payload;
  
  if (permission.role === 'ADMIN') {
    // แสดงเมนูผู้ดูแล
  }
  if (permission.scope_level === 'FACULTY') {
    // แสดงข้อมูลระดับคณะ
  }
}
</script>
```

---

### 🟩 Node.js / Express (Backend API)

**ติดตั้ง:**
```bash
npm install jsonwebtoken axios
```

**middleware/auth.js:**
```javascript
const jwt  = require('jsonwebtoken');
const axios = require('axios');

let cachedPublicKey = null;

async function getPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;
  const res = await axios.get('https://sso.northbkk.ac.th/api/v1/public-key');
  cachedPublicKey = res.data;
  return cachedPublicKey;
}

// Middleware ตรวจสอบ Token
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const publicKey = await getPublicKey();
    const payload   = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer:     'sso.northbkk.ac.th',
    });
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token', detail: err.message });
  }
}

// Middleware ตรวจสิทธิ์ตาม Role
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.permission?.role)) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    next();
  };
}

// Middleware ตรวจสิทธิ์ตาม Department
function requireDept(deptId) {
  return (req, res, next) => {
    const { scope_level, allowed_dept_id } = req.user?.permission || {};
    if (scope_level === 'UNIVERSITY') return next(); // ADMIN ทุกหน่วยงาน
    if (allowed_dept_id !== deptId) {
      return res.status(403).json({ error: 'Access denied for this department' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireDept };
```

**ตัวอย่างการใช้ใน routes:**
```javascript
const { requireAuth, requireRole, requireDept } = require('./middleware/auth');

// ทุกคนที่ล็อกอินเข้าได้
app.get('/api/profile', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// เฉพาะ ADMIN เท่านั้น
app.delete('/api/users/:id', requireAuth, requireRole('ADMIN'), (req, res) => {
  // ลบ user
});

// เฉพาะ DEAN และ ADMIN
app.post('/api/reports', requireAuth, requireRole('ADMIN', 'DEAN'), (req, res) => {
  // สร้างรายงาน
});

// เฉพาะคนที่มีสิทธิ์ในคณะ IT (dept_id = 101)
app.get('/api/it-data', requireAuth, requireDept(101), (req, res) => {
  // ข้อมูลคณะ IT
});
```

---

### 🔵 Python / FastAPI (Backend API)

**ติดตั้ง:**
```bash
pip install python-jose httpx
```

**auth.py:**
```python
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer
from jose import jwt, JWTError
import httpx

security = HTTPBearer()
PUBLIC_KEY_URL = "https://sso.northbkk.ac.th/api/v1/public-key"
_public_key = None

async def get_public_key():
    global _public_key
    if not _public_key:
        async with httpx.AsyncClient() as client:
            r = await client.get(PUBLIC_KEY_URL)
            _public_key = r.text
    return _public_key

async def require_auth(token=Security(security)):
    public_key = await get_public_key()
    try:
        payload = jwt.decode(
            token.credentials, public_key,
            algorithms=["RS256"],
            issuer="sso.northbkk.ac.th"
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=str(e))

# ตัวอย่างการใช้งาน
from fastapi import FastAPI, Depends
app = FastAPI()

@app.get("/api/profile")
async def get_profile(user=Depends(require_auth)):
    return {"user": user}

@app.get("/api/admin-only")
async def admin_only(user=Depends(require_auth)):
    if user["permission"]["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin only")
    return {"data": "secret admin data"}
```

---

### 🟪 PHP (Backend)

```php
<?php
// ติดตั้ง: composer require firebase/php-jwt

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function getPublicKey(): string {
    static $key = null;
    if (!$key) {
        $key = file_get_contents('https://sso.northbkk.ac.th/api/v1/public-key');
    }
    return $key;
}

function requireAuth(): object {
    $headers = getallheaders();
    $token   = str_replace('Bearer ', '', $headers['Authorization'] ?? '');
    
    if (!$token) {
        http_response_code(401);
        die(json_encode(['error' => 'No token']));
    }
    
    try {
        return JWT::decode($token, new Key(getPublicKey(), 'RS256'));
    } catch (Exception $e) {
        http_response_code(401);
        die(json_encode(['error' => $e->getMessage()]));
    }
}

// ใช้งาน
$user = requireAuth();
echo $user->email;                  // akkadate.si@northbkk.ac.th
echo $user->permission->role;      // ADMIN
echo $user->permission->scope_level; // FACULTY
```

---

### ⚡ Next.js (React + API Routes)

**lib/sso.js:**
```javascript
import { jwtVerify, createRemoteJWKSet } from 'jose';

const SSO_URL  = 'https://sso.northbkk.ac.th';
const APP_ID   = 'ชื่อแอป';

// Client-side: decode token (ไม่ verify — verify ที่ server)
export function decodeToken(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

// Client-side: redirect ไป SSO
export function loginWithSSO() {
  const redirect = encodeURIComponent(window.location.origin + '/auth/callback');
  window.location.href = `${SSO_URL}/login?app_id=${APP_ID}&redirect_uri=${redirect}`;
}

// Server-side (API Routes): verify token
export async function verifyToken(token) {
  const res    = await fetch(`${SSO_URL}/api/v1/public-key`);
  const rawKey = await res.text();
  const encoder = new TextEncoder();
  const keyData = encoder.encode(rawKey);
  // ใช้ Web Crypto API verify
  // หรือใช้ library jose สำหรับ Next.js:
  // const payload = await jwtVerify(token, publicKey, { issuer: 'sso.northbkk.ac.th' });
}
```

**pages/auth/callback.js:**
```javascript
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { decodeToken } from '@/lib/sso';

export default function Callback() {
  const router = useRouter();
  
  useEffect(() => {
    const { token } = router.query;
    if (token) {
      sessionStorage.setItem('nbu_token', token);
      router.replace('/dashboard');
    }
  }, [router.query]);
  
  return <p>กำลังล็อกอิน...</p>;
}
```

---

## API ของ SSO Server ที่แอปย่อยใช้ได้

| Method | URL | คำอธิบาย |
|--------|-----|---------|
| GET | `https://sso.northbkk.ac.th/login?app_id=XXX&redirect_uri=YYY` | เริ่ม Login Flow |
| GET | `https://sso.northbkk.ac.th/api/v1/health` | ตรวจสอบว่า SSO ทำงานอยู่ |
| GET | `https://sso.northbkk.ac.th/api/v1/public-key` | ดึง RSA Public Key (PEM) |
| POST | `https://sso.northbkk.ac.th/api/v1/verify` | Verify JWT Token ที่ฝั่ง Server |

**ตัวอย่างการ Verify Token ผ่าน API:**
```bash
curl -X POST https://sso.northbkk.ac.th/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbGciOiJSUzI1NiIs..."}'
```

Response สำเร็จ:
```json
{
  "valid": true,
  "payload": {
    "sub": "1",
    "email": "akkadate.si@northbkk.ac.th",
    "permission": { "role": "ADMIN", ... }
  }
}
```

---

## Prompt สำหรับบอก AI สร้างแอปใหม่

```
ช่วยสร้าง [ชื่อแอป] โดย:
- ใช้ [Node.js+Express / Python+FastAPI / PHP / Next.js / ...]
- Authentication ผ่าน NBU SSO (https://sso.northbkk.ac.th)
- app_id = "ชื่อแอป"
- JWT Token (RS256) ออกโดย SSO มี payload ดังนี้:
  { sub, email, name, application_id, permission: { role, scope_level, allowed_dept_id, allowed_dept_name } }
- Public Key ดึงจาก: https://sso.northbkk.ac.th/api/v1/public-key
- กรุณาอ่านไฟล์ docs/FOR_AI_NEW_APP.md ใน d:\coding\nbu-sso สำหรับ code ตัวอย่างและรายละเอียดเพิ่มเติม

ฟีเจอร์ที่ต้องการ:
1. [บรรยายฟีเจอร์]
2. [บรรยายฟีเจอร์]

สิทธิ์ที่ใช้:
- [ADMIN] → เข้าถึงได้ทั้งหมด
- [LECTURER] → เห็นเฉพาะข้อมูลของตัวเอง
```

---

## Checklist สำหรับแอปใหม่ทุกตัว

```
□ 1. Insert app ในตาราง apps (Supabase)
□ 2. Insert สิทธิ์ใน user_app_permissions (Supabase)
□ 3. เพิ่ม Authorized redirect URI ใน Google Cloud Console OAuth
□ 4. ตั้งค่า SSO_URL และ APP_ID ในโค้ด
□ 5. สร้าง callback page/route ที่รับ ?token= แล้วเก็บไว้
□ 6. สร้าง auth middleware สำหรับ verify JWT
□ 7. ใช้ข้อมูลจาก token.permission ในการกำหนดสิทธิ์
□ 8. ทดสอบ Login Flow End-to-End
```
