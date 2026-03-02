# Sports Academy Management SaaS

Production-focused multi-tenant SaaS for sports academies.

## Runtime Stack
- Backend: Node.js + Express + MongoDB + Redis
- Frontend: Next.js
- Queue/Worker: BullMQ + Redis
- Reverse Proxy: NGINX
- Logging: Winston

## Local Development (Docker)
1. Copy env templates:
   - `cp .env.example .env`
   - `cp backend/.env.docker.example backend/.env.docker` (or edit existing `backend/.env.docker`)
2. Start stack:
   - `docker compose up --build`
3. Verify:
   - Frontend: `http://localhost:3000`
   - API health: `http://localhost:4000/health`
   - Versioned health: `http://localhost:4000/api/v1/health`

## Local Development (Without Docker)
Prerequisites:
- MongoDB running on `localhost:27017`
- Redis running on `localhost:6379`

1. Copy env templates:
   - `cp backend/.env.example backend/.env` (or edit existing `backend/.env`)
   - `cp frontend/.env.example frontend/.env` (if missing)
2. Install dependencies:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
3. Start backend:
   - `cd backend && npm run dev`
4. Start frontend in a second terminal:
   - `cd frontend && npm run dev`
5. Verify:
   - Frontend: `http://localhost:3000`
   - API health: `http://localhost:4000/health`
   - Versioned health: `http://localhost:4000/api/v1/health`

## Production Deployment
1. Set production secrets in environment (or `.env`):
   - `MONGO_URI`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CORS_ORIGIN`
2. Build and run production stack:
   - `docker compose -f docker-compose.production.yml up -d --build`
3. Public entrypoint:
   - `http://<server-ip>/`
4. NGINX proxy routes:
   - `/api/*` -> backend
   - `/` -> frontend

## Security Hardening Implemented
- Strict Helmet policy + `x-powered-by` disabled
- Strict CORS allowlist (comma-separated `CORS_ORIGIN`)
- Global API rate limiting + auth-specific limiter
- Request body size limits via `REQUEST_BODY_LIMIT`
- Mongo injection sanitization (`express-mongo-sanitize`)
- Centralized error handler with request IDs and known DB/validation mapping

## Logging
- Winston structured logs
- Request logging middleware with `x-request-id`
- Production log files:
  - `/app/logs/combined.log`
  - `/app/logs/error.log`
  - `/app/logs/requests.log`

## Health and Monitoring
- `GET /health` returns:
  - overall status
  - MongoDB ping status
  - Redis ping status
- `GET /api/v1/health` equivalent health endpoint
- `GET /healthz` lightweight liveness probe

## Environment Profiles
- [backend/.env.development](/Users/kanhaikumar/Desktop/New project/backend/.env.development)
- [backend/.env.staging](/Users/kanhaikumar/Desktop/New project/backend/.env.staging)
- [backend/.env.production](/Users/kanhaikumar/Desktop/New project/backend/.env.production)
- Runtime config profiles:
  - [development.js](/Users/kanhaikumar/Desktop/New project/backend/src/config/environments/development.js)
  - [staging.js](/Users/kanhaikumar/Desktop/New project/backend/src/config/environments/staging.js)
  - [production.js](/Users/kanhaikumar/Desktop/New project/backend/src/config/environments/production.js)

## Backup Strategy
See detailed Atlas backup and restore plan:
- [backup-strategy.md](/Users/kanhaikumar/Desktop/New project/docs/backup-strategy.md)
# arena-pilot-os
