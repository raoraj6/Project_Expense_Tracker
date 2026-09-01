# Expense Tracker — MERN + AI + DevOps

Track income and expenses. Full MERN stack (MongoDB, Express, React, Node) with JWT
auth, CRUD, search/filter, charts, an AI layer built on the Groq API, and a
containerised deploy with CI.

```
client/   React 18 + Vite + Recharts  → nginx (prod)
server/   Express 4 + Mongoose 8 + Groq SDK
mongo     MongoDB 7
```

---

## Quick start

### Option A — no MongoDB installed (fastest)

Runs the API against an ephemeral in-memory MongoDB and seeds a demo account.

```bash
cd server && npm install && npm run dev:mem
```

In a second terminal:

```bash
cd client && npm install && npm run dev
```

Open http://localhost:5173 and sign in with **demo@example.com / demo1234**.

> **macOS note:** port 5000 is often taken by the AirPlay Receiver. If the API fails
> with `EADDRINUSE`, run it on another port and point the dev proxy at it:
> `PORT=5001 npm run dev:mem` and `VITE_API_PROXY=http://localhost:5001 npm run dev`.

### Option B — your own MongoDB

```bash
cp server/.env.example server/.env      # then edit MONGO_URI / JWT_SECRET
cd server && npm install && npm run seed && npm run dev
cd client && npm install && npm run dev
```

### Option C — Docker Compose (production-shaped)

```bash
cp .env.example .env                    # set JWT_SECRET (required)
docker compose up --build
```

Open http://localhost:8080. nginx serves the built SPA and proxies `/api` to the API
container, so the browser sees a single origin. Mongo is not published to the host.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGO_URI` | yes | `mongodb://127.0.0.1:27017/expense_tracker` | Database connection |
| `JWT_SECRET` | yes in production | dev fallback | Signs auth tokens. `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime |
| `PORT` | no | `5000` | API port |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Allowed origins, comma-separated |
| `GROQ_API_KEY` | no | — | Enables the AI features. Without it they return 503 and the UI hides them. Free key: https://console.groq.com/keys |
| `GROQ_MODEL` | no | `openai/gpt-oss-120b` | Model used for AI calls |

The app is fully functional without `GROQ_API_KEY` — AI is an additive layer, not a
hard dependency.

**Model choice matters here.** The AI code relies on *strict* structured outputs
(`response_format: { type: 'json_schema', json_schema: { strict: true } }`), which on
Groq is supported only by `openai/gpt-oss-120b` and `openai/gpt-oss-20b`. Pointing
`GROQ_MODEL` at e.g. `llama-3.3-70b-versatile` will fail, because that model can only
do loose JSON mode with no schema enforcement. Use `openai/gpt-oss-20b` if you want
cheaper and faster; `120b` for better categorization judgement.

---

## Modules

### Income & Expenses
Full CRUD, scoped per user (every query filters by the authenticated user's id, so one
account can never read or mutate another's rows). Server-side validation via Zod, plus
a category/type consistency check — you cannot file `Salary` as an expense.

### Search & filter
Free-text search across note and category (regex-escaped so input can't act as a
pattern), plus filters on type, category, date range and amount range, four sort
orders, and paginated responses with `{ page, pages, total }`.

### Charts
- Income vs. expenses over time (line)
- Spending by category (donut)
- Top categories (horizontal bar)

Aggregation runs in MongoDB (`$group` / `$dateToString`), not in JS. The monthly trend
emits every month in the window including empty ones, so the line has no gaps.

### AI
Two features, both using **Groq chat completions with strict structured outputs**
(`response_format: json_schema`, `strict: true`), so responses are schema-enforced
rather than parsed out of prose:

1. **Auto-categorization** — type a note like `uber to the airport`, hit
   *✨ AI categorize*, and the model returns `{ type, category, confidence, reason }`
   constrained to the app's real category enum. Runs at `reasoning_effort: "low"`.
   Rows categorized this way are flagged with an `AI` badge.
2. **Spending insights** — turns aggregated totals into narrative insights plus a
   suggested per-category monthly budget, at `reasoning_effort: "medium"`.

The gpt-oss models are reasoning models; their chain of thought comes back in a
separate `reasoning` field, so `message.content` is clean JSON. Two things strict JSON
Schema can't express are enforced in code afterwards: that `confidence` lands in 0–1,
and that the returned category actually belongs to the returned type (the enum spans
both, so a schema-valid answer could still pair `Salary` with `expense`).

Only **aggregates** are sent for insights — never raw transaction notes. AI endpoints
are rate limited (15/min) since they cost money, and a missing key degrades to a clear
503 rather than a crash.

---

## API

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/health` | — | Liveness |
| `POST` | `/api/auth/register` | — | Rate limited 20/15min |
| `POST` | `/api/auth/login` | — | Rate limited 20/15min |
| `GET` | `/api/auth/me` | ✓ | Current user |
| `GET` | `/api/categories` | — | Valid categories per type |
| `GET` | `/api/transactions` | ✓ | Search, filter, sort, paginate |
| `POST` | `/api/transactions` | ✓ | Create |
| `GET` | `/api/transactions/:id` | ✓ | Read |
| `PATCH` | `/api/transactions/:id` | ✓ | Update |
| `DELETE` | `/api/transactions/:id` | ✓ | Delete |
| `GET` | `/api/stats` | ✓ | Summary + by-category + monthly trend |
| `GET` | `/api/ai/status` | — | Whether AI is configured |
| `POST` | `/api/ai/categorize` | ✓ | Structured categorization |
| `GET` | `/api/ai/insights` | ✓ | Structured insights + budget |

`GET /api/transactions` query parameters: `search`, `type`, `category`, `from`, `to`,
`minAmount`, `maxAmount`, `sort` (`date|-date|amount|-amount`), `page`, `limit`.

---

## Tests

```bash
cd server && npm test
```

19 integration tests run against a real MongoDB (spun up in-memory via
`mongodb-memory-server`) covering registration, duplicate-email and weak-password
rejection, login, credential-error opacity, unauthenticated access, CRUD, invalid
category/amount rejection, search hit and miss, cross-user isolation, aggregation
correctness, and AI-disabled behaviour.

---

## DevOps

**Containers.** Multi-stage builds for both services. The API image installs
production deps only and runs as the unprivileged `node` user; the client image builds
the SPA and ships it on nginx with immutable caching for hashed assets and an SPA
history fallback. Both declare healthchecks; Compose gates the API on Mongo's
healthcheck.

**CI** (`.github/workflows/ci.yml`) runs four jobs:

1. `server` — lint + the full test suite
2. `client` — lint + production build
3. `docker` — build both images with GitHub Actions layer caching
4. `smoke` — `docker compose up`, poll `/api/health` **through nginx**, and assert the
   SPA is served, then tear down

The smoke job is what catches the failures unit tests can't: a broken nginx proxy, a
bad Compose wiring, a service that builds but won't boot.

**Security posture.** helmet, CORS allowlist, bcrypt (cost 10), JWT bearer auth, Zod
validation on every write, rate limiting on auth and AI routes, a 100 kB body cap,
non-root container, Mongo unpublished to the host, and `passwordHash` stripped from
every serialized user.

---

## Verification status

Verified by running it: the API (health, auth, stats aggregation, search, filters,
sorting, 401 on unauthenticated access), the test suite (19/19), client lint and
production build, and the UI end-to-end in a browser — login, dashboard charts
rendering with correct values, live search, and creating a transaction through the form
and confirming it persisted.

**Not verified:** the two AI endpoints against the live Groq API, because no Groq
credentials were available in the build environment. Their request shapes follow the
documented strict structured-outputs API and the disabled-key path is covered by
tests, but the successful-response path has not been exercised. Set `GROQ_API_KEY`
(free at https://console.groq.com/keys) and try *✨ AI categorize* to confirm.

Docker Compose was also not run locally (Docker is not installed here); the CI smoke
job is what exercises it.
