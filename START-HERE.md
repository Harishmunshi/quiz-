# Start here — two steps, in this order

You are not doing anything wrong. GitHub's web uploader silently throws away folder
paths when you pick files instead of dragging folders — that trips up people who do this
for a living. And the reason your site is down at all is that I told you to edit a
setting and didn't warn you how easily that particular value breaks. So: two steps, and
we skip GitHub entirely.

---

# STEP 1 — Fix the database setting

**Nothing else matters until this is done.** Your site returns an error on every page
right now, and new code won't change that.

### What's wrong

Vercel's logs, once a minute for hours:

```
Error validating datasource `db`:
the URL must start with the protocol `postgresql://` or `postgres://`
```

The `DATABASE_URL` value in Vercel is no longer a full database address. Something in
the edit lost the front of it.

### Getting the right value

1. Go to **supabase.com** → your **quiz** project.
2. Click the **Connect** button at the top of the page.
3. Pick **Transaction pooler** (port **6543**). Not "Direct connection" — that address
   doesn't exist for your project.
4. Copy the whole line. It looks like:

```
postgresql://postgres.fzngwfydwhybczemnjfa:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

5. Replace `[YOUR-PASSWORD]` (including the square brackets) with your database password.

   **If your password has any of these characters, swap them out:**

   | In your password | Type this instead |
   |---|---|
   | `@` | `%40` |
   | `#` | `%23` |
   | `/` | `%2F` |
   | `?` | `%3F` |
   | `:` | `%3A` |

   A raw `@` in the password is one of the most common ways this exact value breaks.

6. Add this to the very end, no space before it:

```
?pgbouncer=true&connection_limit=5&pool_timeout=20
```

### Putting it into Vercel

1. **vercel.com** → project **quiz** → **Settings** → **Environment Variables**
2. Find `DATABASE_URL` → **Edit**
3. Delete everything in the box, paste the new value as **one single line**.
   No quotes. No spaces. No line breaks.
4. Make sure **Production** is ticked. Save.
5. Go to **Deployments** → newest one → **⋯** → **Redeploy**.
   Vercel does not pick up a settings change until you redeploy.

### Check it

Open this in your browser:

```
https://quiz-seven-omega-15.vercel.app/api/competition
```

- Text containing **`"success":true`** → fixed, site is alive.
- An error page → still wrong. Send me a screenshot of the Vercel log and I'll read it.

Before you save, glance at the value: it should **start with `postgresql://postgres.`**
and contain exactly **one `@`** that isn't part of your password.

---

# STEP 2 — Get the new code live, without GitHub

Forget the drag-and-drop. There's a way that doesn't care about folder structure at all.

1. Put **`DEPLOY-NOW.bat`** inside your **`quiz-source-full`** folder — the same folder
   that has `package.json` and `src` in it.
2. **Double-click it.**
3. It asks three things:
   - A browser opens to sign in to Vercel → approve it, come back.
   - `Link to existing project?` → **y**
   - `What's the name of your existing project?` → **quiz**
4. Wait two or three minutes. It prints a link when it's finished.

That uploads the folder exactly as it is on your disk, straight to your existing Vercel
project, keeping every setting and environment variable you already have. GitHub isn't
involved.

**It needs Node.js.** If the script says Node is missing, install the LTS version from
[nodejs.org](https://nodejs.org), then double-click again.

If any step fails, copy everything in the black window and send it to me.

---

## Should we rebuild from scratch instead?

**No — and I want to be direct about why.** Your code is not the problem and hasn't been
for a while. I've had it running in a browser here all day: Round 2 loads, questions
render, taps register, answers submit, the leaderboard animates, the admin controls
fire. Every test passes.

What has actually gone wrong is two things, neither of them the app:

- one text field in Vercel got mangled — a five-minute fix
- getting files from me to you, because I'm blocked from pushing to your GitHub

Starting from zero would throw away 30 Round 1 questions, the ordering engine, the live
control panel, the projector board, the scoring rules and the participant records —
weeks of work — and would land you in exactly the same two problems on the other side,
with an event to run. It would be the wrong call, and I'd be doing you a disservice by
agreeing to it.

---

## What I'd like to fix properly, after the event

I couldn't push to your GitHub because the repository wasn't authorised for this session,
and that's decided when a task starts. Next time, start a new Cowork task and connect the
GitHub repository as a source while setting it up. In a session where the repo is
authorised, I commit directly and none of this file-shuffling happens again.

Also, if you haven't yet: revoke the access token you pasted earlier.
GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) →
Delete.
