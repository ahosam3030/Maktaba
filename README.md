# Maktaba — نظام إدارة مركز الخدمات والمكتبات

نسخة تطويرية **multi-tenant** لإدارة المشتريات والمخزون والمبيعات والخدمات والخزينة والتقارير.

| الطبقة | التقنية |
|--------|---------|
| الواجهة | React + TypeScript + Vite (عربي RTL) |
| الخادم | NestJS + JWT |
| قاعدة البيانات | PostgreSQL + Prisma |
| كلمات المرور | PBKDF2-HMAC-SHA256 (ملح + تكرارات) |

> **تنبيه:** مناسبة للعرض والتجربة المحلية. ليست جاهزة بعد للنشر التجاري الكامل (لا offline مزامنة، والخدمات/الإيصالات ما زالت محلية على الجهاز).

---

## تشغيل سريع (Windows)

1. ثبّت [Node.js 20+](https://nodejs.org) و [PostgreSQL](https://www.postgresql.org/download/windows/).
2. أنشئ القاعدة مرة واحدة:
   ```sql
   CREATE DATABASE library_erp;
   ```
3. انسخ وعدّل البيئة:
   ```powershell
   Copy-Item apps\api\.env.example apps\api\.env
   ```
   في `.env` ضع باسورد postgres الصحيح:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/library_erp?schema=public"
   JWT_SECRET="غيّره-إلى-نص-طويل-عشوائي"
   ```
4. أنشئ المالك (يمسح البيانات — **محلي على جهاز السيرفر فقط**):
   - دبل كليك **`seed.bat`** → اكتب `YES` → أدخل بريدك وكلمة مرور قوية  
   - أو من PowerShell:
   ```powershell
   cd apps\api
   npm install
   npx prisma generate
   npx prisma db push
   $env:SEED_CONFIRM="YES"
   $env:SEED_OWNER_EMAIL="you@example.com"
   $env:SEED_OWNER_PASSWORD="YourStrong@Pass1"
   npm run seed
   ```
5. دبل كليك **`start.bat`** وادخل بالبيانات التي عيّنتها أنت.

> كلمات المرور **لا** تُعرض في واجهة الدخول. `seed` يعمل فقط مع وصول للجهاز والمشروع وPostgreSQL — ليس من المتصفح.

للإيقاف: `STOP.bat` أو أغلق نوافذ API/Web.

---

## الوحدات الحالية

| الوحدة | الحالة |
|--------|--------|
| تسجيل دخول (فقط) | ✅ — التسجيل العام مقفول |
| أدوار وصلاحيات | ✅ مالك / أدمن / مستخدم + حماية API |
| المشتريات | ✅ على الخادم — باركود، سعر بيع، مكسب، متبقي، تعديل/حذف |
| المخزون والمنتجات | ✅ CRUD كامل + باركود + وحدات + حد أدنى + تسوية |
| المبيعات (POS) | ✅ باركود، مخزون، مكسب، قيد خزينة |
| الخزينة | ✅ حركات يدوية + قيود من المبيعات |
| التقارير | ✅ رأس مال، أرباح فترة، أرصدة |
| الخدمات والإيصالات | ✅ على PostgreSQL + قيد تلقائي في الخزينة |
| الإعدادات | ✅ حسابات، طباعة محلية، حذف مكتبة |

### سياسة كلمة المرور
حرف **كبير** + **صغير** + **رقم** + **رمز** (مثل `Ab1@`).

### الصلاحيات
`purchases` · `sales` · `inventory` · `accounting` · `printing` · `reports` · `users`  
المالك والأدمن يمرّون على كل شيء؛ المستخدم العادي حسب ما يحدده المالك من **الإعدادات**.

---

## أوامر مفيدة

```powershell
# من apps\api
# يحتاج SEED_CONFIRM=YES و SEED_OWNER_PASSWORD
npm run seed                 # مسح الداتا + مالك (أداة محلية)
npx prisma db push           # مزامنة المخطط
npx prisma migrate deploy    # تطبيق migrations
npm run start:dev            # الخادم :3000

# من apps\web
npm run dev                  # الواجهة :5173
```

فحص الصحة: `http://localhost:3000/api/health`

---

## هيكل مختصر للـ API (`/api`)

| المسار | ملاحظة |
|--------|--------|
| `POST /auth/login` | دخول |
| `POST /auth/register` | مقفول إلا مع `SETUP_SECRET` |
| `/suppliers` · `/purchases/*` | صلاحية `purchases` |
| `/sales` | صلاحية `sales` |
| `/inventory` | صلاحية `inventory` |
| `/accounting/*` | صلاحية `accounting` |
| `/reports/summary` | صلاحية `reports` |
| `/users` | للمالك فقط |

`organizationId` دائمًا من التوكن وليس من جسم الطلب.

---

## ما تبقّى قبل الإنتاج

1. ربط الخدمات والإيصالات بـ PostgreSQL والخزينة.
2. مزامنة offline موثوقة.
3. قفل مخزون أقوى تحت ضغط عالي + اختبارات آلية.
4. HTTPS، نسخ احتياطي، rate-limit لتسجيل الدخول، تدقيق عمليات.
5. تخزين إعدادات الطباعة على الخادم (حاليًا `localStorage` للجهاز).

---

## أمان

- لا ترفع `.env` أو توكنات GitHub إلى المستودع.
- غيّر `JWT_SECRET` قبل أي نشر.
- لا تعرض PostgreSQL على الإنترنت.
- التخزين المحلي ليس نسخة احتياطية.
