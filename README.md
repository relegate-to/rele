# rele

A monorepo with a Next.js frontend, a Hono/Bun API, and a local Supabase stack.

## Stack

| Service | Description | Port |
|---|---|---|
| `web` | Next.js frontend (Clerk auth) | 3000 |
| `gate` | Hono/Bun API (Clerk JWT validation) | 3001 |
| `supabase` | Local Supabase (Postgres, Auth, Storage, Studio, etc.) | 54321–54327 |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Bun](https://bun.sh)

## Setup

Clone the configuration repo to get your env files:

```bash
bash dev.sh setup
```

This copies `.env.local` files into place for `web`, `gate`, and `supabase`.

## Running locally

```bash
bash compose.sh up
```

This starts the Supabase stack in the background, then brings up `web` and `gate` in the foreground with log output.

In Docker Desktop you'll see two separate groups:

- **supabase** — the full Supabase local dev stack
- **rele** — web and gate

To stop everything:

```bash
bash compose.sh down
```

## Supabase

The local Supabase stack runs as its own Docker Compose project (`supabase/supabase.yml`) with configuration in `supabase/.env`.

| URL | Description |
|---|---|
| `http://localhost:54321` | API gateway (Kong) |
| `http://localhost:54322` | Postgres (direct) |
| `http://localhost:54323` | Supabase Studio |
| `http://localhost:54324` | Inbucket (email testing) |

### Migrations

Migrations live in `supabase/supabase/migrations/`. To apply them against the local database:

```bash
supabase db push --workdir supabase/supabase
```

## Project structure

```
rele/
├── web/                  # Next.js frontend
├── gate/                 # Hono/Bun API
├── supabase/
│   ├── supabase.yml      # Supabase Docker Compose project
│   ├── .env              # Supabase env vars (gitignored)
│   ├── volumes/          # Init SQL, Kong config, Vector config
│   └── supabase/         # Supabase CLI project (migrations, config.toml)
├── docker-compose.yml    # web + gate
└── compose.sh            # Starts/stops both compose projects
```
