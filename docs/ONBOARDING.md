# Raket — Local Dev Onboarding

Cross-border payment platform for Filipino freelancers. Turborepo monorepo: **Next.js 15** (web on `:3000`) + **NestJS** (api on `:3001`) + **Prisma** + **Supabase Postgres**.

---

## Prerequisites

| Tool    | Min version | Check           |
| ------- | ----------- | --------------- |
| Node.js | 20.18.0     | `node -v`       |
| npm     | 10.x        | `npm -v`        |
| Git     | any         | `git --version` |

You also need accounts / projects for: **Supabase**, **Stripe** (test mode), **Google AI Studio** (Gemini), and **Resend**.

---

## 1 — Install dependencies

From the repo root (npm workspaces install everything in one shot):

```bash
npm install
```

---

## 2 — Set up environment variables

Copy the example file and fill in every value:

```bash
cp .env.example .env
```

Open `.env` and fill in the blanks. The table below shows what's required vs optional:

### Database (Supabase Postgres)

Get these from your Supabase project → **Settings → Database → Connection string**.

```env
DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
```

> Use the **direct** (non-pooled) connection string for both in development so Prisma migrations work.

### Supabase

From **Settings → API**:

```env
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."          # keep secret, server-side only
NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

### Stripe (test mode)

From **Stripe Dashboard → Developers → API keys**:

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."           # create a webhook endpoint locally (see below)
STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

**Stripe webhook for local testing** — install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then run:

```bash
stripe listen --forward-to http://localhost:3001/api/v1/stripe/webhook
```

Copy the `whsec_...` signing secret it prints and paste it into `STRIPE_WEBHOOK_SECRET`.

### Google Gemini

Get a key at <https://aistudio.google.com/apikey> (free tier).

```env
GEMINI_API_KEY="AIza..."
GEMINI_MODEL="gemini-2.5-flash"   # optional — defaults to gemini-2.5-flash
```

> Production plan: upgrade to Claude for higher accuracy. Gemini's free tier is the hackathon-cost choice.

### Resend

```env
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="invoices@yourdomain.com"   # optional in dev
```

### API / Web URLs (defaults are fine for local)

```env
PORT=3001
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
NEXT_PUBLIC_APP_URL="http://localhost:3000"   # Next.js client bundle
APP_URL="http://localhost:3000"               # NestJS API (Stripe success_url, etc.) — keep in sync with NEXT_PUBLIC_APP_URL
CORS_ORIGINS="http://localhost:3000"   # comma-separated for multi-origin (staging, previews)
EXCHANGE_RATE_API_URL="https://api.exchangerate.host"
```

---

## 3 — Generate Prisma client

```bash
cd apps/api
npm run db:generate
cd ../..
```

---

## 4 — Run database migrations

Creates all tables in your Supabase Postgres database:

```bash
cd apps/api
npm run db:migrate
cd ../..
```

> If prompted, enter a migration name (e.g. `init`).

### Optional: seed demo data

```bash
cd apps/api
npm run db:seed
cd ../..
```

---

## 5 — Start the dev servers

From the repo root, Turborepo starts both apps in parallel:

```bash
npm run dev
```

| App           | URL                          |
| ------------- | ---------------------------- |
| Web (Next.js) | http://localhost:3000        |
| API (NestJS)  | http://localhost:3001/api/v1 |

Turborepo streams both logs in one terminal with colour-coded prefixes. Press `Ctrl+C` to stop everything.

---

## 6 — Verify it's working

1. Open http://localhost:3000 — you should see the app shell.
2. Open http://localhost:3001/api/v1 — NestJS will return a 404 (no root handler), which means the server is up.
3. Check the terminal — both apps should print "ready" / "listening" messages without errors.

---

## Useful scripts

All run from the repo root:

```bash
npm run build          # build all packages
npm run typecheck      # tsc across all apps
npm run test           # run all vitest suites
npm run lint           # lint all apps

# database (run from apps/api/)
npm run db:studio      # open Prisma Studio at localhost:5555
npm run db:migrate     # create + apply a new migration
npm run db:generate    # re-generate Prisma client after schema changes
```

---

## Troubleshooting

**`Invalid environment configuration`** — the API validates env vars on startup via Zod. Check the error message; it will list every missing or malformed key.

**`Can't reach database server`** — confirm `DATABASE_URL` is correct and that your IP is allowed in Supabase → Settings → Network.

**Prisma client out of date** — run `npm run db:generate` in `apps/api/` after any `schema.prisma` change.

**`NEXT_PUBLIC_*` vars undefined at runtime** — Next.js bakes these in at build time. After changing them, restart `npm run dev`.
