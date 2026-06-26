# NBU SSO — Starter Kit สำหรับ AI

> **วิธีใช้**: วางไฟล์นี้ไว้ใน root ของโปรเจกต์ใหม่
> แล้วบอก AI ว่า "อ่าน SSO_STARTER.md ก่อนแล้วช่วยสร้างแอป..."

---

## ระบบ SSO ของมหาวิทยาลัยนอร์ทกรุงเทพคืออะไร

**NBU SSO** คือระบบ Single Sign-On ของ NBU ที่ให้บุคลากรล็อกอินครั้งเดียว
แล้วเข้าได้ทุกระบบย่อย โดยใช้บัญชี Google Workspace (@northbkk.ac.th)

- **SSO Server URL**: `https://sso.northbkk.ac.th`
- **JWT Algorithm**: RS256
- **Token อายุ**: 8 ชั่วโมง

---

## ขั้นตอน Login Flow (แอปย่อยต้องทำ)

```
1. ผู้ใช้เข้าแอป → ตรวจว่ามี JWT Token ไหม
2. ถ้าไม่มี → Redirect ไป:
   https://sso.northbkk.ac.th/login?app_id=APP_ID&redirect_uri=CALLBACK_URL

3. SSO พา Login ด้วย Google Workspace
4. SSO ออก JWT Token → Redirect กลับมาที่ CALLBACK_URL?token=eyJ...
5. แอปรับ token → เก็บไว้ → ใช้งาน
```

---

## โครงสร้าง JWT Token ที่ได้รับ

```json
{
  "sub": "1",
  "email": "user@northbkk.ac.th",
  "name": "ชื่อ นามสกุล",
  "application_id": "APP_ID_ของแอปนี้",
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

**scope_level** บอกว่าผู้ใช้มีสิทธิ์ขนาดไหน:
- `UNIVERSITY` = ทั้งมหาวิทยาลัย
- `FACULTY` = ระดับคณะ
- `BRANCH` = ระดับสาขา
- `OFFICE` = ระดับสำนัก

---

## API ของ SSO Server

| Method | URL | คำอธิบาย |
|--------|-----|---------|
| GET | `/login?app_id=X&redirect_uri=Y` | เริ่ม Login |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/public-key` | RSA Public Key (PEM format) |
| POST | `/api/v1/verify` | Verify token ฝั่ง server |

### ดึง Public Key
```bash
curl https://sso.northbkk.ac.th/api/v1/public-key
# ได้: -----BEGIN PUBLIC KEY-----\nMIIBIjAN...
```

### Verify Token
```bash
curl -X POST https://sso.northbkk.ac.th/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"eyJhbGci..."}'
# Response: {"valid":true,"payload":{...}}
```

---

## Code ตัวอย่าง — เลือกตาม Tech Stack

### 🟨 HTML + Vanilla JavaScript (Frontend)

```html
<!DOCTYPE html>
<html>
<head><title>My NBU App</title></head>
<body>
<div id="login-view">
  <h1>กรุณาเข้าสู่ระบบ</h1>
  <button onclick="login()">Login with NBU SSO</button>
</div>
<div id="app-view" style="display:none">
  <h1>ยินดีต้อนรับ <span id="user-name"></span></h1>
  <p>Role: <span id="user-role"></span></p>
  <button onclick="logout()">Logout</button>
</div>

<script>
const SSO_URL = 'https://sso.northbkk.ac.th';
const APP_ID  = 'YOUR_APP_ID';  // ← เปลี่ยนตรงนี้

window.onload = function() {
  const token = new URLSearchParams(location.search).get('token');
  if (token) {
    history.replaceState({}, '', location.pathname);
    sessionStorage.setItem('token', token);
    showApp(decode(token));
  } else {
    const saved = sessionStorage.getItem('token');
    saved && !expired(saved) ? showApp(decode(saved)) : showLogin();
  }
};

function login() {
  location.href = SSO_URL + '/login?app_id=' + APP_ID
    + '&redirect_uri=' + encodeURIComponent(location.origin);
}

function logout() {
  sessionStorage.removeItem('token');
  showLogin();
}

function decode(token) {
  return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
}

function expired(token) {
  return Date.now() >= decode(token).exp * 1000;
}

function showLogin() {
  document.getElementById('login-view').style.display = 'block';
  document.getElementById('app-view').style.display   = 'none';
}

function showApp(p) {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display   = 'block';
  document.getElementById('user-name').textContent = p.name;
  document.getElementById('user-role').textContent = p.permission.role;
}
</script>
</body>
</html>
```

---

### 🟩 Node.js + Express (Backend)

**package.json dependencies ที่ต้องการ:**
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "jsonwebtoken": "^9.0.0",
    "axios": "^1.6.0"
  }
}
```

**middleware/auth.js:**
```javascript
const jwt  = require('jsonwebtoken');
const axios = require('axios');

let _publicKey = null;

async function getPublicKey() {
  if (!_publicKey) {
    const res = await axios.get('https://sso.northbkk.ac.th/api/v1/public-key');
    _publicKey = res.data;
  }
  return _publicKey;
}

// ใช้เป็น middleware: app.get('/route', requireAuth, handler)
async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'กรุณาล็อกอินก่อน' });
  try {
    const key = await getPublicKey();
    req.user  = jwt.verify(token, key, { algorithms: ['RS256'], issuer: 'sso.northbkk.ac.th' });
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' });
  }
}

// ตรวจ Role: requireRole('ADMIN') หรือ requireRole('ADMIN','DEAN')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.permission?.role))
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ดำเนินการ' });
    next();
  };
}

module.exports = { requireAuth, requireRole };
```

**app.js ตัวอย่าง:**
```javascript
const express = require('express');
const { requireAuth, requireRole } = require('./middleware/auth');
const app = express();
app.use(express.json());

// Public route
app.get('/health', (req, res) => res.json({ ok: true }));

// ต้อง login
app.get('/api/profile', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// เฉพาะ ADMIN
app.get('/api/admin', requireAuth, requireRole('ADMIN'), (req, res) => {
  res.json({ secret: 'admin data' });
});

app.listen(3000);
```

---

### 🔵 Python + FastAPI

**requirements.txt:**
```
fastapi
uvicorn
python-jose[cryptography]
httpx
```

**auth.py:**
```python
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer
from jose import jwt, JWTError
import httpx

security    = HTTPBearer()
SSO_URL     = "https://sso.northbkk.ac.th"
_public_key = None

async def get_public_key() -> str:
    global _public_key
    if not _public_key:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"{SSO_URL}/api/v1/public-key")
            _public_key = r.text
    return _public_key

async def require_auth(creds=Security(security)):
    try:
        key = await get_public_key()
        return jwt.decode(creds.credentials, key,
                          algorithms=["RS256"],
                          issuer="sso.northbkk.ac.th")
    except JWTError as e:
        raise HTTPException(401, detail=str(e))

def require_role(*roles):
    async def dep(user=Security(require_auth)):
        if user.get("permission", {}).get("role") not in roles:
            raise HTTPException(403, "ไม่มีสิทธิ์")
        return user
    return dep
```

**main.py ตัวอย่าง:**
```python
from fastapi import FastAPI, Depends
from auth import require_auth, require_role

app = FastAPI()

@app.get("/api/profile")
async def profile(user=Depends(require_auth)):
    return {"user": user}

@app.get("/api/admin")
async def admin(user=Depends(require_role("ADMIN"))):
    return {"data": "admin only"}
```

---

### ⚡ Next.js

**lib/sso.js:**
```javascript
const SSO_URL = 'https://sso.northbkk.ac.th';
const APP_ID  = 'YOUR_APP_ID'; // ← เปลี่ยนตรงนี้

export const loginWithSSO = () => {
  const cb = encodeURIComponent(window.location.origin + '/auth/callback');
  window.location.href = `${SSO_URL}/login?app_id=${APP_ID}&redirect_uri=${cb}`;
};

export const decodeToken = (token) => {
  const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(atob(b64));
};

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  const t = sessionStorage.getItem('nbu_token');
  if (!t) return null;
  const { exp } = decodeToken(t);
  if (Date.now() >= exp * 1000) { sessionStorage.removeItem('nbu_token'); return null; }
  return t;
};
```

**pages/auth/callback.js:**
```javascript
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Callback() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const { token } = router.query;
    if (token) {
      sessionStorage.setItem('nbu_token', token);
      router.replace('/dashboard');
    }
  }, [router.isReady]);
  return <p>กำลังเข้าสู่ระบบ...</p>;
}
```

**pages/_app.js (ป้องกันทุก page):**
```javascript
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getToken, loginWithSSO } from '@/lib/sso';

const PUBLIC_PAGES = ['/auth/callback', '/login'];

export default function App({ Component, pageProps }) {
  const router = useRouter();
  useEffect(() => {
    if (PUBLIC_PAGES.includes(router.pathname)) return;
    if (!getToken()) loginWithSSO();
  }, [router.pathname]);
  return <Component {...pageProps} />;
}
```

---

## สิ่งที่ต้องทำก่อน (Setup ใน NBU SSO)

> **ทำครั้งเดียวต่อแอป** — ให้ Admin ของ NBU SSO ทำให้หรือทำเองถ้ามีสิทธิ์

### 1. ลงทะเบียนแอปใน Supabase
```sql
INSERT INTO apps (app_name, app_secret, description)
VALUES ('YOUR_APP_ID', 'RANDOM_SECRET_64_HEX', 'ชื่อระบบของคุณ');
```

### 2. กำหนดสิทธิ์ผู้ใช้
```sql
INSERT INTO user_app_permissions (user_id, app_id, role_key, scope_dept_id)
SELECT u.id, a.id, 'ADMIN', 101
FROM users u CROSS JOIN apps a
WHERE u.email = 'your-email@northbkk.ac.th' AND a.app_name = 'YOUR_APP_ID';
```

### 3. เพิ่ม OAuth Redirect URI
ไปที่ Google Cloud Console → Credentials → OAuth → เพิ่ม Authorized redirect URI:
```
https://your-app-url.com/auth/callback
```

---

## Prompt สำหรับบอก Claude สร้างแอปใหม่

```
สร้างแอป [ชื่อระบบ] ให้หน่อยครับ โดย:

- Tech Stack: [Node.js+Express / Python+FastAPI / Next.js / HTML เท่านั้น]
- app_id สำหรับ SSO: "YOUR_APP_ID"
- ใช้ NBU SSO Authentication จากไฟล์ SSO_STARTER.md ที่แนบมา

ฟีเจอร์ที่ต้องการ:
1. [บรรยายฟีเจอร์]
2. [บรรยายฟีเจอร์]

กำหนดสิทธิ์:
- ADMIN → เข้าถึงได้ทั้งหมด
- LECTURER → ดูได้เฉพาะข้อมูลตัวเอง
- STAFF → เฉพาะฟีเจอร์พื้นฐาน
```
