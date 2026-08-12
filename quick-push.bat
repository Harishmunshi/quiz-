@echo off
REM ============================================================
REM  Islamic Quiz Competition — Quick Push (URL pre-filled)
REM  Just double-click this file. One auth prompt, done.
REM ============================================================

setlocal
cd /d "%~dp0"

set REPO_URL=https://github.com/Harishmunshi/quiz-.git

echo.
echo  ============================================================
echo   Quick Push to: %REPO_URL%
echo  ============================================================
echo.

REM Make sure remote is set
git remote remove origin 2>nul
git remote add origin %REPO_URL%

REM Push
git push -u origin main
if errorlevel 1 (
    echo.
    echo  Push failed. Most likely reason: needs a Personal Access Token.
    echo  Get one in 60 seconds:  https://github.com/settings/tokens/new
    echo  Scope: repo. Paste it when asked for Password.
    echo.
)

endlocal
pause
