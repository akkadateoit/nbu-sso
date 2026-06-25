require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL || '';
const masked = url.replace(/:([^:@]{3})[^:@]*@/, ':***@');
console.log('Connecting to:', masked);

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

pool.query('SELECT NOW() AS now')
  .then(r => {
    console.log('Connected OK — server time:', r.rows[0].now);
    pool.end();
  })
  .catch(err => {
    console.error('Connection FAILED:', err.code, '-', err.message);
    pool.end();
    process.exit(1);
  });
