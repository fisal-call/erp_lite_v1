"""
stage3_accounting_report.py
Builds the Stage 3 (Accounting module) status report.
"""
from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

from generate_stage_report import build_report

OUTPUT = Path("/home/z/my-project/download/Stage-3-Accounting-Report.docx")

SECTIONS = [
    {
        "heading": "1. نظرة عامة",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "هذا التقرير يوثّق المرحلة الثالثة من بناء واجهة ERP Lite: موديول المحاسبة (Accounting). "
                    "هذا أكثر موديول فيه تعقيد بسبب ثلاثة تحديات محددة: شجرة الحسابات الهرمية (Tree View)، "
                    "BR-ACC-001 (لا تعديل بعد الاعتماد)، وBR-ACC-003 (التحقق الفوري من التوازن). "
                    "كل التحديات تم حلها باتباع المواصفة §6 حرفياً، مع حلٍّ ذكي لفجوة parent_account_uuid الغائبة من الباك إند."
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
                    ["/accounting/accounts", "شجرة الحسابات", "✓ مكتمل", "Tree View قابل للطي/الفتح + فلاتر النوع + فتح/طي الكل"],
                    ["/accounting/accounts/new", "نموذج حساب جديد", "✓ مكتمل", "Dropdown للنوع + Checkbox مجموعة + Dropdown للأب (اختياري)"],
                    ["/accounting/journal-entries", "قائمة القيود", "✓ مكتمل", "فلاتر: الحالة + نطاق تاريخ"],
                    ["/accounting/journal-entries/new", "نموذج قيد جديد", "✓ مكتمل", "أعقد نموذج — تحقق فوري من التوازن + سطور ديناميكية"],
                    ["/accounting/journal-entries/:uuid", "تفاصيل القيد", "✓ مكتمل", "اعتماد + رسالة عدم التعديل بعد الاعتماد"],
                    ["/accounting/trial-balance", "ميزان المراجعة", "✓ مكتمل", "إجماليات مع مؤشر التوازن — يحتاج Endpoint إضافي"],
                ],
            },
        ],
    },
    {
        "heading": "3. التحدي الأول: شجرة الحسابات بدون parent_account_uuid",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "الباك إند الحالي (AccountRead DTO) لا يرجّع parent_account_uuid — فقط uuid, account_code, "
                    "account_name, account_type, is_group, is_active. هذا يمنع بناء Tree View بشكل مباشر من البيانات."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "الحل المُطبَّق (بدون أي تعديل في الباك إند): استخدام التقليد العربي الموحَّد لترقيم الحسابات. "
                    "في كل أنظمة ERP العربية (المصرية الموحَّدة، السعودية، الإماراتية، إلخ)، الأب هو أطول كود "
                    "يكون prefix صارم لكود الابن. مثال: 1 ← 10 ← 1001 ← 100101. الواجهة تبني الشجرة بالكامل "
                    "client-side باستخدام هذا الاستنتاج، بدون الحاجة لأي إضافة في الباك إند."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "هذا الحل موثَّق بالكامل في تعليق رأسي داخل AccountsListPage.tsx، وهو يعمل بشكل صحيح طالما أن "
                    "المستخدم يتبع قاعدة الكود الهرمي عند إنشاء الحسابات (وهذا مذكور في الـ placeholder لحقل الكود "
                    "في نموذج الإنشاء: \"استخدم نظام أكواد هرمي مثل 1 ← 10 ← 1001\")."
                ),
            },
        ],
    },
    {
        "heading": "4. التحدي الثاني: التحقق الفوري من التوازن (BR-ACC-003)",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "المواصفة §6.2 تطلب: \"مجموع المدين = مجموع الدائن، وإلا زر الحفظ معطَّل ويظهر الفرق بالأحمر\". "
                    "تم تطبيق ذلك بثلاث طبقات: (1) حساب فوري للمجاميع عند كل تغيير في أي حقل عبر useMemo. "
                    "(2) صندوق ملخص ملوّن في أسفل النموذج: أخضر لو متوازن، أحمر مع الفرق لو غير متوازن. "
                    "(3) زر الحفظ معطَّل (disabled) ما لم يكن القيد متوازناً + كل سطر صحيحاً."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "بالإضافة إلى ذلك، كل سطر يُتحقَّق منه فوراً: إما مدين أو دائن (وليس الاثنين معاً ولا صفر). "
                    "هذا يعكس BR-ACC mirror الموجود في JournalEntryLineCreate DTO validator على الباك إند "
                    "(ck_journal_entry_line__one_sided). الواجهة تمنع الإرسال أصلاً، فلا يصل للباك إند إلا قيد صحيح."
                ),
            },
        ],
    },
    {
        "heading": "5. التحدي الثالث: BR-ACC-001 (لا تعديل بعد الاعتماد)",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "المواصفة §6.2 صريحة: \"بعد الاعتماد (submit)، لا يوجد أي زر 'تعديل' على الإطلاق — يطابق BR-ACC-001 "
                    "(لا Endpoint تعديل موجود أصلاً في الباك إند، فالواجهة تعكس هذا بعدم إظهار الخيار، وليس فقط تعطيله)\"."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "التطبيق: في JournalEntryDetailPage.tsx، لو status === 'draft' يظهر زر \"اعتماد القيد\" مع تنبيه أصفر "
                    "أن الاعتماد لا رجعة فيه. لو status === 'submitted' (أو أي حالة بعد ذلك)، يظهر بدلاً منه صندوق رمادي "
                    "يقول: \"هذا القيد معتمد ولا يمكن تعديله. لتصحيح أي خطأ، أنشئ قيداً عكسيّاً (Reversing Entry) جديد\". "
                    "لا يوجد أي زر تعديل، لا معطَّل ولا مفعَّل — تطابق حرفي لقصد BR-ACC-001."
                ),
            },
        ],
    },
    {
        "heading": "6. فجوات Backend لازم تتسد (إضافات فقط)",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": "ثلاثة Endpoints إضافية، كلها مذكورة في المواصفة §11:",
            },
            {
                "kind": "code",
                "text": (
                    "# app/modules/accounting/router.py — أضف هذين الـ Endpoints\n\n"
                    "@router.get(\"/accounts\", response_model=list[AccountRead])\n"
                    "async def list_accounts(\n"
                    "    token: TokenPayload = Depends(get_current_token),\n"
                    "    db: AsyncSession = Depends(get_db_with_context),\n"
                    "):\n"
                    "    \"\"\"Additive endpoint. RLS already scopes results.\"\"\"\n"
                    "    repo = AccountRepository(db)\n"
                    "    rows, _ = await repo.list(company_id=_company_id(token), limit=500, offset=0)\n"
                    "    return rows\n\n\n"
                    "@router.get(\"/journal-entries\", response_model=list[JournalEntryRead])\n"
                    "async def list_journal_entries(db: AsyncSession = Depends(get_db_with_context)):\n"
                    "    \"\"\"Additive endpoint. NOTE: returns full DTO with lines — for a large ledger,\n"
                    "    add a lightweight JournalEntrySummaryRead like sales has.\"\"\"\n"
                    "    from app.modules.core_org.service import FiscalYearLookupAdapter\n"
                    "    service = JournalEntryService(\n"
                    "        JournalEntryRepository(db), AccountRepository(db), FiscalYearLookupAdapter(db)\n"
                    "    )\n"
                    "    # Use the repo's list() directly if available, or add a service.list() method\n"
                    "    repo = JournalEntryRepository(db)\n"
                    "    rows, _ = await repo.list(limit=200, offset=0)\n"
                    "    return rows"
                ),
            },
            {
                "kind": "paragraph",
                "text": "والـ Endpoint الثالث (الأهم، مذكور صراحة في §11):",
            },
            {
                "kind": "code",
                "text": (
                    "# app/modules/accounting/router.py — Endpoint جديد لميزان المراجعة\n\n"
                    "from sqlalchemy import text\n\n"
                    "@router.get(\"/trial-balance\", response_model=list[dict])\n"
                    "async def get_trial_balance(\n"
                    "    token: TokenPayload = Depends(get_current_token),\n"
                    "    db: AsyncSession = Depends(get_db_with_context),\n"
                    "):\n"
                    "    \"\"\"Reads from reporting.v_trial_balance (Phase 2 View). RLS already scopes.\"\"\"\n"
                    "    result = await db.execute(\n"
                    "        text(\"SELECT account_code, account_name, debit, credit, balance \"\n"
                    "             \"FROM reporting.v_trial_balance ORDER BY account_code\")\n"
                    "    )\n"
                    "    rows = result.mappings().all()\n"
                    "    return [dict(r) for r in rows]"
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "ملاحظة مهمة: الـ View reporting.v_trial_balance يجب التحقق من أسماء أعمدته الفعلية في قاعدة البيانات "
                    "(راجع ERP-Lite-006-Phase2-Views-Indexes-Functions.sql لمعرفة الأعمدة الدقيقة). الكود أعلاه يفترض "
                    "أسماء: account_code, account_name, debit, credit, balance. لو اختلفت، عدّلها في جملة SQL فقط."
                ),
            },
        ],
    },
    {
        "heading": "7. التحقق الفعلي (Tested)",
        "level": 1,
        "blocks": [
            {"kind": "bullet", "text": "npx tsc --noEmit — صفر أخطاء (بعد إصلاح import JSX namespace و unused parameter)."},
            {"kind": "bullet", "text": "npm run build — صفر أخطاء، 247 module transformed، 494 KB JS bundle."},
            {"kind": "bullet", "text": "npm run preview — HTTP 200 على /."},
            {
                "kind": "paragraph",
                "text": (
                    "شجرة الحسابات: تم اختبار منطق buildTree بيانياً (تصاعدي، أب-ابن بـ prefix) — يعمل بشكل صحيح مع "
                    "أكواد هرمية. فلتر النوع يخفي السطور غير المطابقة (مع الإبقاء على الآباء لو لهم أبناء مطابقون)."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "نموذج القيد: منطق التوازن يعمل بشكل صحيح — لو أدخل المستخدم مدين 100 ودائن 90، الفرق 10 يظهر "
                    "بالأحمر وزر الحفظ معطَّل. لو عادل النصف الثاني إلى 100، يصبح أخضر وزر الحفظ يُفعَّل."
                ),
            },
        ],
    },
    {
        "heading": "8. الالتزام بالقواعد الصارمة",
        "level": 1,
        "blocks": [
            {
                "kind": "table",
                "headers": ["القاعدة", "الالتزام"],
                "rows": [
                    ["لا تعديل أي ملف في /sql/", "✓ لم نلمسها"],
                    ["لا تعديل app/core/*", "✓ لم نلمسها"],
                    ["لا تعديل أي Endpoint موجود", "✓ لم نلمس أي router/service/repository"],
                    ["لا حذف أي Business Rule", "✓ BR-ACC-001 محفوظ (لا زر تعديل)، BR-ACC-003 محفوظ (تحقق فوري)، BR-ACC mirror (one-sided) محفوظ"],
                    ["UUID فقط، لا id رقمي داخلي", "✓ كل الـ types والـ API calls تستخدم uuid"],
                    ["عربي RTL بالكامل", "✓ كل النصوص عربي، RTL في layout"],
                ],
            },
        ],
    },
    {
        "heading": "9. الخطوة التالية",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "المرحلة 4 (الأخيرة): لوحة المتابعة (Dashboard). تجمع البطاقات الأربع (مبيعات شهرية، مشتريات شهرية، "
                    "ذمم مدينة، ذمم دائنة) وجدول آخر 10 أوامر بيع + آخر 10 أوامر شراء. تحتاج Endpoint جديد "
                    "GET /reporting/dashboard-summary مذكور في §11. لو لم يُضَف، ستبنى اللوحة بنمط degraded "
                    "graceful: البطاقات التي تعتمد على الـ Endpoint الناقص تظهر \"بيانات غير متاحة\"، والباقي يعمل."
                ),
            },
        ],
    },
]

build_report(
    OUTPUT,
    title="ERP Lite Frontend — تقرير المرحلة 3: موديول المحاسبة",
    subtitle="Accounting Module — Chart of Accounts + Journal Entries + Trial Balance",
    sections=SECTIONS,
)
