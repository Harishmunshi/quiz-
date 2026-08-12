# 🚀 Deployment Guide — Islamic Quiz Competition

> The shortest, most honest path to get this app live for the school.

---

## TL;DR

| Question | Answer |
|---|---|
| Do I need Supabase? | **Yes**, for the database. |
| Do I need Vercel? | **Yes**, to host the website. |
| Can I use Vercel alone? | **No.** Vercel = code only, no database. |
| Is Supabase free? | **Yes**, the free tier is plenty for one school event. |
| Total cost? | **₹0 / $0** for the school event (within free tiers). |

**You need both. They're two different things.**

---

## 🧠 Why both? (Read this once)

Your app has two parts:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   PART 1: THE WEBSITE (the buttons, the quiz UI, the leaderboard)  │
│   ────────                                                          │
│   Lives on: VERCEL                                                  │
│   What it is: a Next.js app — a bunch of code that runs in the      │
│              browser + small server functions for the API           │
│                                                                     │
│   PART 2: THE DATABASE (where scores, names, classes are stored)   │
│   ────────                                                          │
│   Lives on: SUPABASE (Postgres)                                    │
│   What it is: a real database in the cloud, always on, persistent  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

You **cannot** host the website on Vercel and put the database "inside Vercel" — Vercel doesn't do that. You'd lose all your data every time the site redeploys.

You **can** put the database "inside Supabase" — it's literally what Supabase is for.

---

## 📐 How data flows (the leaderboard, end-to-end)

```
                          ┌──────────────────────┐
   STUDENT'S PHONE        │  VERCEL (your code)  │       SUPABASE (Postgres)
   ──────────────         │  ──────────────────  │       ──────────────────
                          │                      │
   1. Opens /quiz/english │                      │
       │                 │                      │
       ▼                  │                      │
   2. Registers           │                      │
      (name, class,       │                      │
       division)          │                      │
       │                  │                      │
       │  POST /api/      │                      │
       │  participant     │                      │
       ├─────────────────▶│  3. INSERT into     │
       │                  │     participants ───▶│
       │                  │     table            │
       │                  │                      │
       │  Answer Q1       │                      │
       │  ...Q2...Q20     │                      │
       │                  │                      │
       │  POST /api/      │                      │
       │  round1/submit   │                      │
       ├─────────────────▶│  4. Read correct    │
       │  { all answers } │     answer key from  │
       │                  │     DB (server-side, │
       │  ◀─────────────  │     never sent to    │
       │  { score, time } │     browser)         │
       │                  │                      │
       │                  │  5. INSERT into      │
       │                  │     round1_attempts  │
       │                  │     + round1_answers │
       │                  │     ────────────────▶│
       │                  │                      │
                          │                      │
                          │                      │
   PROJECTOR / PHONE      │                      │
   (leaderboard view)     │                      │
   ───────────────────    │                      │
                          │                      │
   6. Open                │                      │
      /display/           │                      │
      leaderboard         │                      │
       │                  │                      │
       │  GET /api/       │  7. SELECT * FROM   │
       │  leaderboard/    │     round1_attempts  │
       │  round1          │     ORDER BY score   │
       │  (every 4 sec)   │     DESC, time ASC ──│
       ├─────────────────▶│                      │
       │                  │  ◀────────────────── │
       │  ◀─────────────  │  { rank, name,       │
       │  { top 50 }      │    class, time }     │
       │                  │                      │
       │  Renders new     │                      │
       │  leaderboard     │                      │
       │  (no refresh)    │                      │
                          │                      │
```

**Key things to notice:**

1. **The browser never sees the correct answer.** The student sends `{ questionId, "B" }` and the server compares it with the correct option stored in the database. Even if a student opens DevTools, they can't cheat.

2. **The browser is NEVER the source of truth for timing.** The server records `started_at` and `submitted_at`. The on-screen stopwatch is just for visual feedback.

3. **Polling, not WebSockets.** The leaderboard refreshes every 4 seconds. For ~50 concurrent students on a projector, this is plenty. (If you later want true realtime, the Supabase migration already leaves room for it.)

---

## 🛠 Step-by-step deployment (10 minutes total)

### Step 1 — Set up Supabase (5 minutes, free)

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub
2. Click **"New Project"**
3. Pick a name (e.g., `mes-islamic-quiz`), set a strong **database password** (save it somewhere!), pick a region close to you
4. Click **Create new project** — wait ~1 minute for it to provision

Once it's ready:

5. In the left sidebar → **SQL Editor**
6. Click **"+ New query"**
7. Open this file from the project: **`supabase/migrations/001_initial_schema.sql`**
8. Copy the entire contents → paste into the Supabase SQL Editor
9. Click **Run** (or Ctrl+Enter)
10. You should see "Success. No rows returned" — that means all 8 tables + RLS + 2 leaderboard views were created

**Grab your credentials (you'll need them in Step 3):**
- Go to **Project Settings** (gear icon) → **API**
- Copy these 3 things:
  - **Project URL** (looks like `https://abcdefg.supabase.co`)
  - **`anon` `public` key** (long string starting with `eyJ...`)
  - **`service_role` key** (long string — KEEP THIS SECRET, server-only)

---

### Step 2 — Push your code to GitHub

Already done! Your repo is at <https://github.com/Harishmunshi/quiz->.

If you make any code changes later:
```powershell
cd "C:\Users\Harish\Downloads\gcat webpage\islamic-quiz-competition"
git add -A
git commit -m "describe what you changed"
git push
```

---

### Step 3 — Deploy to Vercel (3 minutes, free)

1. Go to <https://vercel.com** → sign in with GitHub
2. Click **"Add New…"** → **"Project"**
3. Find and **Import** the `Harishmunshi/quiz-` repo
4. **Before clicking Deploy**, click **"Environment Variables"** and add these 7:

   | Name | Value | Where to find it |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefg.supabase.co` | Supabase → Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (long string) | Supabase → API → `anon` `public` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (long string) | Supabase → API → `service_role` (secret!) |
   | `DATABASE_URL` | `postgresql://postgres:PASSWORD@db.abcdefg.supabase.co:6543/postgres` | Supabase → Project Settings → Database → Connection string → Transaction |
   | `JWT_SECRET` | any long random string | generate one at <https://generate-secret.vercel.app/32> |
   | `ADMIN_BOOTSTRAP_EMAIL` | `admin@mes.edu` | whatever you want (this is the first admin login) |
   | `ADMIN_BOOTSTRAP_PASSWORD` | (strong password) | change from `admin123` for production! |

5. Click **Deploy**
6. Wait ~1-2 minutes for the build to complete
7. Vercel gives you a URL like `https://quiz-xxxxx.vercel.app` — that's your live site! 🎉

---

### Step 4 — One-time: seed your data

After the first deploy, you need to create the first admin user and the default settings.

**Easiest way:**
1. Visit `https://your-app.vercel.app/api/seed` (POST request)
2. In your browser, open the URL — but it needs to be a POST. Use this instead:
   ```powershell
   Invoke-WebRequest -Uri "https://your-app.vercel.app/api/seed" -Method POST
   ```
3. This creates the default settings row, the admin user, 10 sample questions, and 3 Round 2 challenges

**OR** open the admin panel:
1. Visit `https://your-app.vercel.app/`
2. Click the gear icon (top right) → Admin Login
3. Log in with the bootstrap credentials you set
4. Manually add questions through the admin panel

---

### Step 5 — Test the full flow

Visit your Vercel URL on a phone (or scan a QR code pointing to it):
1. Click **Round 1** → register → answer the 10 sample questions
2. Submit → see your score
3. Go to **/leaderboard** → see yourself
4. Open the same URL in a second tab/phone → register as a different student
5. Submit → leaderboard updates within 4 seconds

---

## 🔒 Pre-event checklist (the night before)

- [ ] All 10 (or 20) Round 1 questions entered with correct answers
- [ ] All 3+ Round 2 challenges configured
- [ ] Test mode is **OFF** in admin settings (so test data doesn't show on the projector)
- [ ] Admin password is changed from `admin123`
- [ ] Test the full student flow on 2-3 different phones
- [ ] Projector / TV is on the `/display/leaderboard` URL
- [ ] Print the QR code (`/display/qr`) at A3 size
- [ ] Mobile hotspot ready as backup (in case school WiFi flakes)

---

## 💰 Cost summary

| Service | Free tier | Sufficient for school event? |
|---|---|---|
| **Vercel** | 100 GB bandwidth, unlimited sites | ✅ Yes |
| **Supabase** | 500 MB database, 2 GB bandwidth | ✅ Yes (1 event = a few MB) |
| **GitHub** | Unlimited public repos | ✅ Yes |
| **Total** | **₹0 / $0** | |

---

## 🆘 If something goes wrong on the day

**Site down?**
- Check Vercel dashboard for build/runtime errors
- Vercel keeps the previous deploy live if a new build fails — your data is safe

**Leaderboard not updating?**
- Check the "RECONNECTING…" indicator on the leaderboard
- If it shows OFFLINE for >30 sec, refresh the page (Cmd+R / Ctrl+R)
- The 4-second polling will pick up where it left off

**Database connection error?**
- Verify the `DATABASE_URL` in Vercel env vars matches the current Supabase connection string
- Supabase occasionally rotates passwords — check Project Settings → Database

**Panic button: roll back**
- Vercel → Project → Deployments → click any previous successful deploy → **Promote to Production**
- Takes 30 seconds, zero data loss

---

## 📞 Quick reference

- Your repo: **https://github.com/Harishmunshi/quiz-**
- Supabase dashboard: **https://supabase.com/dashboard**
- Vercel dashboard: **https://vercel.com/dashboard**
- Re-deploy docs: see `README.md` in the repo
- Local development: see `README.md` → "Local setup"
