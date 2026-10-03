@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo === Maktaba DB Backup ===
if not exist "backups" mkdir backups

set TS=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TS=%TS: =0%
set OUT=backups\library_erp_%TS%.sql

REM يقرأ DATABASE_URL من apps\api\.env إن وُجد
set DBURL=
if exist "apps\api\.env" (
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /C:"DATABASE_URL=" "apps\api\.env"`) do set DBURL=%%B
)
if defined DBURL (
  set DBURL=!DBURL:"=!
)

where pg_dump >nul 2>&1
if errorlevel 1 (
  echo pg_dump غير موجود في PATH. ثبّت PostgreSQL client tools أو أضف bin إلى PATH.
  echo مثال: "C:\Program Files\PostgreSQL\16\bin"
  pause
  exit /b 1
)

if defined DBURL (
  echo Using DATABASE_URL from .env
  pg_dump "!DBURL!" -F p -f "%OUT%"
) else (
  echo DATABASE_URL غير مضبوط — استخدم postgres@localhost/library_erp
  set /p PGUSER=User [postgres]: 
  if "!PGUSER!"=="" set PGUSER=postgres
  set /p PGPASSWORD=Password: 
  pg_dump -h localhost -U !PGUSER! -d library_erp -F p -f "%OUT%"
)

if errorlevel 1 (
  echo فشل النسخ الاحتياطي.
  pause
  exit /b 1
)

echo تم الحفظ: %OUT%
echo للإرجاع: psql DATABASE_URL -f "%OUT%"
pause
