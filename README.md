# Call Guide

The screen a caller keeps open beside the phone on a cold call. It keeps them on the eight-stage structure of the call, shows what prospects tend to say at each point, records what happened with one tap, keeps a box for the prospect's own words, and saves the call. A second screen lists past calls and the stage each one reached.

| | |
|---|---|
| **Live app (Vercel)** | `TODO: paste your Vercel URL` |
| **API health (Render)** | `TODO: https://<your-service>.onrender.com/health` |
| **Database** | Supabase (Postgres), schema in [`supabase/schema.sql`](supabase/schema.sql) |
| **LLM** | Gemini (Google AI Studio), called only from the backend. See "The LLM" below |

The Render free tier sleeps when idle. The first request after a pause can take up to a minute; the app shows a "waking the server" banner and retries instead of failing.

## How it is built

```
frontend/   React + Vite, mobile-first.       -> Vercel
backend/    Node + Express API.               -> Render
supabase/   schema.sql, seed.sql (invented demo rows)
```

Backend endpoints:

| | |
|---|---|
| `POST /api/calls` | start a call |
| `PUT /api/calls/:id/stages/:n` | save one stage: taps pressed, the prospect's words, small extra fields |
| `POST /api/calls/:id/check` | outcome check (LLM, with a rules fallback). Saves nothing but the check result |
| `POST /api/calls/:id/close` | close the call with outcome, summary, flags |
| `GET /api/calls`, `GET /api/calls/:id` | past calls, and one call with its stages |
| `GET /health` | answers when the backend is up. `/health?deep=1` also checks the database |

The browser never talks to Supabase. The backend holds the service-role key and the Gemini key.

## What the screen is built from

I read the 100 call transcripts and the call-structure page to decide what each stage shows. The transcripts are not in this repo and nothing below quotes them; the wording in [`frontend/src/stages.js`](frontend/src/stages.js) is my paraphrase of patterns.

What the reading changed:

- **Calls end early.** The caller's own logged outcomes across the 100 calls: not interested 14, report agreed 14, follow-up 14, not logged 13, next step agreed 11, do not call 10, wrong person 8, interested 7, moved company 5, call again 4. Few reach a fixed next step. So "End call" is on every stage, and the past-calls screen is a bar chart of the stage each call reached, tappable to filter.
- **Stage 1 is an identity check.** Many calls never reach the listed person: stale numbers, people who left, reception. Stage 1 taps cover those cases and a flag marks the contact record as stale.
- **Some calls are follow-ups, not cold calls.** A call is either a first call or a follow-up on a sent report; the "they may say" lines and taps at the opening and purpose stages change with it.
- **"Why is it free?" and "what do you do?"** come up at the purpose stage in a large share of calls. Stage 2 shows one plain sentence and the questions that follow it.
- **A "yes" is often politeness.** Stage 7 records who named the time (them or us), the channel, and whether the yes came after a no. "Next step set" needs a day or time the prospect named.
- **Logged outcomes drift from what was said.** The README of the transcripts warns about this, and reading them confirms it: for example, a redirect or a busy prospect logged as "do not call". That drove the LLM feature.
- **Stage 5 is the only place the prospect's exact words matter.** It has the larger box and an open question to ask instead of yes/no questions.

## The LLM, and why that one

**What it does:** at the Close stage, Gemini reads what was tapped and typed during the call plus the outcome the caller picked, and returns a suggested outcome, how firm the next step is (none / weak / firm), a one-line summary, and, when the caller's pick disagrees with the call, one sentence on what disagrees. The caller can accept the suggestion, accept only the summary, or ignore it and save anyway. Past calls show a flag where the saved outcome differs from the check.

**Why this and not the others:**

- *Suggesting the stage as the caller types* would put a wrong guess in front of someone mid-sentence. A wrong suggestion at the end of the call costs nothing.
- *Turning the prospect's words into fields* is the one thing the product must never get wrong: the prospect's words are the record the next call is built on. The LLM never writes to them; the check is read-only on the words.
- *Outcome logging* is where the transcripts show people going wrong, and it is language-heavy: "bhej dijiye", "chalega", "dekhte hain" are soft yeses that keyword rules miss, in English, Hindi, Hinglish and Marathi.

**Failure handling:** the key stays on the backend; calls time out after 12 seconds; the output is a JSON schema and is validated, and the outcome must be one of the nine ids. On any failure (no key, timeout, quota, bad output) the same endpoint falls back to a rules check over the taps and says so in the response (`source: "rules"`, `fallback_reason`). The check is rate-limited per IP. The prospect's words are sent as data with an instruction to ignore instructions inside them.

Model is set by `GEMINI_MODEL` (default `gemini-2.5-flash`); change it if Google retires that name.

## Run it locally

```bash
# backend (uses an in-memory store when Supabase is not configured)
cd backend && npm install && cp .env.example .env && npm start
npm test            # 22 tests: rules, API round trip, Gemini adapter, frontend/backend tap ids in sync

# frontend
cd frontend && npm install && cp .env.example .env && npm run dev
```

`/health` reports `"db": "memory"` or `"db": "supabase"`, so you can tell which store is live.

## Deploy

1. **Supabase:** new project. SQL editor: run `supabase/schema.sql`, then optionally `supabase/seed.sql`. Copy the project URL and the `service_role` key (Project settings, API).
2. **Gemini:** create a free key at https://aistudio.google.com/apikey.
3. **Render:** New Web Service from this repo, root directory `backend`, build `npm install`, start `npm start`, health check path `/health` (or use `render.yaml`). Environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and later `FRONTEND_ORIGIN` (your Vercel URL).
4. **Vercel:** import the repo, root directory `frontend`, framework Vite, environment variable `VITE_API_URL` set to the Render URL.
5. Set `FRONTEND_ORIGIN` on Render to the Vercel URL, redeploy, then check `/health?deep=1` returns `"db_reachable": true`.

## Known limits

- **No login.** It is a single-caller tool built in 48 hours: anyone with the URL can see the calls. The seed rows are invented. Next step would be Supabase Auth and per-user rows.
- **The Supabase path and the Gemini call were not exercised against live services while building.** Both are covered by tests against stand-ins (an in-memory store with the same interface; a mocked `fetch`). Check `/health?deep=1` and press "Check this against the call" once after deploying.
- **Notes are saved as you type**, with a short debounce. If the connection drops, the screen says "Not saved, will retry" and retries on the next change, on moving stage, and on save. A call that fails to close keeps its notes.
- An unfinished call survives a page refresh (stored in the browser) so a caller does not lose the screen mid-call.
