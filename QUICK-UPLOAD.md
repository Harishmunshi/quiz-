# 🚀 Quick Upload to GitHub — 3 Steps

This is the simplest path. If anything is unclear, ask and I'll walk you through it.

---

## Step 1 — Make sure you have git

Open **PowerShell** (Win + X → "Windows PowerShell" or "Terminal") and run:

```powershell
git --version
```

- ✅ If you see a version (e.g. `git version 2.47.1`) → you're good, jump to Step 2.
- ❌ If you see "not recognized" → install it from <https://git-scm.com/download/win> (default Next-Next-Next is fine), then re-open PowerShell and check again.

---

## Step 2 — Create an empty GitHub repo

1. Go to <https://github.com/new> (sign in if asked).
2. **Repository name:** `islamic-quiz-competition` (or whatever you like).
3. **Description (optional):** `M.E.S. English Medium School — Islamic Quiz Competition`.
4. **Public** or **Private** — your call.
5. ⚠️ **Do NOT** tick "Add a README", "Add .gitignore", or "Choose a license" — the project already has these.
6. Click **Create repository**.
7. On the next page, copy the URL under **"…or push an existing repository from the command line"**. It looks like:
   - `https://github.com/<your-username>/islamic-quiz-competition.git` (HTTPS), or
   - `git@github.com:<your-username>/islamic-quiz-competition.git` (SSH)

---

## Step 3 — Run the one-click script

In your project folder (`C:\Users\Harish\Downloads\gcat webpage\islamic-quiz-competition\`):

### Option A — double-click (easiest)
Double-click **`publish-to-github.bat`**. A PowerShell window pops up. It will:

- check git
- ask your name + email once (then remember it)
- commit anything uncommitted
- ask for the repo URL → paste the URL from Step 2
- push

That's it. The window stays open at the end so you can read the success message.

### Option B — from PowerShell
```powershell
cd "C:\Users\Harish\Downloads\gcat webpage\islamic-quiz-competition"
.\publish-to-github.ps1
```

### Option C — skip the prompts
```powershell
.\publish-to-github.ps1 -RepoUrl "https://github.com/YOU/REPO.git"
```

---

## 🔐 If the push asks for a password — use a Personal Access Token (PAT)

GitHub no longer accepts account passwords for git operations. You'll need a **PAT**:

1. Go to <https://github.com/settings/tokens> → **Generate new token** → **Fine-grained token** (recommended) or **Classic**.
2. For the **classic** token (simpler), give it scope: `repo` (full control of private repositories).
3. Set an expiry (30/60/90 days).
4. Click **Generate token** and **copy the token immediately** — you won't see it again.
5. When the script (or `git push`) asks for your password, paste this token instead.

💡 On Windows, the **Git Credential Manager** will remember it for next time.

---

## 🆘 Common issues

### "Permission denied (publickey)" — SSH keys not set up
Either:
- Switch to HTTPS URL (`https://github.com/...`) and use a PAT, or
- Set up SSH keys: <https://docs.github.com/en/authentication/connecting-to-github-with-ssh>

### "Authentication failed" — PAT expired or wrong scope
Regenerate the token with `repo` scope and try again.

### "Repository not found" — wrong URL or no access
Double-check the URL and that you're signed in to the right GitHub account.

### "src refspec main does not match any" — no commits yet
Run `git log` first. If empty, the script should have made the initial commit already; if it didn't, run:
```powershell
git add -A
git commit -m "initial commit"
.\publish-to-github.ps1
```

### "Updates were rejected because the remote contains work that you do not have locally"
Someone (or you from the web) pushed to the repo first. Either:
```powershell
git pull --rebase origin main
git push
```
…or recreate the empty repo on GitHub (with no README/license) and push again.

---

## 🅰️ Even easier: GitHub Desktop

If you'd rather not touch the terminal at all:

1. Install **GitHub Desktop** from <https://desktop.github.com>.
2. Sign in to your GitHub account.
3. **File → Add local repository…** → pick `C:\Users\Harish\Downloads\gcat webpage\islamic-quiz-competition`.
4. Click **"Publish repository"** in the top bar.
5. Done. One click.

---

## 🤖 Want me to do it for you?

If you give me:
- your **GitHub username**, and
- a **Personal Access Token** with `repo` scope (you can revoke it after),

…then I can create the repo and push it for you right now. Otherwise the script is your one-click path.
