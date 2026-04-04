# rele

Control plane for OpenClaw instances on Fly.io. Deploy and manage multiple instances from a single dashboard.

## Stack

- **web** — Next.js frontend + Neon Auth (port 3000)
- **gate** — Hono/Bun API with JWT validation (port 3001)
- **db** — Drizzle ORM + Neon PostgreSQL

## Setup

```bash
bun install
bun run env:pull        # Pull secrets from config repo
bun run dev             # Start web + gate
```

## Commands

```bash
bun run dev             # Start everything
bun run dev:gate        # Gate only
bun run build:gate      # Build for production
bun run --filter db push      # Sync schema to dev DB
bun run --filter db push:prod # Sync schema to prod DB
```

## How It Works

The API manages OpenClaw instances via Fly.io Machines API. User instances are tracked in Neon with JWT-validated access. Real-time stats stream via WebSocket.

## Database

Two Neon branches: `main` (production) and `dev` (local). Push schema changes with the commands above before deploying.

---

Built with Bun, Next.js, Hono, and Fly.io.
