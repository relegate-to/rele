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

Pull env files from the configuration repo:

```bash
./run env:pull
```

## Running locally

```bash
./run up
```

Starts Supabase in the background, then `web` and `gate` in the foreground. In Docker Desktop you'll see two separate groups — `supabase` and `rele`.

```bash
./run down
```

## Commands

| Command | Description |
|---|---|
| `./run up` | Start Supabase (detached) then web + gate (foreground) |
| `./run down` | Stop web + gate then Supabase |
| `./run nuke` | Stop everything and wipe all Supabase volumes |
| `./run migrate` | Apply all migrations to the local database |
| `./run db:reset` | Wipe the public schema and re-run all migrations |
| `./run env:push` | Push local env files to the configuration repo |
| `./run env:pull` | Pull env files from the configuration repo |

## Supabase

The local Supabase stack runs as its own Docker Compose project (`supabase/supabase.yml`) with configuration in `supabase/.env` (gitignored).

| URL | Description |
|---|---|
| `http://localhost:54321` | API gateway (Kong) |
| `http://localhost:54322` | Postgres (direct) |
| `http://localhost:54323` | Supabase Studio |
| `http://localhost:54324` | Inbucket (email testing) |

Migrations live in `supabase/supabase/migrations/` and are applied with `./run migrate`. After a `./run nuke`, run `./run up` then `./run migrate` to get back to a clean state.

## Project structure

```
rele/
├── web/                  # Next.js frontend
├── gate/                 # Hono/Bun API
├── supabase/
│   ├── supabase.yml      # Supabase Docker Compose project
│   ├── .env              # Supabase env vars (gitignored)
│   ├── volumes/          # Init SQL, Kong config, Vector config
│   └── supabase/         # Migrations and config.toml
├── docker-compose.yml    # web + gate
└── run                   # Task runner
```
