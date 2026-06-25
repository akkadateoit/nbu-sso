# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files ก่อนเพื่อ cache layer
COPY package*.json ./
RUN npm ci --omit=dev

# ---- Production stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Copy dependencies จาก builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY src/ ./src/
COPY package.json ./

# ไม่ copy .env และ secrets/ — ค่า config ต้องมาจาก Cloud Run environment variables
# JWT keys ต้องส่งผ่าน env vars หรือ Secret Manager

# User ที่ไม่ใช่ root (Security best practice)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

# Health check สำหรับ Cloud Run
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "src/index.js"]
