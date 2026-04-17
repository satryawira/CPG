#!/usr/bin/env bash
set -e

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Crypto Payment Gateway — Quick Start       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"

# ─── Check Node ───────────────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found. Install Node.js 18+ first.${NC}"; exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ─── .env setup ───────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚙  Creating .env from .env.example ...${NC}"
  if [ -f ".env.example" ]; then
    cp .env.example .env
  else
    cat > .env <<'ENVEOF'
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://cpg_user:cpg_pass123@localhost:5432/crypto_gateway
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=super_secret_access_key_minimum_32_chars_dev_only
JWT_REFRESH_SECRET=super_secret_refresh_key_minimum_32_chars_dev_only
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
STORAGE_PROVIDER=local
UPLOAD_DIR=./uploads
ENVEOF
  fi
  echo -e "${GREEN}✓ .env created (edit DATABASE_URL if needed)${NC}"
fi

# ─── Install deps ─────────────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Installing dependencies ...${NC}"
  npm install --silent
  echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# ─── Prisma generate ──────────────────────────────────────────────────────────
echo -e "${YELLOW}🔧 Generating Prisma client ...${NC}"
npx prisma generate --silent 2>/dev/null || npx prisma generate
echo -e "${GREEN}✓ Prisma client ready${NC}"

# ─── DB migrate ───────────────────────────────────────────────────────────────
echo -e "${YELLOW}🗄  Running DB migrations ...${NC}"
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init
echo -e "${GREEN}✓ Database schema up to date${NC}"

# ─── Seed ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}🌱 Seeding test data ...${NC}"
npx tsx prisma/seed.ts 2>/dev/null || true
echo -e "${GREEN}✓ Seed data ready${NC}"

# ─── Start server in background ───────────────────────────────────────────────
PORT=${PORT:-3000}
echo -e "${YELLOW}🚀 Starting server on port $PORT ...${NC}"
npm run dev > /tmp/cpg-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to respond
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server running (PID $SERVER_PID)${NC}"
    break
  fi
  sleep 1
done

if ! curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ Server failed to start. Check /tmp/cpg-server.log${NC}"; exit 1
fi

# ─── Tunnel ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}🌐 Opening public tunnel (localtunnel) ...${NC}"
echo -e "${YELLOW}   Waiting for public URL ...${NC}"

# Start localtunnel and capture URL
TUNNEL_URL=""
SUBDOMAIN="cpg-demo-$(head -c4 /dev/urandom | xxd -p)"

npx --yes localtunnel --port "$PORT" --subdomain "$SUBDOMAIN" > /tmp/cpg-tunnel.log 2>&1 &
TUNNEL_PID=$!

for i in $(seq 1 20); do
  TUNNEL_URL=$(grep -o 'https://[^ ]*' /tmp/cpg-tunnel.log 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then break; fi
  sleep 1
done

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║             DEPLOYMENT READY                         ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════╣${NC}"
if [ -n "$TUNNEL_URL" ]; then
  echo -e "${CYAN}║ 🌍 Public URL  : ${GREEN}${TUNNEL_URL}/api-docs${CYAN}${NC}"
  echo -e "${CYAN}║ 🌐 Health      : ${GREEN}${TUNNEL_URL}/health${CYAN}${NC}"
else
  echo -e "${CYAN}║ ⚠  Tunnel URL  : check /tmp/cpg-tunnel.log${NC}"
fi
echo -e "${CYAN}║ 💻 Local URL   : ${GREEN}http://localhost:${PORT}/api-docs${CYAN}${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║ 👤 Admin  : admin@cpg.dev  / Admin123!               ║${NC}"
echo -e "${CYAN}║ 👤 User   : user@cpg.dev   / User123!                ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║ ℹ  First visit on loca.lt: klik 'Click to Continue'  ║${NC}"
echo -e "${CYAN}║ ℹ  Press Ctrl+C to stop server + tunnel              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"

# ─── Keep alive + cleanup on exit ─────────────────────────────────────────────
trap "echo -e '\n${YELLOW}Stopping...${NC}'; kill $SERVER_PID $TUNNEL_PID 2>/dev/null; exit 0" INT TERM
wait $SERVER_PID
