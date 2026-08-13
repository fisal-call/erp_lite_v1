/**
 * src/modules/settings/reference/ReferenceDataPage.tsx
 *
 * Landing page for reference data tables (Currencies, Countries, Units of
 * Measure). All three are read-only — the backend exposes only GET list
 * endpoints, no create/update (the rows are seeded via SQL migrations).
 *
 * Each card links to its dedicated read-only list page.
 */
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../../../components/ui'

interface RefEntry {
  label: string
  description: string
  to: string
  icon: string
}

const REFS: RefEntry[] = [
  {
    label: 'العملات',
    description: 'العملات المتاحة في النظام (ISO code + الاسم العربي + الرمز).',
    to: '/settings/reference/currencies',
    icon: '$',
  },
  {
    label: 'الدول',
    description: 'الدول المتاحة في النظام (ISO code + الاسم العربي).',
    to: '/settings/reference/countries',
    icon: '🌍',
  },
  {
    label: 'وحدات القياس',
    description: 'وحدات القياس المعتمدة للأصناف (قطعة، كجم، متر، ...).',
    to: '/settings/reference/units-of-measure',
    icon: 'uom',
  },
]

export function ReferenceDataPage() {
  return (
    <div>
      <PageHeader title="البيانات المرجعية" />

      <p className="text-sm text-gray-500 mb-4 leading-relaxed max-w-2xl">
        هذه الجداول تُدار عبر سكربتات قاعدة البيانات (SQL migrations) ولا يمكن
        تعديلها من الواجهة. الـ Backend يوفّر Endpoint للقراءة فقط لكل جدول.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {REFS.map((r) => (
          <Card key={r.to}>
            <div className="flex items-start gap-3">
              <span
                className="shrink-0 w-10 h-10 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm"
                aria-hidden="true"
              >
                {r.icon}
              </span>
              <div className="flex-1">
                <h2 className="font-bold text-gray-800 text-sm">{r.label}</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.description}</p>
                <Link
                  to={r.to}
                  className="text-xs text-blue-600 hover:underline mt-3 inline-block"
                >
                  عرض ←
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
