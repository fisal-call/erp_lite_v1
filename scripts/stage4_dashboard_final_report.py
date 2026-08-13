"""
stage4_dashboard_final_report.py
Builds the Stage 4 (Dashboard + Final) status report.
"""
from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

from generate_stage_report import build_report

OUTPUT = Path("/home/z/my-project/download/Stage-4-Dashboard-Final-Report.docx")

SECTIONS = [
    {
        "heading": "1. نظرة عامة",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "هذا التقرير يوثّق المرحلة الرابعة والأخيرة من بناء واجهة ERP Lite: لوحة المتابعة (Dashboard) "
                    "وشاشتي الإعدادات (المستخدمون + الشركة). كما يقدم ملخصاً نهائياً للمشروع ككل، بما في ذلك "
                    "قائمة شاملة بكل فجوات الـ Backend اللازمة لتشغيل كل الشاشات."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "أهم قرار معماري في هذه المرحلة: رفض التظاهر بأرقام غير موجودة. المواصفة §2 تطلب بطاقات "
                    "للإجماليات المالية، لكن الـ Backend لا يوفر بعد لا الحقول ولا الـ Endpoints اللازمة. "
                    "بدلاً من عرض أصفار مضلِّلة أو أرقام عشوائية، تعرض الواجهة رسائل صريحة \"غير متاح\" مع "
                    "ذكر الـ Endpoint المطلوب إضافته. هذا التطبيق للشفافية يحترم القاعدة الذهبية في المشروع: "
                    "لا تكسر حاجة شغالة، ولا تتظاهر بوجود حاجة مش موجودة."
                ),
            },
        ],
    },
    {
        "heading": "2. الشاشات المبنية في هذه المرحلة",
        "level": 1,
        "blocks": [
            {
                "kind": "table",
                "headers": ["المسار", "الشاشة", "الحالة", "ملاحظات"],
                "rows": [
                    ["/", "لوحة المتابعة", "✓ مكتمل", "4 بطاقات + ملخص مخزون + تبويب أوامر (بيع/شراء) — مع degradation صريح"],
                    ["/settings/users", "المستخدمون", "✓ مكتمل", "معطَّلة مؤقتاً لأسباب أمنية (CHANGELOG Phase 3 #4)"],
                    ["/settings/company", "الشركة", "✓ مكتمل", "عرض بيانات JWT الأساسية — يحتاج GET /core/companies/current"],
                ],
            },
        ],
    },
    {
        "heading": "3. لوحة المتابعة — استراتيجية الـ Graceful Degradation",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": "المواصفة §2 تطلب 4 بطاقات:",
            },
            {
                "kind": "table",
                "headers": ["البطاقة", "المطلوب", "التطبيق الفعلي", "السبب"],
                "rows": [
                    [
                        "إجمالي المبيعات هذا الشهر",
                        "مجموع sales_invoice.total_amount بحالة submitted+",
                        "عدد أوامر البيع هذا الشهر (بدون مبلغ)",
                        "لا يوجد موديول sales_invoice في الباك إند، والـ SalesOrderSummary DTO ما فيهوش total_amount",
                    ],
                    [
                        "إجمالي المشتريات هذا الشهر",
                        "مجموع purchase_invoice.total_amount بحالة submitted+",
                        "عدد أوامر الشراء هذا الشهر (بدون مبلغ)",
                        "نفس السبب — purchase_invoice غير موجود بعد",
                    ],
                    [
                        "ذمم مدينة (عملاء)",
                        "reporting.v_customer_outstanding مجموع balance_due",
                        "بطاقة \"غير متاح\" مع اسم الـ Endpoint المطلوب",
                        "ما فيش Endpoint يكشف الـ View ده — مذكور في §11",
                    ],
                    [
                        "ذمم دائنة (موردين)",
                        "reporting.v_supplier_outstanding مجموع balance_due",
                        "بطاقة \"غير متاح\" مع اسم الـ Endpoint المطلوب",
                        "نفس السبب — مذكور في §11",
                    ],
                ],
            },
            {
                "kind": "paragraph",
                "text": (
                    "ملخص رصيد المخزون (الذي اشتُقَّ من GET /inventory/stock-balance الموجود بالفعل) يظهر كـ "
                    "بطاقة إضافية بين البطاقات والجدول — هذا يضيف قيمة فعلية للوحة حتى قبل إضافة أي "
                    "Endpoints جديدة."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "جدول آخر 10 أوامر (بيع/شراء) في تبويبات يعمل بشكل كامل من الـ Endpoints الموجودة. "
                    "التبويب الافتراضي هو المبيعات. كل صف يعرض رقم الأمر + التاريخ + شارة الحالة + زر عرض."
                ),
            },
        ],
    },
    {
        "heading": "4. شاشة المستخدمون — القرار الأمني",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "المواصفة §7.1 تنص صراحة: \"يحتاج حماية Admin أولاً قبل نشر هذه الشاشة للعامة\". "
                    "CHANGELOG Phase 3 \"Remaining #4\" يكرر نفس التحذير: POST /security/users بلا حماية بعد الإطلاق الأول."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "القرار: عدم تقديم نموذج إنشاء مستخدم في الواجهة طالما الـ Endpoint غير محمي. بدلاً من ذلك، "
                    "تعرض الشاشة صندوقاً كهرمانياً يشرح الفجوة الأمنية بوضوح، ويوجه المستخدم لاستخدام /docs "
                    "أو curl مؤقتاً لإنشاء المستخدمين. هذا أنسب من \"تعطيل الزر\" لأنه يمنع حتى مجرد ظهور "
                    "الإمكانية في الـ UI — حتى لا يظن أي مستخدم عابر أن النظام يقبل إنشاء مستخدمين بدون حماية."
                ),
            },
            {
                "kind": "paragraph",
                "text": (
                    "بمجرد إضافة الحماية (Admin guard أو setup-wizard flow) في الباك إند، يمكن استبدال الصندوق "
                    "الكهرماني بالنموذج الفعلي دون أي تعديل آخر في الكود."
                ),
            },
        ],
    },
    {
        "heading": "5. فجوات Backend الإجمالية للمشروع كله",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "هذه قائمة شاملة بكل Endpoints الـ Additive المطلوبة لتشغيل كل شاشات الواجهة. كل منها "
                    "مذكور في تقرير المرحلة المعنية بالتفصيل مع الكود الجاهز للنسخ. تجمعها هنا للراحة."
                ),
            },
            {
                "kind": "table",
                "headers": ["الـ Endpoint", "الشاشة/الشاشات المستفيدة", "المرحلة", "الأولوية"],
                "rows": [
                    ["GET /purchasing/suppliers", "قائمة الموردين + SupplierAutocomplete", "1", "عالية"],
                    ["GET /purchasing/purchase-orders", "قائمة أوامر الشراء + Dashboard", "1", "عالية"],
                    ["GET /inventory/item-categories", "قائمة الفئات + Dropdown في نموذج الصنف", "2", "عالية"],
                    ["GET /inventory/warehouses", "قائمة المخازن + فلتر رصيد المخزون", "2", "متوسطة"],
                    ["GET /inventory/uoms", "Dropdown وحدة القياس في نموذج الصنف", "2", "منخفضة (الحل المؤقت شغّال)"],
                    ["GET /accounting/accounts", "شجرة الحسابات + Dropdown في القيود", "3", "عالية"],
                    ["GET /accounting/journal-entries", "قائمة القيود + Dashboard", "3", "عالية"],
                    ["GET /accounting/trial-balance", "ميزان المراجعة", "3", "عالية"],
                    ["GET /reporting/customer-outstanding", "بطاقة الذمم المدينة في Dashboard", "4", "متوسطة"],
                    ["GET /reporting/supplier-outstanding", "بطاقة الذمم الدائنة في Dashboard", "4", "متوسطة"],
                    ["GET /reporting/dashboard-summary", "البطاقات المالية في Dashboard", "4", "متوسطة (الحل المؤقت شغّال)"],
                    ["GET /core/companies/current", "شاشة الشركة", "4", "منخفضة"],
                    ["حماية Admin على POST /security/users", "تفعيل شاشة المستخدمين", "4", "حرجة قبل الإطلاق"],
                ],
            },
            {
                "kind": "paragraph",
                "text": (
                    "ملاحظة: كل Endpoints عالية الأولوية (10 endpoints) صغيرة الحجم (10-20 سطر لكل واحد) "
                    "وتتبع نفس النمط الإضافي الحرفي. التقدير: 2-3 ساعات عمل backend كافية لتطبيق الـ 10 "
                    "Endpoints جميعاً، لأن النمط متكرر والـ repository layer موجود بالفعل لكل موديول."
                ),
            },
        ],
    },
    {
        "heading": "6. الإحصائيات النهائية للمشروع",
        "level": 1,
        "blocks": [
            {
                "kind": "table",
                "headers": ["المقياس", "القيمة"],
                "rows": [
                    ["عدد المراحل المنفذة", "5 (Stage 0 + 4 مراحل)"],
                    ["عدد الشاشات الإجمالي", "23 شاشة"],
                    ["عدد المكونات القابلة لإعادة الاستخدام", "5 (StatusBadge, ItemAutocomplete, CustomerAutocomplete, SupplierAutocomplete, CurrencyPicker)"],
                    ["عدد موديولات الـ API", "6 (sales, purchasing, inventory, accounting, core_org, dashboard)"],
                    ["حجم الـ Bundle النهائي (Production)", "504 KB JS (146 KB gzipped), 21 KB CSS (5 KB gzipped)"],
                    ["عدد الـ modules المُحوَّلة", "250"],
                    ["Build time", "~335ms"],
                    ["TypeScript errors", "0"],
                    ["أسطر كود TypeScript/TSX (تقريبي)", "~3,200 سطر"],
                ],
            },
        ],
    },
    {
        "heading": "7. الالتزام بالقواعد الصارمة — التحقق النهائي",
        "level": 1,
        "blocks": [
            {
                "kind": "table",
                "headers": ["القاعدة من 00-START-HERE-STRICT-PROMPT.md", "الالتزام"],
                "rows": [
                    ["ممنوع تعديل أي ملف في /sql/", "✓ لم نلمسها إطلاقاً"],
                    ["ممنوع تعديل app/core/database.py أو dependencies.py", "✓ لم نلمسها إطلاقاً"],
                    ["ممنوع تعديل أي Endpoint موجود", "✓ لم نلمس أي router/service/repository في الـ backend"],
                    ["ممنوع حذف أي Business Rule check", "✓ لم نلمس أي service.py — كل BRs محفوظة (BR-SAL-009, BR-PUR-010, BR-ACC-001, BR-ACC-003, BD-001, BD-010)"],
                    ["ممنوع تغيير اسم جدول/عمود/Response shape", "✓ كل الـ types تنسخ Pydantic DTOs حرفياً"],
                    ["UUID فقط، لا id رقمي داخلي", "✓ في كل مكان"],
                    ["عربي RTL بالكامل", "✓ html { direction: rtl }, كل النصوص عربية"],
                    ["نفس قالب المبيعات للمشتريات", "✓ تطابق حرفي"],
                    ["اتبع المواصفة حرفياً", "✓ كل شاشة تتبع §X.X الخاصة بها"],
                    ["React 18 + TS + Router + TanStack Query + react-hook-form + Zod", "✓ كلها مستخدمة"],
                ],
            },
        ],
    },
    {
        "heading": "8. ما لم يُختبَر فعلياً (شفافية كاملة)",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": (
                    "تطبيقاً لمبدأ المشروع (التحقق بالتنفيذ الفعلي دائماً)، نوضّح بصراحة ما تم اختباره وما لم يتم:"
                ),
            },
            {
                "kind": "bullet",
                "text": "✓ تم: npx tsc --noEmit (صفر أخطاء) — كل مرحلة.",
            },
            {
                "kind": "bullet",
                "text": "✓ تم: npm run build (Production build ناجح) — كل مرحلة.",
            },
            {
                "kind": "bullet",
                "text": "✓ تم: npm run preview (سيرفر شغّال ويرجّع HTTP 200) — كل مرحلة.",
            },
            {
                "kind": "bullet",
                "text": "✓ تم: التحقق من أن الكود يتبع عقد الـ API بدقة (نسخ الحقول من schemas.py حرفياً).",
            },
            {
                "kind": "bullet",
                "text": "✗ لم يتم: اختبار حقيقي عبر متصفح متصل بالباك إند الفعلي (لأن الباك إند مش شغّال في هذه البيئة، ولأن عدد من الـ Endpoints الإضافية لسه ما اتضافتش).",
            },
            {
                "kind": "paragraph",
                "text": (
                    "التوصية لمالك المشروع: بعد إضافة الـ Endpoints الإضافية الـ 10 وتشغيل الباك إند، خد جولة "
                    "بصرية كاملة عبر المتصفح. ابدأ بتسجيل الدخول، أنشئ عميلاً وأمر بيع، جرّب الاعتماد، ثم "
                    "كرّر مع مورد وأمر شراء، ثم أصناف ومخازن ورصيد، وأخيراً الحسابات والقيود وميزان المراجعة. "
                    "هذه الجولة وحدها قادرة على كشف أي فجوة نظرية لم نلتقطها بالـ build فقط."
                ),
            },
        ],
    },
    {
        "heading": "9. الخطوات التالية الموصى بها",
        "level": 1,
        "blocks": [
            {
                "kind": "paragraph",
                "text": "بترتيب الأولوية:",
            },
            {
                "kind": "bullet",
                "text": "1) أضف الـ 10 Endpoints الإضافية المذكورة في القسم 5 (2-3 ساعات عمل backend). كل الكود الجاهز للنسخ موجود في تقارير المراحل 1-4.",
            },
            {
                "kind": "bullet",
                "text": "2) أضف حماية Admin على POST /security/users (حرج قبل أي استخدام عام).",
            },
            {
                "kind": "bullet",
                "text": "3) شغّل الباك إند + الفرونت إند مع بعض، وخد جولة بصرية كاملة عبر المتصفح.",
            },
            {
                "kind": "bullet",
                "text": "4) أضف موديولات الـ sales_invoice / purchase_invoice / payments في الباك إند (موديولات Phase 5 مخطط لها، مش مبنية بعد) — بعدها البطاقات المالية في الـ Dashboard تشتغل تلقائياً.",
            },
            {
                "kind": "bullet",
                "text": "5) فكّر في code-splitting لـ React bundle (التحذير ظهر في الـ build لأن الـ bundle تجاوز 500 KB) — للأنظمة الإنتاجية الكبيرة، لكنه ليس أولوية للـ MVP.",
            },
            {
                "kind": "bullet",
                "text": "6) فكّر في نقل JWT من localStorage إلى httpOnly cookie قبل أي إطلاق عام واسع (موثَّق في CHANGELOG Phase 4 Risks).",
            },
        ],
    },
]

build_report(
    OUTPUT,
    title="ERP Lite Frontend — تقرير المرحلة 4: لوحة المتابعة + التقرير النهائي",
    subtitle="Dashboard + Settings + Final Project Summary",
    sections=SECTIONS,
)
