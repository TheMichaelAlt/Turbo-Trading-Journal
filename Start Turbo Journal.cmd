@echo off
setlocal
title Turbo Trading Journal
cd /d "%~dp0trading-journal"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 or newer is required to run Turbo Trading Journal.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo First-time setup: run npm install inside the trading-journal folder.
  pause
  exit /b 1
)

echo Building the latest version and opening Turbo Trading Journal...
call npm start
if errorlevel 1 (
  echo.
  echo Turbo Trading Journal could not start. The error is shown above.
  pause
  exit /b 1
)
