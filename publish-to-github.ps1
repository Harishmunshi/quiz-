# ============================================================
# Islamic Quiz Competition — One-click publish to GitHub
# ============================================================
# Usage (any of these):
#   1. Double-click publish-to-github.bat
#   2. Right-click publish-to-github.ps1 -> Run with PowerShell
#   3. From terminal:  powershell -File publish-to-github.ps1
#
# What it does:
#   - Checks git / gh CLI
#   - Sets up git user.name + user.email (asks once if missing)
#   - Initializes repo, commits everything
#   - Uses `gh repo create` if available (creates + pushes in one go)
#   - Otherwise just sets the remote and pushes
# ============================================================

[CmdletBinding()]
param(
    [string]$RepoUrl = "",         # e.g. https://github.com/you/islamic-quiz-competition.git
    [string]$RepoName = "",        # only used if `gh` CLI is available
    [switch]$Private,              # make repo private (with `gh`)
    [string]$CommitMessage = "chore: publish to GitHub"
)

$ErrorActionPreference = 'Stop'
$ProgressPreference   = 'SilentlyContinue'   # faster; we draw our own progress

# ---- pretty helpers --------------------------------------------------
function Ok   { param($m) Write-Host "  $m" -ForegroundColor Green }
function Info { param($m) Write-Host "  $m" -ForegroundColor Cyan }
function Warn { param($m) Write-Host "  $m" -ForegroundColor Yellow }
function Err  { param($m) Write-Host "  $m" -ForegroundColor Red }
function Step { param($m) Write-Host "`n▶ $m" -ForegroundColor Magenta }

function Ask {
    param([string]$Prompt, [switch]$Secret)
    $ans = Read-Host $Prompt
    return $ans
}

# ---- header ----------------------------------------------------------
Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   Islamic Quiz Competition — Publish to GitHub      ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ---- preflight: git --------------------------------------------------
Step "Checking git…"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Err "git is not installed."
    Write-Host ""
    Write-Host "    Install one of these (your call):" -ForegroundColor White
    Write-Host "      • Git for Windows:           https://git-scm.com/download/win"
    Write-Host "      • GitHub Desktop (easiest):  https://desktop.github.com"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
$gitVersion = git --version
Ok $gitVersion

# ---- preflight: ensure we're in a git repo ---------------------------
Step "Checking repo…"
$here = (Get-Location).Path
if (-not (Test-Path "$here\.git")) {
    Warn "No .git folder here — initializing a fresh repo on branch 'main'."
    git init -b main | Out-Null
    Ok "Initialized empty git repo at $here"
} else {
    Ok "Existing repo found"
}

# ---- git identity (only ask once, then remember) --------------------
Step "Checking git identity…"
$userName  = (git config --global user.name  2>$null)
$userEmail = (git config --global user.email 2>$null)

if (-not $userName)  { $userName  = Ask "  Your name  (for commit author)"; git config --global user.name  $userName }
if (-not $userEmail) { $userEmail = Ask "  Your email (e.g. you@github.com)"; git config --global user.email $userEmail }
Ok "Commit author: $userName <$userEmail>"

# ---- commit anything that's uncommitted -----------------------------
Step "Staging files…"
git add -A
$status = git status --short
if ($status) {
    Warn "Uncommitted changes found — committing them now."
    git commit -m $CommitMessage | Out-Null
    Ok "Committed as '$CommitMessage'"
} else {
    Ok "Working tree clean — nothing new to commit"
}

# ---- pick path: gh CLI vs manual remote -----------------------------
$hasGh = [bool](Get-Command gh -ErrorAction SilentlyContinue)

# If user passed a repo name AND gh is available, create + push directly.
if ($RepoName -and $hasGh) {
    Step "Creating new GitHub repo '$RepoName' via gh CLI…"
    $visFlag = if ($Private) { "--private" } else { "--public" }
    gh repo create $RepoName $visFlag --source=. --remote=origin --push --description "M.E.S. English Medium School — Islamic Quiz Competition"
    if ($LASTEXITCODE -eq 0) {
        Ok "Repo created and pushed!"
        gh repo view --web --json url 2>$null | Out-Null
        Write-Host ""
        Write-Host "  Done. Open: https://github.com/$userName/$RepoName" -ForegroundColor Green
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 0
    }
    Err "gh repo create failed. Falling back to manual push…"
}

# Otherwise, ask for the URL if not provided.
if (-not $RepoUrl) {
    Write-Host ""
    Write-Host "  ────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "   Create an empty GitHub repo first (no README, no .gitignore):" -ForegroundColor White
    Write-Host "     https://github.com/new" -ForegroundColor Cyan
    Write-Host "  ────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host ""
    $RepoUrl = Ask "  Paste your repo URL (HTTPS or SSH)"
}

if (-not $RepoUrl) {
    Err "No repo URL provided. Aborting."
    Read-Host "Press Enter to exit"
    exit 1
}

# ---- configure remote -----------------------------------------------
Step "Configuring remote 'origin'…"
$existing = git remote get-url origin 2>$null
if ($existing) {
    if ($existing -eq $RepoUrl) {
        Ok "origin already points to $RepoUrl"
    } else {
        Warn "origin currently points to: $existing"
        Warn "Updating to: $RepoUrl"
        git remote set-url origin $RepoUrl
    }
} else {
    git remote add origin $RepoUrl
    Ok "origin set to $RepoUrl"
}

# ---- push ------------------------------------------------------------
Step "Pushing to GitHub…"
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Err "Push failed. Common causes:"
    Write-Host "      • No GitHub account / wrong repo URL"
    Write-Host "      • No Personal Access Token (HTTPS) — see QUICK-UPLOAD.md"
    Write-Host "      • No SSH key added (SSH) — see QUICK-UPLOAD.md"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# ---- done ------------------------------------------------------------
$webUrl = ($RepoUrl -replace '\.git$', '') -replace 'git@github.com:', 'https://github.com/'
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║   ✅  Published successfully!                          ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Info "View your repo: $webUrl"
Write-Host ""
Read-Host "Press Enter to exit"
