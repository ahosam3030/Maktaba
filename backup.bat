@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Maktaba Backup
echo Maktaba PostgreSQL backup
if not exist "backups" mkdir backups
where pg_dump >nul 2>&1
if errorlevel 1 (
  echo pg_dump not in PATH. Use Settings - Download backup JSON as owner.
  pause
  exit /b 1
)
if not exist "apps\api\.env" (
  echo missing apps\api\.env
  pause
  exit /b 1
)
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B "DATABASE_URL=" apps\api\.env`) do set DBURL=%%B
set DBURL=%DBURL:"=%
set OUT=backups\library_erp_%RANDOM%.sql
pg_dump "%DBURL%" -F p -f "%OUT%"
echo Saved %OUT%
pause
