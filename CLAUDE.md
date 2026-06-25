# NBU SSO — Instructions for Claude AI

อ่านไฟล์นี้ก่อนทำงานทุกครั้ง:
- `docs/PROJECT_MEMORY.md` — บริบทโปรเจกต์ทั้งหมด (Tech Stack, Architecture, Next Steps)
- `docs/SSO_INTEGRATION_GUIDE.md` — คู่มือสำหรับนักพัฒนา
- `docs/create_database_5_tables.sql` — Database Schema

## สรุปสั้นๆ

ระบบ SSO (Single Sign-On) ของมหาวิทยาลัยนอร์ทกรุงเทพ
- **Backend**: Node.js + Express.js
- **Auth**: Google OAuth 2.0 + JWT (RS256)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Google Cloud Run (Production ✅)
- **URL**: https://nbu-sso-459706050098.europe-west1.run.app
- **Repo**: https://github.com/akkadateoit/nbu-sso

## กฎสำคัญ

1. ห้าม commit ไฟล์ใน `secrets/` และ `.env` ขึ้น GitHub เด็ดขาด
2. ทุกการเปลี่ยนแปลงโค้ด → `git push` → Cloud Build Deploy อัตโนมัติ
3. ตรวจสอบ `docs/PROJECT_MEMORY.md` หัวข้อ "Next Steps" เสมอก่อนเริ่มงาน
