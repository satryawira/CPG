# Crypto Payment Gateway — Quick Start Guide

Platform cashout crypto → IDR dengan Swagger UI interaktif. Deploy dalam **3 menit** dengan akses publik HTTPS.

---

## 🚀 Fastest Setup (One Command)

Jalankan di mesin/VPS kamu dengan Node.js 18+ terinstall:

```bash
git clone https://github.com/satryawira/CPG.git
cd CPG
git checkout claude/crypto-payment-gateway-D0Tzd
bash start.sh
```

**Output:**
```
✓ Node.js v22.x.x
✓ .env created
✓ Dependencies installed
✓ Prisma client ready
✓ Database schema up to date
✓ Seed data ready
✓ Server running (PID 12345)

═══════════════════════════════════════════════════════════════
             DEPLOYMENT READY
═══════════════════════════════════════════════════════════════
🌍 Public URL  : https://cpg-demo-abc123.loca.lt/api-docs
🌐 Health      : https://cpg-demo-abc123.loca.lt/health
💻 Local URL   : http://localhost:3000/api-docs
═══════════════════════════════════════════════════════════════
👤 Admin  : admin@cpg.dev  / Admin123!
👤 User   : user@cpg.dev   / User123!
═══════════════════════════════════════════════════════════════
ℹ  First visit on loca.lt: klik 'Click to Continue'
ℹ  Press Ctrl+C to stop server + tunnel
```

Klik link `https://cpg-demo-abc123.loca.lt/api-docs` → **Swagger UI langsung buka**.

---

## 📋 Prerequisites

| Tool | Min Version | Check |
|------|-------------|-------|
| Node.js | 18+ | `node -v` |
| npm | 8+ | `npm -v` |
| PostgreSQL | 12+ | `psql --version` |
| Redis | 5+ | `redis-cli ping` → `PONG` |

---

## 🔧 Manual Setup (Step-by-Step)

Jika `start.sh` tidak cocok:

### 1. Database & Services

```bash
# Start PostgreSQL
sudo service postgresql start

# Create database
sudo -u postgres psql -c "CREATE DATABASE crypto_gateway;"
sudo -u postgres psql -c "CREATE USER cpg_user WITH PASSWORD 'cpg_pass123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE crypto_gateway TO cpg_user;"

# Start Redis
sudo service redis-server start

# Verify
pg_isready -h localhost -U cpg_user -d crypto_gateway  # → accepting connections
redis-cli ping  # → PONG
```

### 2. Install & Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
```

### 3. Start Server

```bash
npm run dev
```

Output:
```
Server running on port 3000 [development]
Database connected
Redis connected
```

### 4. Open Tunnel (Separate Terminal)

```bash
npx localtunnel --port 3000 --subdomain cpg-demo
```

Output:
```
your url is: https://cpg-demo.loca.lt
```

Buka `https://cpg-demo.loca.lt/api-docs` → Swagger UI + test semua endpoint.

---

## 🧪 Testing di Swagger UI

### 1. Login Admin

```
POST /api/v1/auth/login
Body: {
  "email": "admin@cpg.dev",
  "password": "Admin123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": { "id": "...", "email": "admin@cpg.dev", "role": "ADMIN" }
  }
}
```

### 2. Authorize Token

- Klik tombol **"Authorize"** (kanan atas, ikon kunci)
- Paste `accessToken` ke field "Value"
- Klik "Authorize"

### 3. Test Endpoints

**Admin Dashboard:**
```
GET /api/v1/admin/stats
```

**List Users:**
```
GET /api/v1/admin/users?page=1&limit=20
```

**Get Cashout Quote (User dengan KYC approved):**
```
POST /api/v1/cashouts/quote
Body: {
  "currency": "USDT",
  "amount": "100",
  "network": "TRC20"
}
```

→ Return: HTTP 503 "No exchange rates available" (expected — API key exchange kosong di dev, bukan error).

---

## 🌐 Akses Publik

### Opsi 1: Localtunnel (Recommended)

✅ **Paling cepat, no registration**

```bash
npx localtunnel --port 3000 --subdomain cpg-demo
# → https://cpg-demo.loca.lt
```

- Random subdomain jika `cpg-demo` taken: `npx localtunnel --port 3000`
- Tunnel URL hidup selama terminal aktif

### Opsi 2: Cloudflared

✅ **No registration, automatic URL**

```bash
curl https://bin.equinox.io/c/bNyj1mQVY4c/cloudflared-stable-linux-amd64.tgz | tar xz
./cloudflared tunnel --url http://localhost:3000
# → https://random-uuid.trycloudflare.com
```

### Opsi 3: Deploy ke Cloud (Render, Railway, Fly.io)

Untuk persistence jangka panjang:

- **Render**: `git push` trigger auto-deploy (`https://your-app.onrender.com`)
- **Railway**: Connect GitHub repo → auto-deploy (`https://your-app-prod.railway.app`)
- **Fly.io**: `flyctl launch` → `https://your-app.fly.dev`

Lihat `.env.example` untuk konfigurasi production.

---

## 📁 Project Structure

```
CPG/
├── src/
│   ├── app.ts                 ← Express app + Swagger UI mount
│   ├── config/
│   │   ├── swagger.ts         ← OpenAPI 3 spec (all endpoints)
│   │   ├── env.ts             ← Env validation
│   │   ├── database.ts        ← Prisma
│   │   └── logger.ts          ← Winston
│   ├── modules/
│   │   ├── auth/              ← Register, login, profile
│   │   ├── kyc/               ← KYC submission + document upload
│   │   ├── wallet/            ← Crypto wallets + bank accounts
│   │   ├── cashout/           ← Cashout flow (quote → submit)
│   │   ├── admin/             ← User mgmt, KYC review, fees, dashboard
│   │   └── webhooks/          ← Payment gateway callbacks
│   ├── integrations/
│   │   ├── exchanges/         ← Binance, Indodax, Tokocrypto, OKX
│   │   ├── payment-gateways/  ← Flip, Xendit, Midtrans
│   │   └── queues/            ← BullMQ cashout worker
│   └── server.ts              ← Entry point
├── prisma/
│   ├── schema.prisma          ← DB schema (11 models)
│   ├── migrations/            ← Auto-generated
│   └── seed.ts                ← Test data (admin, user, wallets)
├── start.sh                   ← One-command deployment
├── .env.example               ← Template
└── package.json               ← Dependencies
```

---

## 🔐 Credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | `admin@cpg.dev` | `Admin123!` | Full dashboard access |
| User | `user@cpg.dev` | `User123!` | KYC approved, wallets seeded |

---

## ⚙️ Environment Variables

Minimal untuk dev (auto-generated oleh `start.sh`):

```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

DATABASE_URL=postgresql://cpg_user:cpg_pass123@localhost:5432/crypto_gateway
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=super_secret_access_key_minimum_32_chars_dev_only
JWT_REFRESH_SECRET=super_secret_refresh_key_minimum_32_chars_dev_only

ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

STORAGE_PROVIDER=local
UPLOAD_DIR=./uploads
```

Untuk **production**, set:
- `JWT_*`: 32+ random chars
- `ENCRYPTION_KEY`: 64 hex chars (AES-256)
- `BINANCE_API_KEY`, `INDODAX_API_KEY`, etc. (exchange API keys)
- `MIDTRANS_SERVER_KEY`, `XENDIT_SECRET_KEY`, `FLIP_SECRET_KEY` (payment gateways)

---

## 📊 API Endpoints

### Auth
- `POST /api/v1/auth/register` — Register user
- `POST /api/v1/auth/login` — Login (returns JWT)
- `POST /api/v1/auth/refresh` — Rotate token
- `GET /api/v1/auth/me` — Current profile

### KYC
- `GET /api/v1/kyc` — KYC status
- `POST /api/v1/kyc/submit` — Submit KYC data
- `POST /api/v1/kyc/documents` — Upload KYC document

### Wallet
- `GET /api/v1/wallets` — List crypto wallets
- `POST /api/v1/wallets` — Create wallet
- `GET /api/v1/wallets/bank-accounts` — List bank accounts
- `POST /api/v1/wallets/bank-accounts` — Add bank account

### Cashout
- `POST /api/v1/cashouts/quote` — Get exchange quote
- `POST /api/v1/cashouts` — Submit cashout request
- `GET /api/v1/cashouts` — List my cashouts

### Admin (protected, ADMIN role only)
- `GET /api/v1/admin/stats` — Dashboard stats
- `GET /api/v1/admin/users` — List users
- `PATCH /api/v1/admin/users/:id/status` — Update user status
- `GET /api/v1/admin/kyc` — List KYC records
- `PATCH /api/v1/admin/kyc/:id/approve` — Approve KYC
- `PATCH /api/v1/admin/kyc/:id/reject` — Reject KYC
- `GET /api/v1/admin/fees` — List fee configs
- `POST /api/v1/admin/fees` — Create fee config

**Full spec**: Buka `/api-docs` di browser → Swagger UI dengan "Try it out".

---

## 🐛 Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Connection refused :5432` | PostgreSQL not running | `sudo service postgresql start` |
| `REDIS connection failed` | Redis not running | `sudo service redis-server start` |
| `Cannot find module 'swagger-ui-express'` | Dependencies not installed | `npm install` |
| `POST /auth/login returns 401` | Wrong credentials | Use `admin@cpg.dev` / `Admin123!` |
| `GET /api-docs returns 404` | Server not running | `npm run dev` |
| `Tunnel URL stuck "waiting..."` | Network blocked | Switch to Cloudflared or cloud deploy |

---

## 📝 Notes

- **Swagger UI disabled in production** (`NODE_ENV=production`)
- **CORS loosened in dev mode** — allows tunnel URLs without extra config
- **All endpoints validated** with Zod schemas
- **JWT rotation** supported (refresh token)
- **Rate limiting** enabled (100 req/15min global)
- **Audit logging** untuk admin actions
- **Async job queue** untuk cashout processing (BullMQ + Redis)

---

## 🔗 GitHub

Branch: `claude/crypto-payment-gateway-D0Tzd`

Commit history:
- `4b182c1` — Add Swagger UI + Swagger types
- `e1054cd` — Add `start.sh` one-command deployment script

---

**Dibuat dengan ❤️ oleh Claude**