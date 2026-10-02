@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title Maktaba - تشغيل النظام
echo ========================================
echo   Maktaba - تشغيل النظام
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [خطأ] Node.js غير مثبت. نزّله من https://nodejs.org ثم أعد المحاولة.
  pause
  exit /b 1
)

if not exist "apps\api\.env" (
  echo [إعداد] إنشاء ملف apps\api\.env ...
  copy /Y "apps\api\.env.example" "apps\api\.env" >nul
  echo.
  echo تم إنشاء .env بالقيم الافتراضية.
  echo لو PostgreSQL عندك بباسورد مختلف لمستخدم postgres،
  echo عدّل السطر DATABASE_URL داخل: apps\api\.env
  echo.
)

echo [1/4] تثبيت حزم الخادم إن لزم...
pushd apps\api
if not exist "node_modules\" (
  call npm install
  if errorlevel 1 (
    echo [خطأ] فشل npm install في apps\api
    popd
    pause
    exit /b 1
  )
) else (
  rem تأكد من class-validator لو المشروع اتحدّث
  call npm install class-validator class-transformer --no-fund --no-audit >nul 2>&1
)
echo [2/4] Prisma generate...
call npx prisma generate
if errorlevel 1 (
  echo [خطأ] prisma generate فشل. راجع .env واتصال PostgreSQL.
  popd
  pause
  exit /b 1
)
echo [3/4] تطبيق قاعدة البيانات...
call npx prisma db push --skip-generate
if errorlevel 1 (
  echo.
  echo [تحذير] تعذر تحديث قاعدة البيانات.
  echo تأكد أن PostgreSQL شغال وأن DATABASE_URL في apps\api\.env صحيح.
  echo مثال:
  echo DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/library_erp?schema=public"
  echo.
  echo لو قاعدة library_erp مش موجودة، أنشئها من pgAdmin أو psql:
  echo   CREATE DATABASE library_erp;
  echo.
  popd
  pause
  exit /b 1
)
popd

echo [4/4] تثبيت حزم الواجهة إن لزم...
pushd apps\web
if not exist "node_modules\" (
  call npm install
  if errorlevel 1 (
    echo [خطأ] فشل npm install في apps\web
    popd
    pause
    exit /b 1
  )
)
popd

echo.
echo تشغيل الخادم على http://localhost:3000
echo تشغيل الواجهة على http://localhost:5173
echo.
echo سيتم فتح نافذتين. لا تغلقهما أثناء الاستخدام.
echo لإيقاف النظام: أغلق النافذتين أو اضغط Ctrl+C داخل كل واحدة.
echo.

start "Maktaba API" cmd /k "cd /d "%~dp0apps\api" && npm run start:dev"
timeout /t 3 /nobreak >nul
start "Maktaba Web" cmd /k "cd /d "%~dp0apps\web" && npm run dev"

timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo تم الإطلاق. الواجهة يجب أن تفتح في المتصفح.
pause
