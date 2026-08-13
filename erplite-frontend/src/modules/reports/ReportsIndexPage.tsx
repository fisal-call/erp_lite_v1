/**
 * src/modules/reports/ReportsIndexPage.tsx
 *
 * Reports center — landing page with categorized report links.
 * All reports listed here now have REAL backend endpoints (added in
 * reporting/extended_router.py).
 */
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../../components/ui'

interface ReportEntry {
  label: string
  description: string
  to: string
  external?: boolean  // if true, the report lives at its own module route
}

const REPORTS: { group: string; items: ReportEntry[] }[] = [
  {
    group: 'المبيعات',
    items: [
      { label: 'ملخص المبيعات', description: 'إجمالي المبيعات خلال فترة، مجمّع بالشهر/الأسبوع/السنة', to: '/reports/sales' },
      { label: 'المبيعات حسب العميل', description: 'تجميع المبيعات لكل عميل خلال فترة', to: '/reports/sales' },
      { label: 'المبيعات حسب الصنف', description: 'تجميع الكميات والمبالغ لكل صنف خلال فترة', to: '/reports/sales' },
      { label: 'قائمة فواتير المبيعات', description: 'عرض كل فواتير المبيعات مع المبلغ والمستحق', to: '/sales/invoices', external: true },
      { label: 'سندات القبض', description: 'قائمة سندات القبض من العملاء', to: '/sales/receipts', external: true },
      { label: 'الذمم المدينة', description: 'أرصدة العملاء المستحقة', to: '/finance/receivables', external: true },
    ],
  },
  {
    group: 'المشتريات',
    items: [
      { label: 'ملخص المشتريات', description: 'إجمالي المشتريات خلال فترة، مجمّع بالشهر/الأسبوع/السنة', to: '/reports/purchasing' },
      { label: 'المشتريات حسب المورد', description: 'تجميع المشتريات لكل مورد خلال فترة', to: '/reports/purchasing' },
      { label: 'قائمة فواتير المشتريات', description: 'عرض كل فواتير المشتريات مع المبلغ والمستحق', to: '/purchasing/invoices', external: true },
      { label: 'سندات الصرف', description: 'قائمة سندات الصرف للموردين', to: '/purchasing/payments', external: true },
      { label: 'الذمم الدائنة', description: 'أرصدة الموردين المستحقة', to: '/finance/payables', external: true },
    ],
  },
  {
    group: 'المخزون',
    items: [
      { label: 'رصيد المخزون', description: 'عرض الكميات المتاحة لكل صنف في كل مخزن', to: '/inventory/stock-balance', external: true },
      { label: 'حركات المخزون', description: 'سجل حركات الإضافة والصرف لكل صنف خلال فترة', to: '/inventory/stock-movements', external: true },
      { label: 'الأصناف منخفضة المخزون', description: 'الأصناف التي وصل رصيدها إلى صفر أو أقل', to: '/reports/inventory' },
      { label: 'قائمة الأصناف', description: 'عرض كل الأصناف مع الفئة والوحدة والحالة', to: '/inventory/items', external: true },
    ],
  },
  {
    group: 'المحاسبة',
    items: [
      { label: 'شجرة الحسابات', description: 'عرض كل الحسابات مع نوعها ومجموعتها', to: '/accounting/accounts', external: true },
      { label: 'القيود اليومية', description: 'قائمة كل القيود اليومية مع الحالة والتاريخ', to: '/accounting/journal-entries', external: true },
      { label: 'ميزان المراجعة', description: 'مدين، دائن، ورصيد صافي لكل حساب خلال فترة', to: '/accounting/trial-balance', external: true },
      { label: 'النقد والبنوك', description: 'عرض حسابات النقد والبنوك مع أرصدتها', to: '/finance/cash-bank', external: true },
    ],
  },
]

export function ReportsIndexPage() {
  return (
    <div>
      <PageHeader title="مركز التقارير" />

      <p className="text-sm text-gray-600 mb-6">
        مركز موحَّد لكل تقارير النظام. التقارير المُعلَّمة كـ "متاح" لها endpoints
        فعلية في الخادم. لا توجد تقارير وهمية.
      </p>

      <div className="space-y-6">
        {REPORTS.map((section) => (
          <div key={section.group}>
            <h2 className="text-sm font-bold text-gray-700 mb-2">{section.group}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.items.map((r) => (
                <Card key={r.label}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">{r.label}</h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {r.description}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-emerald-100 text-emerald-700">
                      متاح
                    </span>
                  </div>
                  <Link
                    to={r.to}
                    className="text-xs text-blue-600 hover:underline mt-3 inline-block"
                  >
                    فتح التقرير ←
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
