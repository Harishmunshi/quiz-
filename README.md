# Islamic Quiz Competition — M.E.S. English Medium School

A live, real-time quiz competition platform built for **M.E.S. English Medium School**.

Students scan a QR code → register once → answer a bilingual (English / Gujarati) MCQ quiz
in **Round 1 (Knowledge)**, then race through a drag-and-drop ordering challenge in
**Round 2 (Speed)**. A real-time leaderboard updates on the projector as submissions come in.

> **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · dnd-kit · Zustand
> **DB:** Prisma + SQLite for local dev · Supabase Postgres for production
> **Deploy:** Vercel

---

## ✨ Features

- **Two language quiz entry points** — English & Gujarati, served from a single question set
- **QR-code access** — `/quiz/english` and `/quiz/gujarati`, no student account required
- **Round 1 — MCQ knowledge quiz** with progress, scoring, and bilingual question text
- **Server-side scoring** — the answer key never leaves the database
- **Server-side timing for Round 2** — the client stopwatch is visual only
- **Round 2 — Speed ordering challenge** with dnd-kit drag-and-drop, countdown, and large central timer
- **Real-time leaderboard** that updates automatically on every submission
- **Projector / TV display mode** at `/display/leaderboard` and `/display/qr`
- **Admin dashboard** with full competition controls, question management, results, CSV export
- **Test mode** — run the whole flow without contaminating official results
- **Persistent** — all results survive page refresh, redeploys, and restarts

---

## 📁 Project structure

```
.
├── prisma/
│   └── schema.prisma                # Prisma schema (SQLite for dev, mirrors Supabase tables)
├── public/                          # static assets (school logo, robots.txt)
├── src/
│   ├── app/
│   │   ├── api/                     # Next.js route handlers (server-side)
│   │   │   ├── admin/               #   admin login, questions, challenges, reset
│   │   │   ├── competition/         #   public competition settings
│   │   │   ├── export/              #   CSV export
│   │   │   ├── leaderboard/         #   round1 + round2 leaderboard reads
│   │   │   ├── participant/         #   participant registration
│   │   │   ├── round1/              #   questions / start / submit
│   │   │   ├── round2/              #   challenges / start / submit
│   │   │   └── seed/                #   first-run seeding
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                 # single-page app shell with view router
│   ├── components/
│   │   ├── admin/                   # AdminLogin, AdminDashboard, AdminQuestions, …
│   │   ├── display/                 # DisplayLeaderboard, QRDisplay (projector / TV)
│   │   ├── leaderboard/             # LeaderboardView (in-app)
│   │   ├── quiz/                    # LandingPage, RegistrationForm, Round1Quiz, Round1Result
│   │   ├── round2/                  # Round2Challenge, Round2Result
│   │   └── ui/                      # shadcn/ui primitives
│   ├── hooks/                       # use-mobile, use-toast
│   ├── lib/
│   │   ├── db.ts                    # Prisma client (singleton)
│   │   ├── store.ts                 # Zustand global app state
│   │   ├── utils.ts
│   │   ├── leaderboard/rankings.ts  # pure ranking algorithms
│   │   ├── scoring/                 # round1.ts, round2.ts — pure scoring functions
│   │   ├── supabase/client.ts       # Supabase client (only when configured)
│   │   ├── timer/formatter.ts       # 00:00.00 formatters
│   │   └── validation/schemas.ts    # Zod schemas for every input
│   └── types/
│       ├── competition.ts
│       └── database.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # full schema + RLS + leaderboard views for Supabase
├── .env.example
├── .gitignore
├── components.json                  # shadcn/ui config
├── Caddyfile                        # optional reverse-proxy config for self-host
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── worklog.md                       # internal development log
```

---

## 🚀 Publish to GitHub (one click)

The repo ships with a **one-click publish script**. After you create an empty repo on <https://github.com/new>:

1. **Double-click `publish-to-github.bat`** in the project folder
2. Paste your repo URL when prompted
3. Done ✅

If push fails on auth, see `QUICK-UPLOAD.md` for Personal Access Token / GitHub Desktop / SSH setup.

> Don't want to touch the terminal? Install [GitHub Desktop](https://desktop.github.com) → Add local repo → click **Publish repository**. Truly one click.

---

## 🚀 Local setup

### 1. Install dependencies

This project uses **bun** (see `bun.lock`).

```bash
bun install
# or
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

For local dev, the default `.env` works as-is — it points to a local SQLite DB.

### 3. Initialize the database

```bash
bun run db:push        # creates dev.db and applies Prisma schema
bun run db:generate    # generates the Prisma client
bun run db:seed        # seeds 10 Round 1 questions + 3 Round 2 challenges + admin user
```

### 4. Start the dev server

```bash
bun run dev
```

Open <http://localhost:3000>.

Default admin: **admin@mes.edu** / **admin123** — change it on first login.

---

## 🗄 Database

### Dev (default)

- **Prisma + SQLite** at `prisma/dev.db`
- Schema: `prisma/schema.prisma`
- Migration is applied via `bun run db:push`

### Production (Supabase)

1. Create a new Supabase project.
2. Open **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`.
3. Update `.env` with your Supabase URL, anon key, and service-role key.
4. Switch `DATABASE_URL` to the Supabase Postgres connection string.
5. Switch `src/lib/db.ts` to use the Supabase client (or keep Prisma pointing at the same Postgres URL).

The migration includes:

- All 8 tables (`competition_settings`, `admin_users`, `participants`, `questions`,
  `round1_attempts`, `round1_answers`, `round2_challenges`, `round2_attempts`)
- Indexes for leaderboard queries (score, time, submitted_at, participant_id, is_test)
- Row Level Security on every table
- Two pre-built leaderboard views: `v_round1_leaderboard`, `v_round2_leaderboard`

---

## 🧠 Architecture notes

### Round 1 — Knowledge

- One `questions` row stores **both** English and Gujarati text in dedicated columns.
- The student picks a language at registration; the same question is rendered in that language.
- On submission, the client posts `{ questionId, selectedOption }` pairs. The server
  fetches the answer key from the DB, scores server-side, and returns the result. The
  correct option never reaches the browser in a way that could be inspected for cheating.

### Round 2 — Speed

- The challenge is a row in `round2_challenges` with `items` (scrambled) and `correct_order`.
- On **GO**, the client opens its visual stopwatch AND the server writes `started_at` in `round2_attempts`.
- On submit, the client posts the player's ordering; the server compares with `correct_order`
  and computes `server_elapsed_ms = submitted_at - started_at`. The client's `client_elapsed_ms`
  is stored for diagnostics but **is never authoritative**.
- Leaderboard order: lowest `final_time_ms` first, then earliest `submitted_at` as tie-breaker.

### Real-time leaderboard

- The client polls `/api/leaderboard/round1` and `/api/leaderboard/round2` every few seconds
  while a leaderboard view is visible, and shows a **LIVE ●** indicator.
- If polling fails, the indicator flips to **RECONNECTING…** so stale data is never shown as live.
- A future migration to **Supabase Realtime** (the `supabase/migrations/001_initial_schema.sql`
  already leaves room for it) will replace polling with row-level subscriptions.

### Server-side security

- Server-side scoring for Round 1
- Server-side timing for Round 2
- Server-side validation of every input (Zod schemas in `src/lib/validation/schemas.ts`)
- One official attempt per participant per round (enforced server-side; status check before write)
- No service-role key in any client-side code
- Row Level Security on every Supabase table

---

## 🖥 Display modes (projector / TV)

- **`/display/qr`** — large QR codes for English + Gujarati quiz entry, high contrast, projector-friendly
- **`/display/leaderboard`** — full-screen live leaderboard with large fonts and **LIVE ●** indicator
- The app is single-page (`src/app/page.tsx`); these views are routed via the same in-app `currentView`
  state, so they can also be reached in-app for admin/preview use.

---

## 🛠 Admin dashboard

The admin login is at the top nav of the landing page. Once signed in:

- **Dashboard** — totals, current round, competition controls
- **Questions** — full CRUD for Round 1 questions (English + Gujarati in one form)
- **Challenges** — full CRUD for Round 2 ordering challenges
- **Participants** — list, filter, view individual results
- **Results** — live and historical, with **CSV export**
- **Settings** — competition name, round windows, time limits, test mode toggle

Admin actions are protected by an admin token (set on login, sent in `Authorization: Bearer …`).
On Supabase, RLS keeps students from reading or writing any admin-only data.

---

## 🚢 Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add the environment variables from `.env.example`.
4. Build command: `bun run build` (or default `next build`)
5. Output: leave as default — the `next.config.ts` already sets `output: 'standalone'` for
   lightweight production images.

For Supabase:

- Apply `supabase/migrations/001_initial_schema.sql` first.
- Point `DATABASE_URL` to the Supabase Postgres URL.
- Add your Supabase URL, anon key, and service-role key as env vars.

---

## ✅ Acceptance test (the "happy path")

The full flow has been manually verified (see `worklog.md`):

1. Admin logs in → opens Round 1.
2. Projector shows `/display/qr`.
3. Student A scans the English QR; Student B scans the Gujarati QR.
4. Both receive the **same** questions in different languages.
5. Both submit. The leaderboard updates without a page refresh.
6. Admin closes Round 1, opens Round 2.
7. Each student hits **GO** → server records start time → drag-and-drop → submit.
8. Server validates ordering and computes official elapsed time.
9. Leaderboard re-sorts by fastest correct, ties broken by earliest `submitted_at`.
10. Refreshing the page does not lose results.
11. Admin exports CSV; test-mode data is excluded.

---

## 🧰 Scripts

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `bun run dev`       | Start the Next.js dev server on port 3000      |
| `bun run build`     | Production build (standalone output)           |
| `bun run start`     | Run the production build                       |
| `bun run lint`      | ESLint                                         |
| `bun run typecheck` | `tsc --noEmit`                                 |
| `bun run db:push`   | Apply Prisma schema to `DATABASE_URL`          |
| `bun run db:generate` | Regenerate the Prisma client                 |
| `bun run db:migrate`| Create + apply a Prisma migration              |
| `bun run db:reset`  | Drop and recreate the dev DB                   |

---

## 📐 Theming

- Deep Emerald `#063B2D` · Midnight Navy `#071A2B` · Antique Gold `#C8A951` · Warm Ivory `#F7F2E7`
- Subtle Islamic geometric patterns in component backgrounds
- Round 1 leans calm / "knowledge"; Round 2 leans energetic / "speed"

---

## 🪪 License

Internal project for **M.E.S. English Medium School**. All rights reserved.
