-- ============================================================
-- NBU SSO — Admin Dashboard Migration
-- รัน script นี้ใน Supabase → SQL Editor
-- ============================================================

-- 1. เพิ่ม is_active ให้ตาราง apps
ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. สร้างตาราง audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL PRIMARY KEY,
  acted_by_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acted_by_email VARCHAR(150),
  action        VARCHAR(50)  NOT NULL,  -- 'GRANT' | 'REVOKE' | 'UPDATE' | 'CREATE_APP' | 'DISABLE_APP'
  target_email  VARCHAR(150),           -- email ของผู้ถูกแก้สิทธิ์ (ถ้ามี)
  app_name      VARCHAR(100),           -- ชื่อแอปที่เกี่ยวข้อง
  detail        JSONB,                  -- ข้อมูลเพิ่มเติม เช่น { role_before, role_after, dept_id }
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor   ON audit_logs(acted_by_id);

-- 3. Seed แอป sso-admin (สำหรับ Admin Dashboard)
INSERT INTO apps (app_name, app_secret, description)
VALUES (
  'sso-admin',
  encode(gen_random_bytes(32), 'hex'),
  'NBU SSO Admin Dashboard — จัดการสิทธิ์ผู้ใช้และแอปพลิเคชัน'
)
ON CONFLICT (app_name) DO NOTHING;

-- 5. Seed แอป demo (สำหรับหน้า /demouser ทดสอบ SSO)
INSERT INTO apps (app_name, app_secret, description)
VALUES (
  'demo',
  encode(gen_random_bytes(32), 'hex'),
  'Demo Page — ทดสอบ SSO Login Flow'
)
ON CONFLICT (app_name) DO NOTHING;

-- ให้สิทธิ์ demo แก่ตัวเอง (เปลี่ยน email ตามจริง)
-- INSERT INTO user_app_permissions (user_id, app_id, role_key, scope_dept_id)
-- SELECT u.id, a.id, 'ADMIN', 100
-- FROM users u CROSS JOIN apps a
-- WHERE u.email    = 'akkadate.si@northbkk.ac.th'
--   AND a.app_name = 'demo';

-- 6. ให้สิทธิ์ ADMIN แก่ผู้ดูแลระบบ (เปลี่ยน email และ dept_id ตามจริง)
-- INSERT INTO user_app_permissions (user_id, app_id, role_key, scope_dept_id)
-- SELECT u.id, a.id, 'ADMIN', 100
-- FROM users u CROSS JOIN apps a
-- WHERE u.email    = 'akkadate.si@northbkk.ac.th'
--   AND a.app_name = 'sso-admin';
