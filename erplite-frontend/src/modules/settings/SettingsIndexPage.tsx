/**
 * src/modules/settings/SettingsIndexPage.tsx
 *
 * Settings landing page. Shows what's available vs. what's not.
 *
 * Backend reality (per endpoint inventory):
 *   - POST /security/users exists (deliberately unauthenticated — bootstrap gap)
 *   - GET /security/users does NOT exist (no list endpoint)
 *   - No role/permission endpoints exist
 *   - No company-management endpoints exist (only POST /core/companies for bootstrap)
 *
 * Per task prompt §16 (NO API = NO FEATURE): we do not build a fake users list
 * or a fake permissions screen. Each missing piece is flagged with a clear
 * "غير متاح حالياً" panel + reference to BACKEND_REQUIRED.md.
 */
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../../components/ui'

export function SettingsIndexPage() {
  return (
    <div>
      <PageHeader title="الإعدادات" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Users — list missing */}
        <Card>
          <h2 className="font-bold text-gray-800 mb-2">المستخدمون</h2>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            عرض قائمة المستخدمين وإنشاء مستخدم جديد وإدارة حالتهم (نشط/موقوف).
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-500">
            غير متاح حالياً — الباك إند لا يوفّر Endpoint لعرض قائمة المستخدمين
            (<code className="bg-white px-1 rounded">GET /api/v1/security/users</code>).
            الـ Endpoint الحالي لإنشاء المستخدم (<code className="bg-white px-1 rounded">POST /api/v1/security/users</code>)
            غير محميّ بصلاحية Admin بعد — موثَّق في BACKEND_REQUIRED.md.
          </div>
        </Card>

        {/* Roles / Permissions — completely missing */}
        <Card>
          <h2 className="font-bold text-gray-800 mb-2">الأدوار والصلاحيات</h2>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            عرض الأدوار المُعرَّفة في النظام وربطها بالمستخدمين والتحكم في صلاحياتهم.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-500">
            غير متاح حالياً — لا يوجد Endpoint لإدارة الأدوار أو الصلاحيات.
            جدول <code className="bg-white px-1 rounded">security.permission_rule</code>{' '}
            موجود في قاعدة البيانات لكنه غير مُفعَّل في أي Endpoint — موثَّق في BACKEND_REQUIRED.md.
          </div>
        </Card>

        {/* Company — read-only display not possible without an endpoint */}
        <Card>
          <h2 className="font-bold text-gray-800 mb-2">الشركة الحالية</h2>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            عرض بيانات الشركة الحالية (الاسم، العملة الأساسية، الدولة، السنة المالية الحالية).
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-500">
            غير متاح حالياً — لا يوجد Endpoint لعرض بيانات الشركة الحالية
            (<code className="bg-white px-1 rounded">GET /api/v1/core/companies/me</code>).
            الـ Endpoint الحالي لإنشاء شركة (<code className="bg-white px-1 rounded">POST /api/v1/core/companies</code>)
            هو الوحيد المتاح — موثَّق في BACKEND_REQUIRED.md.
          </div>
        </Card>

        {/* Branches — not exposed */}
        <Card>
          <h2 className="font-bold text-gray-800 mb-2">الفروع</h2>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            عرض فروع الشركة الحالية وإنشاء فرع جديد.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-500">
            غير متاح حالياً — لا يوجد Endpoint لإدارة الفروع. موثَّق في BACKEND_REQUIRED.md.
          </div>
        </Card>

        {/* Reference data — available */}
        <Card>
          <h2 className="font-bold text-gray-800 mb-2">البيانات المرجعية</h2>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            العملات، الدول، وحدات القياس. جداول مرجعية للقراءة فقط — تُدار عبر SQL migrations.
          </p>
          <Link
            to="/settings/reference"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            عرض البيانات المرجعية ←
          </Link>
        </Card>

        {/* Cost Centers — v1.0 */}
        <Card>
          <h2 className="font-bold text-gray-800 mb-2">مراكز التكلفة</h2>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            إنشاء وإدارة مراكز التكلفة (أقسام، فروع داخلية) — تدعم التسلسل الهرمي
            والتفعيل/الإيقاف. ربط مراكز التكلفة بالمعاملات مؤجَّل للإصدار القادم.
          </p>
          <Link
            to="/settings/cost-centers"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            إدارة مراكز التكلفة ←
          </Link>
        </Card>

        {/* Fiscal Years — available (read-only) */}
        <Card>
          <h2 className="font-bold text-gray-800 mb-2">السنوات المالية</h2>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            عرض السنوات المالية والفترات الدورية المرتبطة بها. إنشاء أو إغلاق سنة
            مالية غير متاح حالياً — يُدار عبر قاعدة البيانات.
          </p>
          <Link
            to="/settings/fiscal"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            عرض السنوات المالية ←
          </Link>
        </Card>

        {/* Payment Terms — available (read-only) */}
        <Card>
          <h2 className="font-bold text-gray-800 mb-2">شروط السداد</h2>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            عرض شروط السداد المُعرَّفة في النظام (مثل: عند الاستلام، خلال 30 يومًا).
            إنشاء أو تعديل شروط السداد غير متاح حالياً — يُدار عبر قاعدة البيانات.
          </p>
          <Link
            to="/settings/payment-terms"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            عرض شروط السداد ←
          </Link>
        </Card>

        {/* Tax Rates — available (read-only) */}
        <Card>
          <h2 className="font-bold text-gray-800 mb-2">معدلات الضرائب</h2>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            عرض معدلات الضرائب المُعرَّفة (مثل: ضريبة القيمة المضافة 14%).
            إنشاء أو تعديل المعدلات غير متاح حالياً — يُدار عبر قاعدة البيانات.
            محرك الضرائب الكامل مؤجَّل للإصدار القادم.
          </p>
          <Link
            to="/settings/tax-rates"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            عرض معدلات الضرائب ←
          </Link>
        </Card>
      </div>
    </div>
  )
}
