@echo off
REM ===================================================================
REM  Deploy the quiz site straight to Vercel.
REM
REM  No GitHub. No folder dragging. No git commands.
REM  Put this file INSIDE the quiz-source-full folder and double-click it.
REM ===================================================================

cd /d "%~dp0"

echo.
echo  ================================================================
echo   M.E.S. Islamic Quiz  -  deploy to Vercel
echo  ================================================================
echo.
echo   Folder: %CD%
echo.

if not exist "package.json" (
  echo   [X] There is no package.json here.
  echo.
  echo   This file has to sit INSIDE the quiz-source-full folder,
  echo   next to package.json and the src folder.
  echo   Move it there and double-click it again.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js is not installed.
  echo.
  echo   Install the LTS version from https://nodejs.org
  echo   then run this file again.
  echo.
  pause
  exit /b 1
)

echo   [1/3] Signing in to Vercel.
echo         A browser window will open. Approve it, then come back here.
echo.
call npx --yes vercel@latest login
if errorlevel 1 goto failed

echo.
echo   [2/3] Linking this folder to your existing project.
echo.
echo         ANSWER THESE PROMPTS LIKE THIS:
echo           Set up and deploy?          -^> y
echo           Which scope?                -^> harish's projects
echo           Link to existing project?   -^> y
echo           What's the name?            -^> quiz
echo.
call npx --yes vercel@latest link
if errorlevel 1 goto failed

echo.
echo   [3/3] Deploying to production. This takes 2-3 minutes.
echo.
call npx --yes vercel@latest --prod
if errorlevel 1 goto failed

echo.
echo  ================================================================
echo   Done. Check it here:
echo   https://quiz-seven-omega-15.vercel.app/api/competition
echo.
echo   You want to see  "success":true
echo   If you see an error instead, DATABASE_URL is still wrong -
echo   see FIX-DATABASE-URL-FIRST.md
echo  ================================================================
echo.
pause
exit /b 0

:failed
echo.
echo   [X] That step failed. Copy everything above and send it to me.
echo.
pause
exit /b 1
