@echo off
title TBA Local App Launcher
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js first.
  pause
  exit /b 1
)
echo Starting TBA Local App Launcher...
echo Keep this window open while using local apps from TBA.
node local-app-server.cjs
pause
