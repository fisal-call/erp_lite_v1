# ERP Lite — Backend Architecture (Phase 3 Foundation)
### FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL — Single Source of Truth: the ERP-Lite-*.sql schema

**الحالة:** أساس (Foundation) فقط — موديول واحد (`sales`) مبني بالكامل كنمط مرجعي. باقي الموديولات تُبنى بنفس النمط حرفياً (بواسطة Aider+DeepSeek)، مع الرجوع لـ Claude فقط للأجزاء المعقدة (كما هو مخطَّط).

---

## 1. مبدأ التطابق الحتمي مع الـ Schema

**لا نموذج SQLAlchemy يُخترَع من الصفر** — كل عمود، كل قيد، كل اسم جدول يُنسخ حرفياً من `ERP-Lite-00X-*.sql`. أي اختلاف بين الكود والـ Schema الفعلي هو خطأ يجب إصلاحه في الكود، وليس في القاعدة (القاعدة هي "Single Source of Truth" المُعتمَدة).

## 2. حدود الموديولات (Module Boundaries) — تطابق AD-005 حرفياً

كل موديول Python تحت `app/modules/<name>/` يقابل **مخطط PostgreSQL واحد بالضبط**:

| موديول Python | مخطط DB | يحتوي |
|---|---|---|
| `security` | `security` | `app_user`, `role`, صلاحيات |
| `core_org` | `core` | `company`, `branch`, `currency`, `tax_rate`, إلخ |
| `inventory` | `inventory` | `item`, `warehouse`, `stock_ledger_entry`، إلخ |
| `purchasing` | `purchasing` | `supplier`, `purchase_order`، إلخ |
| `sales` | `sales` | `customer`, `sales_order`، إلخ — **مبني بالكامل هنا كنمط مرجعي** |
| `accounting` | `accounting` | `account`, `journal_entry`، إلخ |

**لا موديول يستورد مباشرة من طبقة الـ Repository الخاصة بموديول آخر** — فقط عبر الـ Service Layer الخاص به (يعكس مبدأ "الأحداث لا الاستدعاء المباشر" من AD-005، مُبسَّطاً لبنية Backend واحدة بدل Plugins منفصلة فعلياً — هذا اختيار عملي لـ ERP Lite: نفس حدود الفصل المنطقي، بدون تعقيد Microservices الفعلي).

## 3. الطبقات داخل كل موديول (Layered Architecture)

```
router.py       → HTTP فقط: تحقق من الطلب، استدعاء Service، إرجاع Response. لا منطق أعمال هنا.
schemas.py       → Pydantic DTOs (Request/Response) — لا تُعرَض أعمدة id الداخلية أبداً، uuid فقط.
service.py        → منطق الأعمال (يقابل AD-004: "منطق الأعمال في Service Layer"). يستدعي Repository.
repository.py      → SQLAlchemy فقط. لا منطق أعمال هنا — استعلامات وحفظ فقط.
models.py            → SQLAlchemy ORM Models — نسخة طبق الأصل من تعريف الجدول في SQL.
```

هذا التسلسل **إلزامي واتجاه واحد فقط**: `router → service → repository → models`. لا اختصارات (Router لا يستدعي Repository مباشرة أبداً).

## 4. استراتيجية المعرّفات في الـ API (تطبيق حرفي لـ ERP-003 Part 5 §1)

- **كل مسار API يستخدم `uuid` حصراً.** لا `id` رقمي داخلي يظهر في أي Request/Response/URL أبداً.
- مثال: `GET /api/v1/sales/customers/{customer_uuid}` — **ليس** `/customers/{id}`.
- الـ Repository الداخلي يحوّل `uuid` → `id` عند أول استعلام، ويستخدم `id` للـ Joins الداخلية فقط.

## 5. عقد RLS الإلزامي (الأهم في كل هذا التأسيس)

كل Request HTTP يمر عبر Dependency (`app/core/dependencies.py::get_db_with_context`) الذي:
1. يستخرج `company_ids` و`tenant_id` من الـ JWT الخاص بالمستخدم المصادَق عليه.
2. يُنفِّذ `SET LOCAL app.current_company_ids = '...'` و`SET LOCAL app.current_tenant_id = '...'` على نفس اتصال قاعدة البيانات المستخدَم للـ Request، **قبل** أي استعلام آخر.
3. `SET LOCAL` (وليس `SET` العادي) — القيمة تُطبَّق فقط داخل نفس الـ Transaction وتُمسَح تلقائياً بعد `COMMIT`/`ROLLBACK`، فلا تتسرب لاتصال آخر من نفس الـ Connection Pool (خطر أمني حقيقي لو استُخدِم `SET` العادي مع Pooling).

**لا Endpoint واحد معفى من هذا العقد.** لو نُسي، الاستعلام هيرجع صفر صفوف (آمن افتراضياً وفق تصميم RLS في Phase 1) — يعني الخطأ هيظهر كـ "بيانات مفقودة" وليس "تسريب بيانات"، لكنه لسه Bug يجب اكتشافه بالاختبار.

## 6. الحقول المخصصة (`custom_fields`)

كل DTO لكيان DocType يحمل حقل `custom_fields: dict | None` يُمرَّر شفافاً (بلا تحقق بنيوي من الـ Backend نفسه — التحقق من نوع كل حقل مخصص فردي يُبنى لاحقاً في محرك Metadata عند الحاجة الفعلية، وليس الآن).

## 7. المكتبات المعتمدة

`fastapi`, `sqlalchemy[asyncio]>=2.0`, `asyncpg`, `pydantic>=2.0`, `pydantic-settings`, `python-jose` (JWT), `passlib[argon2]` (تشفير كلمات المرور وفق ERP-001 §10), `alembic` (لإدارة Migrations مستقبلاً — الـ Schema الحالي هو الأساس، Alembic يدير التغييرات فوقه لاحقاً).

## 8. الموديولات المتبقية (تُبنى بنفس نمط `sales` حرفياً)

| الموديول | الأولوية | ملاحظة |
|---|---|---|
| `security` | عالية (Auth يعتمد عليه كل شيء) | يحتاج جزءاً إضافياً: JWT issuing endpoint |
| `core_org` | عالية (كل شيء يعتمد على `company`/`branch`) | يشمل Bootstrap Company flow (ERP-004 §15.7) |
| `inventory` | عالية | `stock_ledger_entry` للقراءة فقط عبر API (Append-Only — لا `PUT`/`DELETE` على مستوى الحركة نفسها، فقط عبر مستندات `StockAdjustment`/`StockTransfer`) |
| `purchasing` | متوسطة | نفس نمط `sales` طبق الأصل (تناظر شبه كامل في البنية) |
| `accounting` | متوسطة | يحتاج انتباهاً خاصاً لـ BR-ACC-001 (لا `PUT` على `JournalEntry` بعد `submitted`) |

**تعليمات لـ Aider/DeepSeek عند بناء كل موديول تالٍ:** انسخ بنية `app/modules/sales/` بالكامل (الملفات الخمسة)، بدّل أسماء الجداول/الأعمدة لتطابق `ERP-Lite-00X.sql` للموديول المطلوب حرفياً، حافظ على نفس تسلسل الطبقات (router→service→repository→models) بلا اختصار، ولا تنسَ عقد RLS في أي endpoint جديد.
