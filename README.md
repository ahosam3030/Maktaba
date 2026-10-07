# Maktaba — نظام إدارة مركز الخدمات والمكتبات

نسخة تطويرية **multi-tenant** لإدارة المشتريات والمخزون والمبيعات والخدمات والخزينة والتقارير.

| الطبقة | التقنية |
|--------|---------|
| الواجهة | React + TypeScript + Vite (عربي RTL) |
| الخادم | NestJS + JWT |
| قاعدة البيانات | PostgreSQL + Prisma |
| كلمات المرور | PBKDF2-HMAC-SHA256 (ملح + تكرارات) |

> **تنبيه:** مناسبة للعرض والتجربة المحلية. ليست جاهزة بعد للنشر التجاري الكامل (مزامنة offline أساسية، قفل مخزون، rate-limit، audit، ونسخ احتياطي محلي موجودة؛ HTTPS عبر proxy في الإنتاج؛ حل تعارضات offline متقدم ما زال لاحقًا).

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
   في `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/library_erp?schema=public"
   JWT_SECRET="غيّره-إلى-نص-طويل-عشوائي"
   ```
4. أنشئ المالك (يمسح البيانات — **على جهاز السيرفر فقط**):
   - دبل كليك **`seed.bat`** → `YES` → بريدك + كلمة مرور قوية  
   - أو:
   ```powershell
   cd apps\api
   npm install
   npx prisma generate
   npx prisma migrate deploy
   $env:SEED_CONFIRM="YES"
   $env:SEED_OWNER_EMAIL="you@example.com"
   $env:SEED_OWNER_PASSWORD="YourStrong@Pass1"
   npm run seed
   ```
5. دبل كليك **`start.bat`** وادخل بالبيانات التي عيّنتها.

> كلمات المرور **لا** تُعرض في واجهة الدخول. `seed` يعمل فقط مع وصول للجهاز والمشروع وPostgreSQL.

للإيقاف: `STOP.bat`

---

## الوحدات الحالية

| الوحدة | الحالة |
|--------|--------|
| تسجيل دخول (فقط) | ✅ التسجيل العام مقفول |
| أدوار وصلاحيات | ✅ مالك / أدمن / مستخدم + حماية API |
| المنتجات | ✅ CRUD من الإعدادات والمخزون + باركود + وحدات قابلة للتخصيص + حد أدنى |
| المشتريات | ✅ على الخادم — باركود، سعر بيع، مكسب، متبقي، تعديل/حذف، مرتجعات |
| تاريخ أسعار الشراء | ✅ تقرير منتج + مقارنة موردين |
| المبيعات (POS) | ✅ باركود، مخزون، مكسب، قيد خزينة، **مرتجع بيع** |
| الخدمات والإيصالات | ✅ **PostgreSQL** — فواتير متعددة البنود + قيد خزينة تلقائي |
| الخزينة | ✅ يدوي + قيود من المبيعات والخدمات |
| التقارير | ✅ رأس مال، أرباح بضاعة، **دخل خدمات**، أرصدة، تاريخ أسعار |
| الإعدادات | ✅ حسابات، منتجات، وحدات، **طباعة على الخادم**، حذف مكتبة |

### سياسة كلمة المرور
حرف **كبير** + **صغير** + **رقم** + **رمز**.

### الصلاحيات
`purchases` · `sales` · `inventory` · `accounting` · `printing` · `reports` · `users`

---

## API مختصر (`/api`)

| المسار | صلاحية |
|--------|--------|
| `POST /auth/login` | — |
| `/suppliers` · `/purchases/*` | `purchases` |
| `/sales` | `sales` |
| `/inventory` · `/inventory/products` | `inventory` |
| `/services` · `/service-receipts` | `printing` |
| `/accounting/*` | `accounting` |
| `/reports/summary` | `reports` |
| `/users` | مالك فقط |

`organizationId` دائمًا من التوكن.

---

## ما تبقّى قبل الإنتاج

1. ~~مزامنة offline موثوقة~~ → **أساسي منفّذ:** طابور outbox في IndexedDB + إعادة إرسال عند الاتصال (مبيعات/مشتريات/خزينة/خدمات). ما زال بدون حل تعارضات متقدم أو كاش قراءة كامل offline.
2. ~~قفل مخزون أقوى + اختبارات آلية~~ → **أساسي منفّذ:** `SELECT FOR UPDATE` + عزل Serializable للبيع/التسوية/مرتجع الشراء، ووحدة `stock.util` + `npm test` لحساب الرصيد. (اختبارات تكامل كاملة تحت ضغط عالي ما زالت اختيارية).
3. ~~HTTPS، نسخ احتياطي، rate-limit، audit log~~ → **أساسي منفّذ:**
   - rate-limit على `/auth/login` (IP + بريد)
   - جدول `AuditLog` + `GET /api/audit` (مالك/أدمن)
   - `backup.bat` / `scripts/backup-db.sh` عبر `pg_dump`
   - رؤوس أمان + **HTTPS عبر reverse proxy** (Caddy/Nginx) — التطبيق نفسه لا يصدر شهادة.
4. ~~تخزين إعدادات الطباعة على الخادم~~ → **منفّذ:** `GET/PUT /api/settings/print` على مستوى المكتبة + كاش محلي للطباعة الأوفلاين.
5. ~~رفع صور المنتجات~~ → **منفّذ:** `POST /api/inventory/upload-image` (JPEG/PNG/WebP/GIF ≤ 2MB) مع خدمة `/uploads` + واجهة اختيار ملف.
6. ~~مرتجعات البيع~~ → **منفّذ:** `POST /api/sales/returns` + واجهة مرتجع من سجل المبيعات (مخزون + استرداد خزينة).

---


### إضافات تنافسية (أكتوبر 2026)
- تصدير التقارير **CSV/Excel** وطباعة/PDF من شاشة التقارير
- إقفال يومية + درج نقدي (موجود) + تنبيهات **نقص مخزون**
- **ترخيص أجهزة** بمفتاح تسلسلي مربوط بعدد الأجهزة
- **دعم فني:** رابط واتساب + سجل بلاغات داخل الإعدادات
- أساس PWA: `manifest.webmanifest` (نسخة 2: مزامنة سحابية / فروع / طابعات حرارية رسمية)


## الواجهة

- عربي RTL + خط Cairo
- **نظام ألوان موحّد** عبر CSS variables في `apps/web/src/ui/styles.css` (`--color-primary`, `--color-sidebar`, …)
- قائمة جانبية قابلة للإخفاء، تبويبات، أيقونات SVG

---

## أمان

- لا ترفع `.env` أو توكنات GitHub.
- غيّر `JWT_SECRET` قبل أي نشر.
- لا تعرض PostgreSQL على الإنترنت.


---

## استكشاف أخطاء شائعة

| العرض | الحل |
|--------|------|
| صفحة المشتريات بيضاء | `git pull` ثم Ctrl+Shift+R — كان بسبب `check()` غير معرّف (أُصلح) |
| `Property subtotal does not exist` | حدّث `reports.controller.ts` من `main` وأعد تشغيل API |
| `Could not find declaration for express/multer` | من `apps/api`: `npm i -D @types/express @types/multer && npm i multer` |
| Failed to fetch / الخادم غير متاح | شغّل `npm run start:dev` داخل `apps/api` |
| الواجهة قديمة رغم التحديث | تأكد أنك في مجلد المشروع الصحيح ثم `git fetch && git reset --hard origin/main` |
| ماسح الباركود يفتح DevTools في Chrome | الماسح يرسل اختصار متصفح؛ استخدم Edge أو زر مسح بالكاميرا أو أعد ضبط Prefix للماسح |
