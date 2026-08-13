#!/usr/bin/env python3
"""
ERP-Lite v1.0 — Final Deliverable Packaging Script
====================================================
Produces a single self-contained zip with the full project (frontend source +
production build, backend source, SQL migrations, run scripts, docs) plus a
top-level README.md outside the zip for quick reference.

Output:
  /home/z/my-project/download/ERP-Lite-v1.0.zip
  /home/z/my-project/download/README.md
"""
from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

PROJECT_ROOT = Path("/home/z/my-project")
DOWNLOAD_DIR = PROJECT_ROOT / "download"
STAGING_DIR = PROJECT_ROOT / "scripts" / "_staging_erplite"
ZIP_OUT = DOWNLOAD_DIR / "ERP-Lite-v1.0.zip"
README_OUT = DOWNLOAD_DIR / "README.md"

# ---------------------------------------------------------------------------
# 1. Prepare staging directory
# ---------------------------------------------------------------------------
if STAGING_DIR.exists():
    shutil.rmtree(STAGING_DIR)
STAGING_DIR.mkdir(parents=True)

# ---------------------------------------------------------------------------
# 2. Copy backend (excluding __pycache__, .pytest_cache, .venv, *.pyc)
# ---------------------------------------------------------------------------
backend_src = PROJECT_ROOT / "erplite-backend"
backend_dst = STAGING_DIR / "erplite-backend"
shutil.copytree(
    backend_src,
    backend_dst,
    ignore=shutil.ignore_patterns(
        "__pycache__",
        "*.pyc",
        ".pytest_cache",
        ".venv",
        "venv",
        "*.egg-info",
        ".mypy_cache",
        ".ruff_cache",
    ),
)
print(f"[ok] backend copied: {sum(1 for _ in backend_dst.rglob('*'))} entries")

# ---------------------------------------------------------------------------
# 3. Copy frontend (excluding node_modules, dist cache, but INCLUDING dist build)
# ---------------------------------------------------------------------------
frontend_src = PROJECT_ROOT / "erplite-frontend"
frontend_dst = STAGING_DIR / "erplite-frontend"
shutil.copytree(
    frontend_src,
    frontend_dst,
    ignore=shutil.ignore_patterns(
        "node_modules",
        ".vite",
        "*.log",
        ".DS_Store",
    ),
)
print(f"[ok] frontend copied: {sum(1 for _ in frontend_dst.rglob('*'))} entries")
print(f"     dist size: {sum(f.stat().st_size for f in (frontend_dst / 'dist').rglob('*') if f.is_file()) // 1024} KB")

# ---------------------------------------------------------------------------
# 4. Copy SQL migrations
# ---------------------------------------------------------------------------
sql_src = PROJECT_ROOT / "sql"
sql_dst = STAGING_DIR / "sql"
shutil.copytree(sql_src, sql_dst)
print(f"[ok] sql copied: {len(list(sql_dst.glob('*.sql')))} migration files")

# ---------------------------------------------------------------------------
# 5. Copy run scripts (start_backend, start_frontend, start_pg, smoke tests)
# ---------------------------------------------------------------------------
scripts_src = PROJECT_ROOT / "scripts"
scripts_dst = STAGING_DIR / "scripts"
shutil.copytree(
    scripts_src,
    scripts_dst,
    ignore=shutil.ignore_patterns("_staging_erplite", "__pycache__", "*.pyc"),
)
print(f"[ok] scripts copied: {len(list(scripts_dst.glob('*.py')))} python scripts")

# ---------------------------------------------------------------------------
# 6. Copy key documentation
# ---------------------------------------------------------------------------
docs_to_copy = [
    "00-START-HERE-STRICT-PROMPT.md",
    "BACKEND_ARCHITECTURE.md",
    "ERP-Lite-CHANGELOG.md",
    "ERP-Lite-Frontend-Specification.md",
    "HOW-TO-FINISH-BACKEND.md",
    "ERP_LITE_V1_FINAL_AUDIT.md",
    "FRONTEND_FINAL_ACCEPTANCE.md",
]
docs_dst = STAGING_DIR / "docs"
docs_dst.mkdir(exist_ok=True)
for fname in docs_to_copy:
    src = PROJECT_ROOT / fname
    if src.exists():
        shutil.copy2(src, docs_dst / fname)
print(f"[ok] docs copied: {len(list(docs_dst.glob('*.md')))} files")

# ---------------------------------------------------------------------------
# 7. Generate top-level README inside the package (Arabic-first)
# ---------------------------------------------------------------------------
PKG_README = """# ERP-Lite v1.0 — منتج نهائي قابل للتسليم

> نظام ERP مبسط عربي-أول (Arabic-first) RTL، مبني بـ React + FastAPI + PostgreSQL.

## المحتويات

```
ERP-Lite-v1.0/
├── erplite-backend/      # FastAPI + SQLAlchemy 2.0 (async) + asyncpg
│   ├── app/              # 58 ملف Python، 5,548 سطر، 74 routes
│   ├── tests/            # اختبارات sales flow + v1 finalization
│   ├── requirements.txt
│   └── .env.example
├── erplite-frontend/     # React 19 + TypeScript + Vite + Tailwind 4
│   ├── src/              # 93 ملف TS/TSX، 11,780 سطر
│   ├── dist/             # ✅ production build جاهز للنشر
│   ├── package.json
│   └── .env.example
├── sql/                  # 8 ملفات هجرات PostgreSQL
│   ├── ERP-Lite-001-System-Security-Core.sql
│   ├── ERP-Lite-002-Inventory.sql
│   ├── ERP-Lite-003-Purchasing-Sales.sql
│   ├── ERP-Lite-004-Accounting-Partitions.sql
│   ├── ERP-Lite-005-SeedData-RLS.sql
│   ├── ERP-Lite-006-Phase2-Views-Indexes-Functions.sql
│   ├── ERP-Lite-007-BootstrapRole.sql
│   └── ERP-Lite-008-CostCenters.sql
├── scripts/              # سكربتات تشغيل واختبار
│   ├── start_pg.py       # تشغيل PostgreSQL
│   ├── start_backend.py  # تشغيل Backend على :8000
│   ├── start_frontend.py # تشغيل Frontend dev server على :5173
│   ├── apply_migrations.py
│   ├── smoke_test.py
│   └── smoke_test_extended.py
└── docs/                 # توثيق شامل + تقارير التدقيق
    ├── ERP_LITE_V1_FINAL_AUDIT.md
    ├── FRONTEND_FINAL_ACCEPTANCE.md
    ├── BACKEND_ARCHITECTURE.md
    └── ERP-Lite-CHANGELOG.md
```

## المتطلبات

| المكون | الإصدار المطلوب |
|---|---|
| Python | 3.11+ |
| Node.js | 20+ |
| PostgreSQL | 15+ |
| npm | 10+ |

## خطوات التشغيل السريع

### 1) إعداد قاعدة البيانات

```bash
# إنشاء قاعدة بيانات PostgreSQL
createdb erplite

# إنشاء الأدوار (وفق ERP-Lite-005 + ERP-Lite-007)
psql -d erplite -f sql/ERP-Lite-005-SeedData-RLS.sql
psql -d erplite -f sql/ERP-Lite-007-BootstrapRole.sql

# تنفيذ الهجرات بالترتيب
psql -d erplite -f sql/ERP-Lite-001-System-Security-Core.sql
psql -d erplite -f sql/ERP-Lite-002-Inventory.sql
psql -d erplite -f sql/ERP-Lite-003-Purchasing-Sales.sql
psql -d erplite -f sql/ERP-Lite-004-Accounting-Partitions.sql
psql -d erplite -f sql/ERP-Lite-006-Phase2-Views-Indexes-Functions.sql
psql -d erplite -f sql/ERP-Lite-008-CostCenters.sql
```

### 2) إعداد الـ Backend

```bash
cd erplite-backend

# إنشاء ملف .env
cp .env.example .env
# عدّل القيم:
#   ERPLITE_DATABASE_URL=postgresql+asyncpg://erplite_app:PASSWORD@localhost:5432/erplite
#   ERPLITE_JWT_SECRET_KEY=<strong-random-string>

# تثبيت الاعتماديات
pip install -r requirements.txt

# التشغيل
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3) إعداد الـ Frontend

```bash
cd erplite-frontend

# إنشاء ملف .env
cp .env.example .env
# (افتراضيًا يشير إلى http://localhost:8000/api/v1)

# تثبيت الاعتماديات
npm install

# تشغيل وضع التطوير
npm run dev
# → http://localhost:5173

# أو تشغيل نسخة الإنتاج (مبنية مسبقًا في dist/)
npm run preview
# أو خدمة dist/ عبر أي خادم ويب ثابت (nginx, serve, إلخ)
```

## التحقق من السلامة

```bash
# Frontend
cd erplite-frontend
npm run lint          # 0 warnings, 0 errors
npm run build         # build succeeds, dist/ generated

# Backend
cd erplite-backend
python -c "from app.main import app; print(f'OK: {len(app.routes)} routes')"
pytest tests/         # يتطلب PostgreSQL حية بالتكوين أعلاه
```

## نطاق النسخة v1.0

### ✅ مكتمل وجاهز للاستخدام
- **المصادقة**: JWT login/logout, ProtectedRoute, AuthContext
- **لوحة التحكم**: مؤشرات حقيقية (عدد العملاء/الموردين/الأصناف، حركات المخزون، أرصدة JE)
- **المبيعات**: العملاء (CRUD كامل) + أوامر البيع (إنشاء/عرض/تأكيد)
- **المشتريات**: الموردون (CRUD كامل) + أوامر الشراء (إنشاء/عرض/تأكيد)
- **المخزون**: الأصناف (CRUD) + الفئات + المستودعات + أرصدة المخزون + حركات المخزون
- **المحاسبة**: الحسابات (شجرة مع parent) + قيود اليومية (إنشاء/عرض/ترحيل) + ميزان المراجعة
- **التقارير**: 24 endpoint تقارير موصولة بالواجهة
- **الإعدادات**: البيانات المرجعية (عملات، دول، وحدات قياس) + السنوات المالية + شروط الدفع + معدلات الضرائب + مراكز التكلفة (CRUD مع optimistic locking)
- **التصميم**: RTL عربي-أول، تصميم متجاوب mobile-first، print CSS للمستندات
- **الأمان**: RLS على مستوى PostgreSQL، JWT، تحقق Zod على كل نموذج

### ⚠️ قيود معروفة (موثقة في تقرير التدقيق)
- بعض endpoints الـ Backend ناقصة (DELETE/PATCH لبعض الكيانات، تقارير P&L/Balance Sheet/General Ledger)
- لا توجد واجهة لإنشاء فواتير المبيعات/المشتريات أو سندات القبض/الدفع (الـ endpoints غير موجودة)
- لا توجد إدارة مستخدمين/أدوار/شركات في الواجهة (الـ endpoints موجودة جزئيًا)

هذه القيود موثقة بالكامل في `docs/FRONTEND_FINAL_ACCEPTANCE.md` و `docs/ERP_LITE_V1_FINAL_AUDIT.md`.

## المعمارية

```
┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  React + Vite       │────▶│  FastAPI + Pydantic │────▶│  PostgreSQL      │
│  (Frontend)         │ JWT │  (Backend)          │ RLS │  (with RLS)      │
│  RTL Arabic-first   │◀────│  74 routes          │◀────│  8 SQL migrations│
└─────────────────────┘     └─────────────────────┘     └──────────────────┘
```

**المبادئ:**
1. الـ Backend هو مصدر الحقيقة — لا توجد بيانات وهمية في الواجهة
2. كل endpoint يستخدم UUID (لا تظهر المعرّفات الرقمية الداخلية)
3. RLS يُفرض على مستوى PostgreSQL عبر `SET LOCAL app.current_company_ids`
4. Optimistic locking عبر `expected_version_no` على كل mutation
5. كل قيد أعمال (BR-*) يُفرض في الـ Backend، الواجهة تعكسه فقط

## الترخيص
ملكي — مشروع ERP-Lite داخلي.
"""
(STAGING_DIR / "README.md").write_text(PKG_README, encoding="utf-8")
print("[ok] package README.md written")

# ---------------------------------------------------------------------------
# 8. Create the zip
# ---------------------------------------------------------------------------
if ZIP_OUT.exists():
    ZIP_OUT.unlink()

PKG_ROOT = "ERP-Lite-v1.0"
with zipfile.ZipFile(ZIP_OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for path in STAGING_DIR.rglob("*"):
        if path.is_file():
            arcname = f"{PKG_ROOT}/{path.relative_to(STAGING_DIR)}"
            zf.write(path, arcname)

zip_size_mb = ZIP_OUT.stat().st_size / (1024 * 1024)
print(f"[ok] zip created: {ZIP_OUT} ({zip_size_mb:.2f} MB)")

# ---------------------------------------------------------------------------
# 9. Create the standalone README at download root
# ---------------------------------------------------------------------------
README_OUT.write_text(PKG_README, encoding="utf-8")
print(f"[ok] standalone README.md written: {README_OUT}")

# ---------------------------------------------------------------------------
# 10. Clean up staging
# ---------------------------------------------------------------------------
shutil.rmtree(STAGING_DIR)
print("[ok] staging cleaned up")

# ---------------------------------------------------------------------------
# 11. Final listing
# ---------------------------------------------------------------------------
print("\n=== FINAL DOWNLOAD CONTENTS ===")
for f in sorted(DOWNLOAD_DIR.iterdir()):
    size = f.stat().st_size
    if size > 1024 * 1024:
        print(f"  {f.name:40s} {size / (1024*1024):7.2f} MB")
    elif size > 1024:
        print(f"  {f.name:40s} {size / 1024:7.1f} KB")
    else:
        print(f"  {f.name:40s} {size:7d} B")
