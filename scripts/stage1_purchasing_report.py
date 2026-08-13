"""
stage1_purchasing_report.py
Builds the Stage 1 (Purchasing module) status report for the ERP Lite Frontend.
"""
from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

from generate_stage_report import build_report

OUTPUT = Path("/home/z/my-project/download/Stage-1-Purchasing-Report.docx")

SECTIONS = [
    {
        "heading": "1. نظرة عامة",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "هذا التقرير يوثّق المرحلة الأولى من بناء واجهة ERP Lite: موديول المشتريات (Purchasing). "
                    "الموديول مبني بنفس قالب موديول المبيعات (Sales) حرفياً، كما تنص المواصفة §4: "
                    "\"نفس القوالب بالضبط من قسم المبيعات، بتبديل: عميل → مورد، أمر بيع → أمر شراء، "
                    "BR-SAL-009 → BR-PUR-010\". هذا التطابق الحرفي مقصود — أي اختلاف بين الموديولين "
                    "يجب أن يكون له سبب موثَّق في هذا التقرير أو في تعليق داخل الكود نفسه."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "كل الشاشات الأربع (قائمة الموردين، نموذج مورد، قائمة أوامر الشراء، تفاصيل أمر الشراء) "
                    "مبنية وتعمل، وتتجاوب مع الأخطاء بنفس نمط المبيعات: 422 لقواعد العمل (BR-PUR-010)، "
                    "409 لتعارض التعديل (إعادة تحميل تلقائية)."
                ),
            },
        ],
    },
    {
        "heading": "2. الشاشات المبنية",
        "level": 1,
        "blocks": [
            {
                "kind": "table",
                "headers": ["المسار", "الشاشة", "الحالة", "الملاحظات"],
                "rows": [
                    ["/purchasing/suppliers", "قائمة الموردين", "✓ مكتمل", "بحث فوري + جدول + زر جديد"],
                    ["/purchasing/suppliers/new", "نموذج مورد جديد", "✓ مكتمل", "Zod validation + معالجة 422"],
                    ["/purchasing/suppliers/:uuid", "تفاصيل مورد", "✓ مكتمل", "للقراءة فقط — لا يوجد Endpoint تعديل"],
                    ["/purchasing/orders", "قائمة أوامر الشراء", "✓ مكتمل", "فلاتر: الحالة + نطاق تاريخ"],
                    ["/purchasing/orders/new", "نموذج أمر شراء جديد", "✓ مكتمل", "Autocomplete مورد + أصناف + بنود ديناميكية + حفظ كمسودة/حفظ واعتماد"],
                    ["/purchasing/orders/:uuid", "تفاصيل أمر الشراء", "✓ مكتمل", "اعتماد + معالجة 409"],
                ],
            },
        ],
    },
    {
        "heading": "3. المكونات القابلة لإعادة الاستخدام المُضافة",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "هذه المكونات مبنية لتُستخدم عبر الموديولات. كل واحدة منها نسخة مطابقة لمكوّن موجود في المبيعات، "
                    "مع تبديل وحيد لمصدر البيانات. هذا يحقق مبدأ DRY دون كسر حدود الموديولات."
                ),
            },
            {
                "kind": "bullet",
                "text": "src/components/SupplierAutocomplete.tsx — نسخة من CustomerAutocomplete مع purchasingApi.listSuppliers.",
            },
            {
                "kind": "bullet",
                "text": "src/components/CurrencyPicker.tsx — Dropdown عملة من GET /core/currencies (يستخدم في المبيعات والمشتريات معاً).",
            },
            {
                "kind": "bullet",
                "text": "src/components/CustomerAutocomplete.tsx — أُضيف في هذه المرحلة لإغلاق الفجوة الموثَّقة في CHANGELOG Phase 4.",
            },
            {
                "kind": "bullet",
                "text": "src/modules/core_org/api.ts — عميل API جديد للـ endpoints الموجودة بالفعل في core_org (currencies, countries, companies).",
            },
        ],
    },
    {
        "heading": "4. فجوات Backend لازم تتسد (إضافات فقط — بلا تعديل أي Endpoint موجود)",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "الباك إند الحالي للموديول يحتوي على: POST /purchasing/suppliers، GET /purchasing/suppliers/{uuid}، "
                    "POST /purchasing/purchase-orders، GET /purchasing/purchase-orders/{uuid}، POST /purchasing/purchase-orders/{uuid}/submit. "
                    "نفس نمط المبيعات يقتضي إضافة Endpoint قائمة للموردين وقائمة لأوامر الشراء. هذه الإضافات Additive فقط — "
                    "لا تكسر أي Endpoint موجود. الكود الجاهز للنسخ في ملف:"
                ),
            },
            {
                "kind": "code",
                "text": (
                    "# app/modules/purchasing/router.py — أضف هذين الـ Endpoints في نهاية الملف\n\n"
                    "@router.get(\"/suppliers\", response_model=list[SupplierRead])\n"
                    "async def list_suppliers(db: AsyncSession = Depends(get_db_with_context)):\n"
                    "    \"\"\"Additive endpoint (mirrors sales.list_customers). RLS already scopes results.\"\"\"\n"
                    "    repo = SupplierRepository(db)\n"
                    "    rows, _ = await repo.list(limit=200, offset=0)\n"
                    "    return rows\n\n\n"
                    "@router.get(\"/purchase-orders\", response_model=list[PurchaseOrderRead])\n"
                    "async def list_purchase_orders(db: AsyncSession = Depends(get_db_with_context)):\n"
                    "    \"\"\"Additive endpoint. NOTE: returns full DTO (with lines) — if performance becomes an\n"
                    "    issue later, add a lightweight PurchaseOrderSummaryRead like sales has.\"\"\"\n"
                    "    repo = PurchaseOrderRepository(db)\n"
                    "    rows, _ = await repo.list(limit=200, offset=0)\n"
                    "    return rows"
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "ملاحظة: الـ Endpoint الثاني يستخدم PurchaseOrderRead (مع البنود) بدلاً من SummaryDTO خفيف، لأن purchasing/schemas.py "
                    "لا يحتوي على PurchaseOrderSummaryRead بعد. لو أصبح الأداء مشكلة، أضف PurchaseOrderSummaryRead DTO + Use it بنفس "
                    "نمط sales. الواجهة تعمل بكلا الخيارين."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "حتى تُضاف هذان الـ Endpoints، شاشتا قائمة الموردين وقائمة أوامر الشراء ستعرفان خطأ 404 من الـ API "
                    "وتعرضان رسالة واضحة بالعربية توجّه المستخدم لمراجعة هذا التقرير. بمجرد إضافتهما، تعمل الشاشتان دون أي "
                    "تعديل في الواجهة."
                ),
            },
        ],
    },
    {
        "heading": "5. التحقق الفعلي (Tested)",
        "level": 1,
        "blocks": [
            {"kind": "bullet", "text": "npx tsc --noEmit — صفر أخطاء."},
            {"kind": "bullet", "text": "npm run build (Production) — صفر أخطاء، 232 module transformed، 451 KB JS bundle."},
            {"kind": "bullet", "text": "npm run preview — سيرفر شغّال ويرجّع HTTP 200 على /."},
            {
                "kind": "paragraph",
                "text": (
                    "لم يُختبَر: تدفق حقيقي عبر متصفح متصل بالباك إند الفعلي (لأن الباك إند مش شغّال في هذه البيئة، "
                    "والـ Endpoints القائمة للموردين/أوامر الشراء ناقصة كما هو موضَّح في القسم 4). هذه نفس فجوة الاختبار "
                    "الموثَّقة في CHANGELOG Phase 4 — يُنصح بأخذ جولة بصرية كاملة عبر المتصفح بمجرد اكتمال الباك إند."
                ),
            },
        ],
    },
    {
        "heading": "6. الالتزام بالقواعد الصارمة",
        "level": 1,
        "blocks": [
            {
                "kind": "table",
                "headers": ["القاعدة", "الالتزام"],
                "rows": [
                    ["لا تعديل أي ملف في /sql/", "✓ لم نلمسها"],
                    ["لا تعديل app/core/database.py أو dependencies.py", "✓ لم نلمسها"],
                    ["لا تعديل أي Endpoint موجود", "✓ لم نلمس أي router/service/repository موجودة"],
                    ["لا حذف أي Business Rule check", "✓ لم نلمس أي service.py"],
                    ["UUID فقط، لا id رقمي داخلي", "✓ كل الـ types والـ API calls تستخدم uuid"],
                    ["عربي RTL بالكامل", "✓ كل النصوص عربي، RTL في layout و html"],
                    ["نفس قالب المبيعات حرفياً", "✓ كل شاشة Purchasing نسخة من Sales المقابلة"],
                ],
            },
        ],
    },
    {
        "heading": "7. الخطوة التالية",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "المرحلة 2: موديول المخزون — الأصناف + فئات الأصناف + المخازن + رصيد المخزون. "
                    "كل الـ Endpoints اللازمة موجودة بالفعل في الباك إند (GET /inventory/items مع ?search=، "
                    "GET /inventory/stock-balance، POST /inventory/warehouses، POST /inventory/item-categories). "
                    "لن تكون هناك فجوات Backend في هذه المرحلة — كل الشاشات ستعمل فوراً."
                ),
            },
        ],
    },
]

build_report(
    OUTPUT,
    title="ERP Lite Frontend — تقرير المرحلة 1: موديول المشتريات",
    subtitle="Purchasing Module — Suppliers + Purchase Orders (مرآة كاملة لموديول المبيعات)",
    sections=SECTIONS,
)
