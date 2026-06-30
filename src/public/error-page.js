// ปุ่ม "รับทราบ" ในหน้า error ของ /login, /auth/google/callback — ปิดแท็บนี้
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('ack-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'กำลังปิด...';
    window.close();

    // บาง browser ไม่ยอมปิดแท็บที่ไม่ได้เปิดจาก script (เช่น ผ่าน redirect ทั่วไป)
    // ถ้ายังไม่ปิดภายในเวลาสั้นๆ ให้บอกผู้ใช้ปิดเอง
    setTimeout(() => {
      btn.textContent = 'ปิดแท็บนี้ได้เลยครับ';
      btn.disabled = false;
    }, 400);
  });
});
