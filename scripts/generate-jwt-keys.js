/**
 * สร้าง RSA Key Pair สำหรับเซ็น JWT Token ของระบบ SSO
 * รัน: node scripts/generate-jwt-keys.js
 */
const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

const secretsDir = path.join(__dirname, '..', 'secrets');

// สร้าง folder secrets ถ้ายังไม่มี
if (!fs.existsSync(secretsDir)) {
  fs.mkdirSync(secretsDir, { recursive: true });
  console.log('✅ สร้าง folder secrets/ แล้ว');
}

// ตรวจสอบว่ามี key อยู่แล้วหรือไม่
const privatePath = path.join(secretsDir, 'jwt_private.pem');
const publicPath  = path.join(secretsDir, 'jwt_public.pem');

if (fs.existsSync(privatePath)) {
  console.log('⚠️  พบ jwt_private.pem อยู่แล้ว — ถ้าต้องการสร้างใหม่ ให้ลบไฟล์เก่าออกก่อน');
  process.exit(0);
}

console.log('🔑 กำลังสร้าง RSA 2048-bit Key Pair...');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',   format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8',  format: 'pem' },
});

fs.writeFileSync(privatePath, privateKey,  { mode: 0o600 }); // อ่านได้เฉพาะเจ้าของ
fs.writeFileSync(publicPath,  publicKey);

console.log('✅ สร้าง Key Pair สำเร็จ!');
console.log('   📄 Private Key:', privatePath);
console.log('   📄 Public Key: ', publicPath);
console.log('');
console.log('📌 สิ่งที่ต้องทำต่อ:');
console.log('   1. เก็บ jwt_private.pem ไว้ที่ SSO Server เท่านั้น (ห้ามแจก)');
console.log('   2. แจก jwt_public.pem ให้ทุก Sub-Application เพื่อ Verify Token');
console.log('   3. ตรวจสอบว่า secrets/ อยู่ใน .gitignore แล้ว');
