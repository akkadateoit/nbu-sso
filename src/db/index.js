'use strict';
const { Pool } = require('pg');
const config = require('../config');

/**
 * PostgreSQL connection pool เชื่อมต่อ Supabase
 */
const pool = new Pool({
  connectionString: config.database.connectionString,
  ssl: config.database.ssl,
  max: 10,               // จำนวน connection สูงสุด
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * ทดสอบ connection ตอน startup
 */
async function testConnection() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW() AS now');
    console.log(`[DB] ✅ Connected to Supabase — server time: ${res.rows[0].now}`);
  } finally {
    client.release();
  }
}

module.exports = { pool, testConnection };
