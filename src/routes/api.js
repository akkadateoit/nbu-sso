'use strict';
const express = require('express');
const { verifyToken } = require('../services/jwt');

const router = express.Router();

/**
 * POST /api/v1/validate-token
 *
 * แอปย่อยส่ง JWT มาตรวจสอบ
 *
 * Request Body: { "token": "eyJhbGci..." }
 *
 * Response Success:
 * { "valid": true, "payload": { ...jwt_payload... } }
 *
 * Response Failure:
 * { "valid": false, "error": "TOKEN_EXPIRED", "message": "..." }
 */
router.post('/validate-token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      valid: false,
      error: 'TOKEN_MISSING',
      message: 'กรุณาส่ง token ใน request body',
    });
  }

  const result = verifyToken(token);

  if (!result.valid) {
    return res.status(401).json({
      valid: false,
      error: result.error,
      message: result.message,
    });
  }

  return res.json({
    valid: true,
    payload: result.payload,
  });
});

/**
 * GET /api/v1/public-key
 * แจก RSA Public Key ให้แอปย่อยดาวน์โหลดไปใช้ Verify เอง
 */
router.get('/public-key', (req, res) => {
  const config = require('../config');
  res.type('text/plain').send(config.jwt.publicKey);
});

/**
 * GET /api/v1/health
 * Health check endpoint สำหรับ Cloud Run
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'nbu-sso', timestamp: new Date().toISOString() });
});

module.exports = router;
