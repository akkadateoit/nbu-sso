ระบบ NBU SSO ตอนนี้ครบสมบูรณ์แล้ว สรุปสิ่งที่สร้างไว้ด้วยกัน:

Core SSO Server
    Google OAuth 2.0 + JWT RS256 + 2-Axis IAM (Role × Scope)
    Google Group check กรองเฉพาะบุคลากร
    hd: 'northbkk.ac.th' ป้องกันใช้ Gmail ผิด

Admin Dashboard (/admin)
    จัดการ Apps, Users, Roles, Departments, Permissions
    Audit Log + Pagination
    เพิ่ม User ล่วงหน้าก่อนวันเริ่มงาน

Public Pages
    Front page (/) — modern dark theme
    Demo page (/demouser) — ทดสอบ SSO flow

Infrastructure
    Cloud Run asia-southeast1 (Singapore) ~30ms จากไทย
    Cloudflare DNS + Custom domain sso.northbkk.ac.th
    Auto-deploy ผ่าน Cloud Build

เมื่อจะพัฒนา App ใหม่ที่ใช้ SSO อ่าน docs/1_SSO_STARTER.md เป็นจุดเริ่มต้นได้เลยครับ

2 แบบที่ App ย่อยทำได้
แบบที่ 1 — Auto-redirect (ไม่เห็นปุ่มเลย)


window.onload = function() {
  const token = sessionStorage.getItem('nbu_token')
  if (!token) {
    // redirect ทันทีโดยไม่แสดงปุ่ม
    window.location.href = '/login?app_id=...'
  }
}

ผู้ใช้เปิด App B → หน้าโหลด → redirect ผ่าน SSO → กลับมาพร้อม token
ผู้ใช้ไม่เห็นอะไรเลย เร็วมาก < 1 วินาที ✅
แบบที่ 2 — แสดงปุ่ม Login (ต้องคลิก)


ผู้ใช้เปิด App B → เห็นปุ่ม "Login with NBU SSO" → คลิก → ผ่าน SSO
แนะนำให้ใช้ Auto-redirect
สำหรับระบบ Internal มหาวิทยาลัย แบบที่ 1 ดีกว่าครับ เพราะ:


ประสบการณ์ผู้ใช้:
  เปิด App → หน้าโหลด 0.5-1 วิ → เข้าใช้งานได้เลย
  ไม่ต้องคลิกปุ่มใดๆ
  ไม่ต้องกรอก password (Google session อยู่)
ใน docs/1_SSO_STARTER.md ที่เตรียมไว้ให้ developer อ่าน มี code ตัวอย่างทั้ง 2 แบบ สามารถแนะนำ developer แต่ละ App ให้ใช้ Auto-redirect ได้เลยครับ


##--------------------------------

 ## https://github.com/akkadateoit/nbu-sso.git 

  ```
git add .
git commit -m "comment"
git push origin main
```

เมื่อ push แล้ว trigger ทำงาน build อัตโนมัติ 