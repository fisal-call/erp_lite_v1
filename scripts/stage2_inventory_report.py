"""
stage2_inventory_report.py
Builds the Stage 2 (Inventory module) status report.
"""
from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

from generate_stage_report import build_report

OUTPUT = Path("/home/z/my-project/download/Stage-2-Inventory-Report.docx")

SECTIONS = [
    {
        "heading": "1. نظرة عامة",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "هذا التقرير يوثّق المرحلة الثانية من بناء واجهة ERP Lite: موديول المخزون (Inventory). "
                    "يشمل الموديول أربع شاشات: الأصناف (مع البحث والترقين)، فئات الأصناف، المخازن، ورصيد المخزون "
                    "(من View جاهز في الباك إند). على عكس المشتريات، معظم الـ Endpoints اللازمة موجودة بالفعل — "
                    "كانت فجوة الباك إند الوحيدة هي Endpoints القائمة لفئات الأصناف والمخازن."
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
                "headers": ["المسار", "الشاشة", "الحالة", "ملاحظات"],
                "rows": [
                    ["/inventory/items", "قائمة الأصناف", "✓ مكتمل", "بحث ?search= + ترقين صفحات + جدول"],
                    ["/inventory/items/new", "نموذج صنف جديد", "✓ مكتمل", "Dropdown للفئات + Zod validation + رابط لإنشاء فئة لو القائمة فارغة"],
                    ["/inventory/items/:uuid", "تفاصيل صنف", "✓ مكتمل", "للقراءة فقط"],
                    ["/inventory/categories", "فئات الأصناف", "✓ مكتمل", "إضافة inline + جدول — إدارة الفئات بشكل مستقل"],
                    ["/inventory/warehouses", "قائمة المخازن", "✓ مكتمل", "عرض علم السماح بالسالب (BD-001)"],
                    ["/inventory/warehouses/new", "نموذج مخزن جديد", "✓ مكتمل", "Checkbox للسماح بالسالب مع شرح"],
                    ["/inventory/stock-balance", "رصيد المخزون", "✓ مكتمل", "بطاقات ملخص + تنبيه بصري أحمر للسالب + فلتر بالمخزن"],
                ],
            },
        ],
    },
    {
        "heading": "3. ميزة التنبيه البصري للرصيد السالب (Spec §5.2)",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "المواصفة تطلب \"تنبيه بصري (أيقونة حمراء) لو الكمية = 0 أو سالبة\". تم تطبيق ذلك بأكثر من مستوى:"
                ),
            },
            {
                "kind": "bullet",
                "text": "بطاقات ملخص في أعلى الشاشة: إجمالي السطور / رصيد صفري أو سالب / رصيد سالب فقط — بالألوان الرمادية/الكهرمانية/الحمراء على التوالي.",
            },
            {
                "kind": "bullet",
                "text": "تلوين خلفية السطر: أحمر فاتح للسالب، كهرماني فاتح للصفري، أبيض للطبيعي.",
            },
            {
                "kind": "bullet",
                "text": "أيقونة تحذير ⚠ بجانب الرقم السالب، ونقطة • بجانب الصفري، بالألوان المطابقة.",
            },
            {
                "kind": "paragraph",
                "text": (
                    "هذا التطبيق متعدد المستويات يضمن أن المستخدم يلاحظ المشكلة فوراً حتى من بعيد، ولا يحتاج "
                    "لمسح كل سطر على حدة — مهم في مخزون busy حيث قد تكون مئات السطور."
                ),
            },
        ],
    },
    {
        "heading": "4. فجوات Backend لازم تتسد (إضافات فقط)",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "Endpoints موجودة: POST /inventory/item-categories، POST /inventory/warehouses، "
                    "POST /inventory/items، GET /inventory/items/{uuid}، GET /inventory/items (مع ?search=)، "
                    "GET /inventory/stock-balance. كل هذه تعمل ولا تحتاج أي تعديل."
                ),
            },
            {
                "kind": "paragraph",
                "text": "Endpoints ناقصة (نفس النمط الإضافي مثل المشتريات):",
            },
            {
                "kind": "code",
                "text": (
                    "# app/modules/inventory/router.py — أضف هذين الـ Endpoints\n\n"
                    "@router.get(\"/item-categories\", response_model=list[ItemCategoryRead])\n"
                    "async def list_item_categories(\n"
                    "    token: TokenPayload = Depends(get_current_token),\n"
                    "    db: AsyncSession = Depends(get_db_with_context),\n"
                    "):\n"
                    "    \"\"\"Additive endpoint. RLS already scopes results.\"\"\"\n"
                    "    repo = ItemCategoryRepository(db)\n"
                    "    rows, _ = await repo.list(company_id=_company_id(token), limit=200, offset=0)\n"
                    "    return rows\n\n\n"
                    "@router.get(\"/warehouses\", response_model=list[WarehouseRead])\n"
                    "async def list_warehouses(\n"
                    "    token: TokenPayload = Depends(get_current_token),\n"
                    "    db: AsyncSession = Depends(get_db_with_context),\n"
                    "):\n"
                    "    \"\"\"Additive endpoint. RLS already scopes results.\"\"\"\n"
                    "    repo = WarehouseRepository(db)\n"
                    "    rows, _ = await repo.list(company_id=_company_id(token), limit=200, offset=0)\n"
                    "    return rows"
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "ملاحظة: لو الـ repository على الـ backend مفيهوش ميثود list() لـ ItemCategory أو Warehouse، "
                    "أضفها بنفس نمط ItemRepository.list() (ترجّع tuple من rows + total). الفجوة موثَّقة في CHANGELOG "
                    "Phase 3 \"Remaining #2\": base_uom_id مثبَّت على 1 — حتى يتسد ذلك، الواجهة ترسل DEFAULT_UOM_UUID "
                    "(قيمة ثابتة) كحل مؤقت مع تعليق TODO واضح في الكود."
                ),
            },
        ],
    },
    {
        "heading": "5. التحقق الفعلي (Tested)",
        "level": 1,
        "blocks": [
            {"kind": "bullet", "text": "npx tsc --noEmit — صفر أخطاء (بعد إصلاح نوع allow_negative_stock في Zod schema)."},
            {"kind": "bullet", "text": "npm run build — صفر أخطاء، 239 module transformed، 469 KB JS bundle."},
            {"kind": "bullet", "text": "npm run preview — HTTP 200 على /."},
            {
                "kind": "paragraph",
                "text": (
                    "شاشة رصيد المخزون تستهلك GET /inventory/stock-balance الذي يعمل بـ View فيز2 (reporting.v_stock_balance) — "
                    "هذا Endpoint موجود وتم اختباره فعلياً في Phase 2. لذا الشاشة ستعمل فوراً بمجرد تشغيل الباك إند، "
                    "حتى قبل إضافة الـ Endpoints القائمة الناقصة لباقي شاشات المخزون."
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
                    ["لا تعديل app/core/*", "✓ لم نلمسها"],
                    ["لا تعديل أي Endpoint موجود", "✓ لم نلمس أي router/service/repository"],
                    ["لا حذف أي Business Rule", "✓ لم نلمس أي service.py — BD-001 (allow_negative_stock) محفوظ كـ default false"],
                    ["UUID فقط، لا id رقمي داخلي", "✓ كل الـ types والـ API calls تستخدم uuid"],
                    ["عربي RTL بالكامل", "✓ كل النصوص عربي، RTL في layout"],
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
                    "المرحلة 3: موديول المحاسبة — شجرة الحسابات (Tree View) + القيود اليومية مع التحقق الفوري من "
                    "التوازن (مجموع المدين = مجموع الدائن) + ميزان المراجعة. هذه أكثر موديول فيه تعقيد لأن:"
                ),
            },
            {
                "kind": "bullet",
                "text": "شجرة الحسابات تتطلب Tree View قابل للطي/الفتح (مش جدول عادي).",
            },
            {
                "kind": "bullet",
                "text": "BR-ACC-001: لا تعديل على JournalEntry بعد الاعتماد — لا حتى Endpoint تعديل موجود في الباك إند، والواجهة تعكس ذلك بعدم إظهار أي زر تعديل.",
            },
            {
                "kind": "bullet",
                "text": "BR-ACC-003: التحقق من التوازن يتم في الواجهة فوراً (live) قبل الإرسال، وزر الحفظ معطَّل لو غير متوازن.",
            },
            {
                "kind": "bullet",
                "text": "ميزان المراجعة يحتاج Endpoint جديد GET /accounting/trial-balance (مذكور في §11).",
            },
        ],
    },
]

build_report(
    OUTPUT,
    title="ERP Lite Frontend — تقرير المرحلة 2: موديول المخزون",
    subtitle="Inventory Module — Items + Categories + Warehouses + Stock Balance",
    sections=SECTIONS,
)
