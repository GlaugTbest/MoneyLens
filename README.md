# MoneyLens

A personal finance app that connects to real bank accounts through an Open Finance
aggregator (Pluggy sandbox), automatically categorizes every transaction, and
surfaces insights — spending trends, recurring subscriptions, and anomalies — that
are hard to spot by scrolling through a raw statement.

<p align="center">
  <img src="assets/moneyLensVisaoGeralIMG.png" alt="MoneyLens dashboard overview" width="800">
</p>
<p align="center">
  <img src="assets/moneyLensbancosIMG.png" alt="MoneyLens connections screen" width="800">
</p>

## What it does

- **Connects a bank without ever touching a password.** The Pluggy Connect widget
  runs in an iframe on Pluggy's own domain — bank credentials never pass through
  MoneyLens's servers.
- **Syncs accounts and transactions asynchronously.** Initial sync and every
  webhook-triggered update run as background jobs (BullMQ), never inside an HTTP
  request.
- **Categorizes automatically, in layers.** A merchant cache, ~80 deterministic
  rules, Pluggy's own merchant category, and a Google Gemini fallback — in that
  order, so the LLM is only called for what nothing else could resolve.
- **Detects recurring expenses and spending anomalies** using plain statistical
  heuristics (interval/amount regularity, mean + standard deviation), not ML.
- **Keeps every user's data isolated** — verified with an automated multi-user test
  suite, not just a `WHERE userId = ?` and a hope.

## Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | NestJS + TypeScript | Modular structure (modules, guards, DI) for a domain with many moving parts — auth, sync, webhooks, categorization, insights. |
| Frontend | Next.js 16 (App Router) | Full-stack TypeScript, `proxy.ts` for optimistic session redirects without a separate BFF layer. |
| Database | PostgreSQL + Prisma | `Decimal` for money, typed client, versioned migrations across ~15 related models. |
| Queues | Redis + BullMQ | Sync, webhook processing, and LLM calls can't block an HTTP response — background jobs with retry/backoff. |
| Open Finance | [Pluggy](https://pluggy.ai) (sandbox) | Brazilian aggregator with a free sandbox — no need to integrate Open Finance Brasil directly for a personal project. |
| Categorization | Rules + Google Gemini (`gemini-3.6-flash`) | Deterministic rules resolve most cases for free; the LLM only handles the remainder. |
| Local tunnel | ngrok | Exposes the local API so Pluggy's sandbox can deliver real webhooks during development. |
| UI | Tailwind CSS v4 + lucide-react | Token-based theming (light/dark), real icons, a product-style sidebar layout. |

## Architecture

```
Browser ──▶ Next.js (:3000) ──▶ NestJS API (:3001) ──▶ PostgreSQL
                │                       │
                │                       ├──▶ Redis / BullMQ ──▶ Workers (sync · webhook · categorization)
                │                       │                              │
                └──▶ Pluggy Connect     ├──▶ Pluggy API (external) ◀───┘
                    (iframe, never      └──▶ Gemini API (external, categorization fallback)
                     touches our API)

Pluggy ──── webhook (new data available) ────▶ ngrok tunnel ──▶ NestJS API
```

Three things matter here: the bank-connection widget never talks to MoneyLens's
backend; anything slow or fallible (sync, categorization) is a queued job, never
part of a request/response cycle; and Pluggy — not MoneyLens — initiates the
webhook conversation when new data is ready.

## Getting started

### Prerequisites

- Node.js 20+, Docker Desktop
- A [Pluggy](https://dashboard.pluggy.ai) sandbox app (Client ID + Secret)
- A [Google Gemini](https://aistudio.google.com/apikey) API key
- [ngrok](https://ngrok.com) (for receiving real Pluggy webhooks locally)

### Setup

```bash
npm install

cp .env.example .env
# fill in DATABASE_URL secrets, PLUGGY_CLIENT_ID/SECRET, GEMINI_API_KEY, etc.

docker compose up -d postgres redis

npm run prisma:migrate
npm run prisma:seed

npm run dev:api    # http://localhost:3001 (Swagger at /api/docs)
npm run dev:web    # http://localhost:3000
```

To receive real Pluggy webhooks locally, run `ngrok http 3001`, set
`PLUGGY_WEBHOOK_URL` in `.env` to the resulting HTTPS URL, and restart the API —
it registers the webhook with Pluggy automatically on boot.

The Pluggy sandbox connector ("Pluggy Bank") accepts the test credentials
`user-ok` / `password-ok` for a successful connection, and a set of other
`user-*` values to simulate specific failure scenarios (locked account, MFA,
connection errors, and so on).

## Project structure

```
apps/
  api/    NestJS backend — auth, Pluggy integration, sync, webhooks,
          categorization, insights
  web/    Next.js frontend — dashboard, connections, transactions, insights
docker-compose.yml   Postgres + Redis for local development
```

## Testing

The full flow — auth, Pluggy sandbox sync (including a deliberately broken
connection), webhook delivery, hybrid categorization (including a real Gemini
call), insights, and multi-user data isolation — has been exercised end-to-end
against the live Pluggy sandbox and Gemini API, not mocks.
