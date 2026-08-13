# دليل التشغيل والإنهاء — ERP Lite Backend
### اتبع الخطوات بالترتيب بالظبط. كل خطوة فيها أمر تنسخه وتشغّله.

---

## 1) جهّز قاعدة البيانات (مرة واحدة)

```bash
# لو PostgreSQL مش متثبّت
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start

# اعمل قاعدة بيانات وuser للتطبيق
sudo -u postgres createdb erplite_prod
sudo -u postgres psql -c "CREATE ROLE erplite_app LOGIN PASSWORD 'GHAYYAR_DA_HALAN';"
sudo -u postgres psql -d erplite_prod -c "GRANT erplite_app_role TO erplite_app;"
sudo -u postgres psql -c "CREATE ROLE erplite_bootstrap LOGIN PASSWORD 'GHAYYAR_DA_HALAN_KAMAN';"
```

## 2) شغّل ملفات الـ SQL بالترتيب (مهم جداً — نفس الترتيب ده بالظبط)

```bash
cd /path/to/ERP-Lite-sql-files
for f in ERP-Lite-001-System-Security-Core.sql \
         ERP-Lite-002-Inventory.sql \
         ERP-Lite-003-Purchasing-Sales.sql \
         ERP-Lite-004-Accounting-Partitions.sql \
         ERP-Lite-005-SeedData-RLS.sql \
         ERP-Lite-006-Phase2-Views-Indexes-Functions.sql \
         ERP-Lite-007-BootstrapRole.sql; do
  psql -U postgres -d erplite_prod -v ON_ERROR_STOP=1 -f "$f" || echo "!!! FAILED: $f"
done
```

**لو ظهرت `FAILED` لأي ملف، اوقف هنا وابعتلي رسالة الخطأ.** لو كل حاجة عدّت من غير FAILED، كمّل.

## 3) اربط الـ Users بالـ Roles وفعّل BYPASSRLS (خطوة حرجة، ماتنساهاش)

```bash
sudo -u postgres psql -d erplite_prod -c "GRANT erplite_bootstrap_role TO erplite_bootstrap;"
sudo -u postgres psql -d erplite_prod -c "ALTER ROLE erplite_bootstrap BYPASSRLS;"
```

**ده أهم سطر في الدليل كله.** لو نسيته، إنشاء أول شركة/مستخدم هيفشل بـ 500 Error. (`BYPASSRLS` مش بيتورّث من الـ Role التاني تلقائياً في PostgreSQL — لازم يتحط مباشرة).

## 4) جهّز الـ Backend

```bash
cd erplite-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cat > .env << 'EOF'
ERPLITE_DATABASE_URL=postgresql+asyncpg://erplite_app:GHAYYAR_DA_HALAN@localhost:5432/erplite_prod
ERPLITE_BOOTSTRAP_DATABASE_URL=postgresql+asyncpg://erplite_bootstrap:GHAYYAR_DA_HALAN_KAMAN@localhost:5432/erplite_prod
ERPLITE_JWT_SECRET_KEY=حط_هنا_مفتاح_سري_طويل_وعشوائي
ERPLITE_ENVIRONMENT=production
EOF
```

## 5) شغّل السيرفر وافتح التوثيق التلقائي

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

افتح في المتصفح: `http://localhost:8000/docs` — هتلاقي كل الـ Endpoints جاهزة تجرّبها بالماوس من غير ما تكتب كود.

## 6) اختبار التسلسل الأول (مرة واحدة بس، لأول تشغيل)

من `/docs` أو بـ curl، بالترتيب ده بالظبط:

1. **`GET /api/v1/core/currencies`** → خد الـ `uuid` بتاع `EGP`
2. **`GET /api/v1/core/countries`** → خد الـ `uuid` بتاع `EGY`
3. **`POST /api/v1/core/companies`** → ابعت اسم شركتك + الـ uuid بتاعين فوق → لازم يرجعلك 201
4. **`POST /api/v1/security/users`** → اعمل أول Admin، وحط `company_ids` = رقم الشركة اللي طلع (مش uuid، رقم عادي زي 1)
5. **`POST /api/v1/security/auth/login`** → لو رجّعلك `access_token`، **كل حاجة شغالة**.

**لو أي خطوة من دول فشلت، وقف وابعتلي رسالة الخطأ بالظبط من الـ Terminal.**

---

## 7) لو عايز تسيب Aider/DeepSeek يكملوا من هنا

ابعتلهم الملفات دي بالظبط ومتشرحش أكتر:
- `BACKEND_ARCHITECTURE.md` (النمط اللي يتبعوه)
- `CHANGELOG.md` (قسم "Remaining" — فيه بالظبط اللي ناقص)
- موديول `app/modules/sales/` كامل (كمرجع يتقلّد حرفياً لأي حاجة ناقصة)

**قولهم بالظبط:** *"أكمل قسم Remaining في CHANGELOG.md. أي موديول جديد أو Endpoint جديد لازم يتبع نفس بنية sales/ حرفياً (router→service→repository→models)، ويستخدم `get_current_user_id` بدل أي قيمة وهمية، ويحترم عقد RLS في `app/core/database.py`. متلمسش أي ملف SQL موجود إلا لو فيه خطأ تنفيذي حقيقي مُثبَت بالتشغيل."*

---

## أولويات لو الوقت ضيق قبل ما تفتح المعرض

| الأولوية | المهمة | ليه |
|---|---|---|
| 1 | خطوات 1-6 فوق (تشغيل واختبار أول مرة) | من غير كده مفيش نظام أصلاً |
| 2 | قفل `/core/companies` و`/security/users` بحماية (متاحين لأي حد دلوقتي) | أمان — قبل أي عميل حقيقي يشوف الرابط |
| 3 | إكمال `created_by` في purchasing/accounting (بعضها لسه قيمة وهمية) | دقة سجل التدقيق، مش حرج للتشغيل |
| 4 | باقي التقارير/الشاشات (Frontend) | آخر حاجة، بعد ما الـ API يبقى مضمون شغال |
