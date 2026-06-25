'use strict';
const app = require('./app');
const config = require('./config');
const { testConnection } = require('./db');

async function main() {
  // ---- ทดสอบ DB Connection ก่อน start ----
  await testConnection();

  // ---- Start Server ----
  app.listen(config.port, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║     🎓 NBU Centralized SSO Server             ║');
    console.log('╠═══════════════════════════════════════════════╣');
    console.log(`║  URL:  http://localhost:${config.port}                  ║`);
    console.log(`║  ENV:  ${config.nodeEnv.padEnd(38)}║`);
    console.log('╠═══════════════════════════════════════════════╣');
    console.log('║  Endpoints:                                   ║');
    console.log(`║  GET  /login?app_id=&redirect_uri=            ║`);
    console.log(`║  POST /api/v1/validate-token                  ║`);
    console.log(`║  GET  /api/v1/public-key                      ║`);
    console.log(`║  GET  /api/v1/health                          ║`);
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('');
  });
}

main().catch((err) => {
  console.error('[Startup] ❌ Failed to start server:', err.message);
  process.exit(1);
});
