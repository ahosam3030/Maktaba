@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title Maktaba - إنشاء المالك (خطر)
echo ========================================
echo   مسح قاعدة البيانات + إنشاء مالك
echo ========================================
echo.
echo تحذير: يمسح كل الفواتير والمستخدمين والمخزون.
echo هذا الملف يعمل فقط على الجهاز الذي فيه المشروع وقاعدة البيانات.
echo ليس متاحًا من المتصفح ولا من الإنترنت.
echo.
set /p CONFIRM=اكتب YES للتأكيد: 
if /I not "%CONFIRM%"=="YES" (
  echo تم الإلغاء.
  pause
  exit /b 1
)

echo.
set /p SEED_OWNER_EMAIL=البريد الإلكتروني للمالك: 
if "%SEED_OWNER_EMAIL%"=="" set SEED_OWNER_EMAIL=admin@maktaba.local

set /p SEED_OWNER_PASSWORD=كلمة مرور قوية (كبير+صغير+رقم+رمز): 
if "%SEED_OWNER_PASSWORD%"=="" (
  echo كلمة المرور مطلوبة.
  pause
  exit /b 1
)

if not exist "apps\api\.env" (
  copy /Y "apps\api\.env.example" "apps\api\.env" >nul
  echo تم إنشاء apps\api\.env — عدّل DATABASE_URL إن لزم.
)

set SEED_CONFIRM=YES
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
echo تم. ادخل من الواجهة بالبريد وكلمة المرور اللي أنت كتبتهم.
echo لا تشارك كلمة المرور ولا تضعها في الواجهة العامة.
echo.
pause
