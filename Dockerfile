# ============================================================
# Stage 1: Build admin-ui (React + Vite)
# ============================================================
FROM node:20-alpine AS admin-builder

WORKDIR /app/admin-ui

COPY admin-ui/package*.json ./
RUN npm ci --legacy-peer-deps

COPY admin-ui/ ./
RUN npm run build
# ผลลัพธ์อยู่ที่ /app/admin-ui/dist/

# ============================================================
# Stage 2: Install backend production dependencies
# ============================================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ============================================================
# Stage 3: Production image
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

# Backend dependencies
COPY --from=backend-builder /app/node_modules ./node_modules

# Backend source
COPY src/ ./src/
COPY package.json ./

# Admin UI build output → Express จะ serve จาก admin-ui/dist/
COPY --from=admin-builder /app/admin-ui/dist/ ./admin-ui/dist/

# ไม่ copy .env และ secrets/ — ค่า config มาจาก Cloud Run environment variables

# Non-root user (security best practice)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "src/index.js"]
