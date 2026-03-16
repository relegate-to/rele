# rele
A monorepo with a Next.js frontend and a Hono/Bun API.

## Stack
| Service | Description | Port |
|---|---|---|
| `web` | Next.js frontend (Neon Auth) | 3000 |
| `gate` | Hono/Bun API (JWT validation) | 3001 |
| `db` | Drizzle schema + migrations | — |

## Prerequisites
- [Bun](https://bun.sh)

## Setup
Pull env files from the configuration repo:
```bash
bun run env:pull
```

## Running locally
```bash
bun run dev
```
Starts `web` and `gate` concurrently.

## Commands
| Command | Description |
|---|---|
| `bun run dev` | Start web + gate |
| `bun run dev:gate` | Start gate only |
| `bun run build:gate` | Build gate for production |
| `bun run start:gate` | Start gate in production mode |
| `bun run --filter db push` | Push schema changes to dev database |
| `bun run --filter db push:prod` | Push schema changes to production database |

## Database
The database is managed with [Drizzle Kit](https://orm.drizzle.team) and hosted on [Neon](https://neon.tech).

Two branches are maintained in Neon:
- **main** — production database, used by the live app
- **dev** — development database, used during local development

`.env.local` points to the dev branch. `.env.production` (gitignored, lives in the secrets repo) points to the production branch.

During development, run `bun run --filter db push` to sync schema changes to the dev database. When ready to push to production, run `bun run --filter db push:prod` from your local machine.
