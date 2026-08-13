/**
 * src/modules/reports/accounting/AccountingReportsPage.tsx
 *
 * Accounting reports landing — links to existing accounting pages and
 * documents reports that still need backend work.
 */
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../../../components/ui'

interface ReportEntry {
  label: string
  description: string
  to?: string
  available: boolean
  note?: string
}

const REPORTS: ReportEntry[] = [
  {
    label: 'شجرة الحسابات',
    description: 'عرض كل الحسابات مع نوعها ومجموعتها',
    to: '/accounting/accounts',
    available: true,
  },
  {
    label: 'القيود اليومية',
    description: 'قائمة كل القيود اليومية مع الحالة والتاريخ',
    to: '/accounting/journal-entries',
    available: true,
  },
  {
    label: 'ميزان المراجعة',
    description: 'مدين، دائن، ورصيد صافي لكل حساب خلال فترة',
    to: '/accounting/trial-balance',
    available: true,
  },
  {
    label: 'النقد والبنوك',
    description: 'عرض حسابات النقد والبنوك مع الحسابات العامة المرتبطة',
    to: '/finance/cash-bank',
    available: true,
  },
  {
    label: 'الذمم المدينة',
    description: 'أرصدة العملاء المستحقة مع إجمالي الفواتير والمحصل',
    to: '/finance/receivables',
    available: true,
  },
  {
    label: 'الذمم الدائنة',
    description: 'أرصدة الموردين المستحقة مع إجمالي الفواتير والمدفوع',
    to: '/finance/payables',
    available: true,
  },
  {
    label: 'كشف حساب عميل',
    description: 'حركة كاملة لعميل (فواتير + سندات قبض + رصيد تراكمي)',
    available: false,
    note: 'متاح من داخل صفحة العميل — انتقل إلى أي عميل ثم اضغط "كشف الحساب"',
  },
  {
    label: 'كشف حساب مورد',
    description: 'حركة كاملة لمورد (فواتير + سندات صرف + رصيد تراكمي)',
    available: false,
    note: 'متاح من داخل صفحة المورد — انتقل إلى أي مورد ثم اضغط "كشف الحساب"',
  },
  {
    label: 'قائمة الأرباح والخسائر',
    description: 'الإيرادات والمصروفات وصافي الربح خلال فترة',
    available: false,
    note: 'يتطلب endpoint جديد: GET /reporting/profit-loss — مسجَّل في TODO',
  },
  {
    label: 'الميزانية العمومية',
    description: 'الأصول والخصوم وحقوق الملكية في تاريخ معين',
    available: false,
    note: 'يتطلب endpoint جديد: GET /reporting/balance-sheet — مسجَّل في TODO',
  },
  {
    label: 'الأستاذ العام',
    description: 'حركة تفصيلية لكل حساب خلال فترة',
    available: false,
    note: 'يتطلب endpoint جديد: GET /reporting/general-ledger — مسجَّل في TODO',
  },
]

export function AccountingReportsPage() {
  return (
    <div>
      <PageHeader title="التقارير المحاسبية" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTS.map((r) => (
          <Card key={r.label}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">{r.label}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.description}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  r.available ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {r.available ? 'متاح' : 'غير متاح'}
              </span>
            </div>
            {r.available && r.to ? (
              <Link to={r.to} className="text-xs text-blue-600 hover:underline mt-3 inline-block">
                فتح التقرير ←
              </Link>
            ) : (
              <p className="text-xs text-gray-400 mt-3">{r.note}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
