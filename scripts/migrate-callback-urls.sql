-- ============================================================
-- NBU SSO — Security Fix: Open Redirect Prevention
-- เพิ่ม callback_urls allowlist ให้ตาราง apps
-- รัน script นี้ใน Supabase → SQL Editor ก่อน deploy โค้ดใหม่
-- ============================================================

-- 1. เพิ่มคอลัมน์ callback_urls (array ของ URL ที่อนุญาตให้ redirect กลับได้)
ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS callback_urls TEXT[] NOT NULL DEFAULT '{}';

-- 2. ลงทะเบียน callback_urls ให้แอปที่มีอยู่แล้ว (ไม่งั้นจะ login ไม่ได้ทันทีหลัง deploy)
--    ทุก demo app + sso-admin โฮสต์อยู่บน sso.northbkk.ac.th เอง

UPDATE apps SET callback_urls = ARRAY['https://sso.northbkk.ac.th']
WHERE app_name IN ('demo', 'demo2', 'demo3', 'sso-admin')
  AND callback_urls = '{}';

-- 3. ตรวจสอบผลลัพธ์
SELECT app_name, callback_urls, is_active FROM apps ORDER BY app_name;

-- ============================================================
-- หมายเหตุสำหรับแอปใหม่ในอนาคต:
-- ตอนลงทะเบียนแอปใหม่ผ่าน Admin Dashboard (/admin/apps) ต้องกรอก
-- Callback URLs ที่อนุญาตด้วยเสมอ ไม่งั้น Login จะถูกปฏิเสธ
-- (เทียบเท่า Authorized Redirect URIs ของ Google OAuth)
-- ============================================================
