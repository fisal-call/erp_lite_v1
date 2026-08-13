/**
 * src/modules/purchasing/suppliers/SupplierDetailPage.tsx
 *
 * Supplier detail view with transactions tabs (invoices, payments, statement).
 *
 * NOTE: A "Purchase Orders for this supplier" tab was removed because the
 *       backend `/purchasing/purchase-orders` list endpoint does not support
 *       filtering by `supplier_uuid` (the PurchaseOrderSummaryRead DTO omits
 *       it). Displaying orders here would require N+1 calls to
 *       `/purchasing/purchase-orders/{uuid}` per supplier — unacceptable for
 *       v1.0. The info tab provides a CTA to the global purchase-orders list
 *       instead. See BACKEND_GAP in the final acceptance report: requires
 *       `?supplier_uuid=` on the list endpoint OR adding `supplier_uuid` to
 *       the summary DTO.
 */
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { purchasingApi } from '../api'
import { reportingApi } from '../../reporting/api'
import { StatusBadge } from '../../../components/StatusBadge'
import {
  BooleanBadge,
  Card,
  DetailField,
  EmptyState,
  ErrorState,
  KpiCard,
  PageHeader,
  Skeleton,
  Spinner,
  Table,
  Th,
  Td,
} from '../../../components/ui'

type Tab = 'info' | 'invoices' | 'payments' | 'statement'

export function SupplierDetailPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [tab, setTab] = useState<Tab>('info')

  const supplierQ = useQuery({
    queryKey: ['supplier', uuid],
    queryFn: () => purchasingApi.getSupplier(uuid!),
    enabled: !!uuid,
  })
  const outstandingQ = useQuery({
    queryKey: ['supplier-outstanding'],
    queryFn: reportingApi.listSupplierOutstanding,
    enabled: !!uuid,
  })
  const invoicesQ = useQuery({
    queryKey: ['purchase-invoices', uuid],
    queryFn: () => reportingApi.listPurchaseInvoices({ supplier_uuid: uuid, limit: 50 }),
    enabled: !!uuid,
  })
  const paymentsQ = useQuery({
    queryKey: ['supplier-payments', uuid],
    queryFn: () => reportingApi.listSupplierPayments({ supplier_uuid: uuid, limit: 50 }),
    enabled: !!uuid,
  })
  const statementQ = useQuery({
    queryKey: ['supplier-statement', uuid],
    queryFn: () => reportingApi.getSupplierStatement(uuid!),
    enabled: !!uuid && tab === 'statement',
  })

  if (supplierQ.isLoading) return <Spinner />
  if (supplierQ.error) return <ErrorState error={supplierQ.error} />
  if (!supplierQ.data) return <ErrorState message="المورد غير موجود" />
  const supplier = supplierQ.data

  const outstanding = outstandingQ.data?.find((r) => r.supplier_uuid === uuid)

  return (
    <div>
      <PageHeader
        title={`المورد: ${supplier.supplier_name}`}
        actions={
          <Link
            to={`/purchasing/suppliers/${uuid}/edit`}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
          >
            تعديل
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="إجمالي الفواتير"
          value={(outstanding?.total_invoiced ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          tone="default"
        />
        <KpiCard
          label="إجمالي المدفوع"
          value={(outstanding?.total_paid ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          tone="success"
        />
        <KpiCard
          label="الرصيد المستحق"
          value={(outstanding?.balance_due ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          tone={(outstanding?.balance_due ?? 0) > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="عدد الفواتير"
          value={String(invoicesQ.data?.length ?? 0)}
          tone="warning"
        />
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-1 overflow-x-auto" role="tablist">
          {([
            ['info', 'بيانات'],
            ['invoices', `فواتير (${invoicesQ.data?.length ?? 0})`],
            ['payments', `سندات صرف (${paymentsQ.data?.length ?? 0})`],
            ['statement', 'كشف حساب'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 ${
                tab === key
                  ? 'border-blue-600 text-blue-700 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'info' && (
        <>
          <Card className="space-y-1 max-w-2xl">
            <DetailField label="الكود" value={supplier.supplier_code} ltr />
            <DetailField label="الاسم" value={supplier.supplier_name} />
            <DetailField label="الهاتف" value={supplier.phone} ltr />
            <DetailField label="البريد الإلكتروني" value={supplier.email} ltr />
            <DetailField label="الحالة" value={<BooleanBadge value={supplier.is_active} />} />
            <DetailField label="تاريخ الإنشاء" value={supplier.created_at} ltr />
            <DetailField label="رقم الإصدار" value={String(supplier.version_no)} ltr />
          </Card>
          <Card className="mt-4 max-w-2xl">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-medium text-gray-800">أوامر الشراء</div>
                <div className="text-xs text-gray-500 mt-1">
                  لعرض أوامر الشراء الخاصة بهذا المورد، انتقل إلى قائمة أوامر الشراء الكاملة.
                </div>
              </div>
              <Link
                to="/purchasing/orders"
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
              >
                عرض قائمة أوامر الشراء ←
              </Link>
            </div>
          </Card>
        </>
      )}

      {tab === 'invoices' && (
        <Card>
          <div className="p-2">
            {invoicesQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !invoicesQ.data || invoicesQ.data.length === 0 ? (
              <EmptyState message="لا توجد فواتير مشتريات لهذا المورد" />
            ) : (
              <Table>
                <thead><tr><Th>رقم الفاتورة</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>المدفوع</Th><Th>المستحق</Th><Th>الحالة</Th></tr></thead>
                <tbody className="divide-y">
                  {invoicesQ.data.map((inv) => (
                    <tr key={inv.uuid} className="hover:bg-gray-50">
                      <Td className="font-mono text-xs">{inv.document_number}</Td>
                      <Td className="text-gray-700">{inv.document_date}</Td>
                      <Td className="text-gray-800">{inv.total_amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                      <Td className="text-green-700">{inv.paid_amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                      <Td className={`font-bold ${inv.balance_due > 0 ? 'text-rose-700' : 'text-gray-500'}`}>
                        {inv.balance_due.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </Td>
                      <Td><StatusBadge status={inv.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      )}

      {tab === 'payments' && (
        <Card>
          <div className="p-2">
            {paymentsQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !paymentsQ.data || paymentsQ.data.length === 0 ? (
              <EmptyState message="لا توجد سندات صرف لهذا المورد" />
            ) : (
              <Table>
                <thead><tr><Th>رقم السند</Th><Th>الفاتورة</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>طريقة الدفع</Th><Th>الحالة</Th></tr></thead>
                <tbody className="divide-y">
                  {paymentsQ.data.map((p) => (
                    <tr key={p.uuid} className="hover:bg-gray-50">
                      <Td className="font-mono text-xs">{p.document_number}</Td>
                      <Td className="font-mono text-xs">{p.invoice_number}</Td>
                      <Td className="text-gray-700">{p.payment_date}</Td>
                      <Td className="text-amber-700 font-medium">{p.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                      <Td>{p.payment_method}</Td>
                      <Td><StatusBadge status={p.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      )}

      {tab === 'statement' && (
        <Card>
          <div className="p-2">
            {statementQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : statementQ.error ? (
              <ErrorState error={statementQ.error} />
            ) : !statementQ.data ? (
              <EmptyState message="لا توجد بيانات" />
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-md mb-3">
                  <div>
                    <div className="text-xs text-gray-500">رصيد افتتاحي</div>
                    <div className="font-bold text-gray-800">{statementQ.data.opening_balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">إجمالي مدين</div>
                    <div className="font-bold text-rose-700">{statementQ.data.total_debit.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">إجمالي دائن</div>
                    <div className="font-bold text-green-700">{statementQ.data.total_credit.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">رصيد ختامي</div>
                    <div className="font-bold text-blue-700">{statementQ.data.closing_balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
                {statementQ.data.lines.length === 0 ? (
                  <EmptyState message="لا توجد حركات في كشف الحساب" />
                ) : (
                  <Table>
                    <thead><tr><Th>التاريخ</Th><Th>رقم المستند</Th><Th>النوع</Th><Th>مدين</Th><Th>دائن</Th><Th>الرصيد</Th></tr></thead>
                    <tbody className="divide-y">
                      {statementQ.data.lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <Td className="text-gray-700">{line.posting_date}</Td>
                          <Td className="font-mono text-xs">{line.document_number}</Td>
                          <Td>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                              {line.kind === 'invoice' ? 'فاتورة' : line.kind === 'payment' ? 'سند صرف' : line.kind}
                            </span>
                          </Td>
                          <Td className="text-rose-700">{line.debit > 0 ? line.debit.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</Td>
                          <Td className="text-green-700">{line.credit > 0 ? line.credit.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</Td>
                          <Td className="font-bold text-gray-800">{line.running_balance?.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '—'}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      <div className="mt-4">
        <Link to="/purchasing/suppliers" className="text-sm text-blue-600 hover:underline">
          ← العودة لقائمة الموردين
        </Link>
      </div>
    </div>
  )
}
