/** src/modules/purchasing/orders/PurchaseOrderFormPage.tsx
 *
 * Mirrors SalesOrderFormPage exactly. Uses Card + PageHeader + Toast +
 * dynamic lines with item autocomplete + currency dropdown.
 */
import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { purchasingApi } from '../api'
import { coreOrgApi, type Currency } from '../../core-org/api'
import { describeError } from '../../../api/client'
import { ItemAutocomplete } from '../../../components/ItemAutocomplete'
import { SupplierAutocomplete } from '../../../components/SupplierAutocomplete'
import { Card, PageHeader, useToast } from '../../../components/ui'
import type { Item } from '../../inventory/api'
import type { Supplier } from '../types'

interface LineDraft {
  item?: Item
  qty_ordered: number
  rate: number
}

export function PurchaseOrderFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [currencyUuid, setCurrencyUuid] = useState('')
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<LineDraft[]>([{ qty_ordered: 1, rate: 0 }])
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    coreOrgApi.listCurrencies().then((list) => {
      setCurrencies(list)
      const egp = list.find((c) => c.iso_code === 'EGP')
      setCurrencyUuid((egp ?? list[0])?.uuid ?? '')
    })
  }, [])

  const mutation = useMutation({
    mutationFn: purchasingApi.createPurchaseOrder,
    onSuccess: (order) => {
      toast.success(`تم حفظ أمر الشراء: ${order.document_number}`)
      navigate(`/purchasing/orders/${order.uuid}`)
    },
    onError: (err) => {
      const msg = describeError(err)
      setApiError(msg)
      toast.error(msg)
    },
  })

  const total = lines.reduce((sum, l) => sum + l.qty_ordered * l.rate, 0)

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    setApiError(null)
    if (!supplier) return setApiError('اختر المورد أولاً')
    if (!currencyUuid) return setApiError('اختر العملة')
    if (lines.length === 0 || lines.some((l) => !l.item)) {
      return setApiError('كل بند لازم يكون له صنف مُختار — لا يمكن حفظ أمر شراء فارغ')
    }
    if (lines.some((l) => l.qty_ordered <= 0)) {
      return setApiError('الكمية يجب أن تكون أكبر من صفر في كل بند')
    }
    mutation.mutate({
      supplier_uuid: supplier.uuid,
      document_date: documentDate,
      currency_uuid: currencyUuid,
      lines: lines.map((l) => ({ item_uuid: l.item!.uuid, qty_ordered: l.qty_ordered, rate: l.rate })),
    })
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="أمر شراء جديد" />

      {apiError && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md border border-red-200 mb-4">
          {apiError}
        </div>
      )}

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm mb-1 text-gray-700">
              المورد
              <span className="text-rose-600 mr-1">*</span>
            </label>
            <SupplierAutocomplete onSelect={setSupplier} />
            {supplier && (
              <p className="text-xs text-emerald-700 mt-1">✓ {supplier.supplier_name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-700">
              التاريخ
              <span className="text-rose-600 mr-1">*</span>
            </label>
            <input
              type="date"
              className="input"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-700">
              العملة
              <span className="text-rose-600 mr-1">*</span>
            </label>
            <select
              className="input"
              value={currencyUuid}
              onChange={(e) => setCurrencyUuid(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c.uuid} value={c.uuid}>
                  {c.iso_code} — {c.name_ar}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm mb-2 text-gray-700 font-medium">
            البنود
            <span className="text-rose-600 mr-1">*</span>
          </label>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div
                key={i}
                className="flex flex-col md:flex-row md:items-center gap-2 border border-gray-100 rounded-md p-2"
              >
                <div className="flex-1 min-w-0">
                  <ItemAutocomplete onSelect={(item) => updateLine(i, { item })} />
                  {line.item && (
                    <p className="text-xs text-emerald-700 mt-1">✓ {line.item.item_name}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input w-24"
                    placeholder="الكمية"
                    min="1"
                    value={line.qty_ordered}
                    onChange={(e) => updateLine(i, { qty_ordered: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className="input w-28"
                    placeholder="السعر"
                    min="0"
                    step="0.01"
                    value={line.rate}
                    onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                    className="text-red-500 px-2 py-2 hover:bg-red-50 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="حذف البند"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { qty_ordered: 1, rate: 0 }])}
            className="text-blue-600 text-sm mt-3 hover:underline"
          >
            + إضافة بند
          </button>
        </div>

        <div className="text-left font-bold text-lg border-t pt-3 mt-4">
          الإجمالي:{' '}
          <span className="text-blue-700">{total.toFixed(2)}</span>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 bg-blue-600 text-white rounded-md py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'جاري الحفظ...' : 'حفظ كمسودة'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/purchasing/orders')}
            className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50"
          >
            إلغاء
          </button>
        </div>
      </Card>
    </div>
  )
}
