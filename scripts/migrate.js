'use strict';
/**
 * Migration Script — รัน SQL Schema บน Supabase
 * ใช้: node scripts/migrate.js
 * หมายเหตุ: ถ้าตารางมีอยู่แล้วจะข้ามไป แล้ว insert seed data เท่านั้น
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log('[Migrate] 🚀 เริ่มต้น Migration...');

  const sqlPath = path.join(__dirname, '..', 'docs', 'create_database_5_tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    // ---- ขั้นตอน 1: สร้างตาราง (ข้ามถ้ามีอยู่แล้ว) ----
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('[Migrate] ✅ สร้างตารางสำเร็จ!');
    } catch (tableErr) {
      await client.query('ROLLBACK');
      if (tableErr.code === '42P07') {
        // 42P07 = relation already exists — ไม่ใช่ error จริง
        console.log('[Migrate] ⚠️  ตารางมีอยู่แล้ว — ข้ามการสร้างตาราง');
      } else {
        throw tableErr;
      }
    }

    // ---- ขั้นตอน 2: เพิ่ม Seed Data ----
    await client.query('BEGIN');

    // Seed apps
    await client.query(`
      INSERT INTO apps (app_name, app_secret, description)
      VALUES
        ('test',           'test_secret_dev',     'App สำหรับทดสอบ Development'),
        ('grading_system', 'grading_secret_prod', 'ระบบบันทึกผลการเรียน')
      ON CONFLICT (app_name) DO NOTHING
    `);

    // Seed departments
    await client.query(`
      INSERT INTO departments (id, dept_name, dept_type, parent_id) OVERRIDING SYSTEM VALUE VALUES
        (100, 'มหาวิทยาลัยนอร์ทกรุงเทพ', 'UNIVERSITY', NULL),
        (101, 'คณะเทคโนโลยีสารสนเทศ',    'FACULTY', 100),
        (102, 'คณะบริหารธุรกิจ',          'FACULTY', 100),
        (201, 'สาขาวิทยาการคอมพิวเตอร์', 'BRANCH',  101),
        (202, 'สาขาเทคโนโลยีสารสนเทศ',   'BRANCH',  101)
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('[Migrate] ✅ Seed Data เสร็จสิ้น!');
    console.log('[Migrate]    - apps: test, grading_system');
    console.log('[Migrate]    - departments: 5 รายการ');
    console.log('[Migrate] 🎉 Migration สมบูรณ์ — พร้อมใช้งาน!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migrate] ❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
