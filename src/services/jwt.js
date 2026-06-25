'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * เซ็น JWT Token ด้วย RSA Private Key (RS256)
 * @param {object} payload - ข้อมูลสิทธิ์ที่จะฝังใน Token
 * @returns {string} signed JWT string
 */
function signToken(payload) {
  return jwt.sign(payload, config.jwt.privateKey, {
    algorithm:  config.jwt.algorithm,
    expiresIn:  config.jwt.expiresIn,
    issuer:     config.jwt.issuer,
  });
}

/**
 * ตรวจสอบ JWT Token ด้วย RSA Public Key
 * @param {string} token - JWT string จากแอปย่อย
 * @returns {{ valid: boolean, payload?: object, error?: string }}
 */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.publicKey, {
      algorithms: [config.jwt.algorithm],
      issuer:     config.jwt.issuer,
    });
    return { valid: true, payload };
  } catch (err) {
    // แปลง error เป็น code ที่อ่านง่าย
    let errorCode = 'TOKEN_INVALID';
    if (err.name === 'TokenExpiredError')  errorCode = 'TOKEN_EXPIRED';
    if (err.name === 'JsonWebTokenError')  errorCode = 'TOKEN_MALFORMED';
    if (err.name === 'NotBeforeError')     errorCode = 'TOKEN_NOT_ACTIVE';
    return { valid: false, error: errorCode, message: err.message };
  }
}

module.exports = { signToken, verifyToken };
