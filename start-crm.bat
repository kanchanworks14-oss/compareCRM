@echo off
title Compare Projects CRM
cd /d "%~dp0backend"

if not exist node_modules (
  echo Installing packages - first run only, please wait...
  call npm install
)

echo.
echo Starting Compare Projects CRM...
echo The browser will open at http://localhost:4000
echo Keep this window open during the demo. Close it to stop the CRM.
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:4000"
call npm start
pause
