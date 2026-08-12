@echo off
REM ============================================================
REM  Islamic Quiz Competition — One-click publish to GitHub
REM  Just double-click this file.
REM ============================================================

setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish-to-github.ps1" %*

endlocal
