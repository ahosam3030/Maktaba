@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title Maktaba - إنشاء المالك الافتراضي
echo ========================================
echo   مسح قاعدة البيانات + إنشاء مالك
echo ========================================
echo.
echo تحذير: هذا الأمر يمسح كل الفواتير والمستخدمين والمخزون.
echo.

if not exist "apps\api\.env" (
  copy /Y "apps\api\.env.example" "apps\api\.env" >nul
  echo تم إنشاء apps\api\.env — عدّل DATABASE_URL إن لزم.
)

pushd apps\api
if not exist "node_modules\" call npm install
call npx prisma generate
call npx prisma db push --skip-generate
if errorlevel 1 (
  echo فشل الاتصال بقاعدة البيانات. راجع PostgreSQL وملف .env
  popd
  pause
  exit /b 1
)
call npm run seed
if errorlevel 1 (
  echo فشل seed.
  popd
  pause
  exit /b 1
)
popd

echo.
echo بعد التشغيل ادخل من الواجهة:
echo   البريد: admin@maktaba.local
echo   كلمة المرور: Admin@12345
echo.
pause
