/**
 * src/modules/not-found/NotFoundPage.tsx
 *
 * 404 page shown when the URL doesn't match any known route. Reached either
 * by a typo, an old bookmark, or unauthorized access (which is handled
 * separately by <ProtectedRoute>). Provides quick jump-back links so users
 * on mobile don't get stranded.
 */
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui'

export function NotFoundPage() {
  return (
    <div>
      <PageHeader title="الصفحة غير موجودة" />
      <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-8 text-center">
        <div className="text-6xl font-bold text-gray-200 mb-2">404</div>
        <p className="text-gray-700 mb-1">عذراً، الصفحة التي تبحث عنها غير موجودة.</p>
        <p className="text-sm text-gray-500 mb-6">
          قد يكون الرابط قديماً أو تم حذفه. اختر إجراءً من القائمة أدناه للعودة إلى التطبيق.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            الصفحة الرئيسية
          </Link>
          <Link
            to="/sales/customers"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
          >
            العملاء
          </Link>
          <Link
            to="/inventory/items"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
          >
            الأصناف
          </Link>
          <Link
            to="/accounting/journal-entries"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
          >
            القيود اليومية
          </Link>
        </div>
      </div>
    </div>
  )
}
