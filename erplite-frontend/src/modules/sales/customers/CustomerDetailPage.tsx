/**
 * src/modules/sales/customers/CustomerDetailPage.tsx
 *
 * Customer detail view with:
 *   - Basic info + edit link
 *   - Sales invoices for this customer (/reporting/sales-invoices?customer_uuid=)
 *   - Customer receipts (/reporting/customer-receipts?customer_uuid=)
 *   - Outstanding balance (/reporting/customer-outstanding)
 *   - Customer statement (/reporting/customer-statement/{uuid})
 *
 * NOTE: A "Sales Orders for this customer" tab was removed because the backend
 *       `/sales/sales-orders` list endpoint does not support filtering by
 *       `customer_uuid` (the SalesOrderSummaryRead DTO omits it). Displaying
 *       orders here would require N+1 calls to `/sales/sales-orders/{uuid}`
 *       per customer — unacceptable for v1.0. The info tab provides a CTA
 *       to the global sales-orders list instead. See BACKEND_GAP in the
 *       final acceptance report: requires `?customer_uuid=` on the list
 *       endpoint OR adding `customer_uuid` to the summary DTO.
 *
 * The transactions section uses TanStack Query's parallel fetching.
 */
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { salesApi } from '../api'
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

type Tab = 'info' | 'invoices' | 'receipts' | 'statement'

export function CustomerDetailPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [tab, setTab] = useState<Tab>('info')

  const customerQ = useQuery({
    queryKey: ['customer', uuid],
    queryFn: () => salesApi.getCustomer(uuid!),
    enabled: !!uuid,
  })
  const outstandingQ = useQuery({
    queryKey: ['customer-outstanding'],
    queryFn: reportingApi.listCustomerOutstanding,
    enabled: !!uuid,
  })
  const invoicesQ = useQuery({
    queryKey: ['sales-invoices', uuid],
    queryFn: () => reportingApi.listSalesInvoices({ customer_uuid: uuid, limit: 50 }),
    enabled: !!uuid,
  })
  const receiptsQ = useQuery({
    queryKey: ['customer-receipts', uuid],
    queryFn: () => reportingApi.listCustomerReceipts({ customer_uuid: uuid, limit: 50 }),
    enabled: !!uuid,
  })
  const statementQ = useQuery({
    queryKey: ['customer-statement', uuid],
    queryFn: () => reportingApi.getCustomerStatement(uuid!),
    enabled: !!uuid && tab === 'statement',
  })

  if (customerQ.isLoading) return <Spinner />
  if (customerQ.error) return <ErrorState error={customerQ.error} />
  if (!customerQ.data) return <ErrorState message="العميل غير موجود" />
  const customer = customerQ.data

  const outstanding = outstandingQ.data?.find((r) => r.customer_uuid === uuid)

  return (
    <div>
      <PageHeader
        title={`العميل: ${customer.customer_name}`}
        actions={
          <Link
            to={`/sales/customers/${customer.uuid}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            تعديل
          </Link>
        }
      />

      {/* KPI strip: outstanding balance + invoices/receipts counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="إجمالي الفواتير"
          value={(outstanding?.total_invoiced ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          tone="default"
        />
        <KpiCard
          label="إجمالي المحصَّل"
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-1 overflow-x-auto" role="tablist">
          {([
            ['info', 'بيانات'],
            ['invoices', `فواتير (${invoicesQ.data?.length ?? 0})`],
            ['receipts', `سندات قبض (${receiptsQ.data?.length ?? 0})`],
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
            <DetailField label="الكود" value={customer.customer_code} ltr />
            <DetailField label="الاسم" value={customer.customer_name} />
            <DetailField label="الهاتف" value={customer.phone} ltr />
            <DetailField label="البريد الإلكتروني" value={customer.email} ltr />
            <DetailField label="حد الائتمان" value={customer.credit_limit ?? null} />
            <DetailField label="الحالة" value={<BooleanBadge value={customer.is_active} />} />
            <DetailField label="تاريخ الإنشاء" value={customer.created_at} ltr />
            <DetailField label="رقم الإصدار" value={String(customer.version_no)} ltr />
          </Card>
          <Card className="mt-4 max-w-2xl">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-medium text-gray-800">أوامر البيع</div>
                <div className="text-xs text-gray-500 mt-1">
                  لعرض أوامر البيع الخاصة بهذا العميل، انتقل إلى قائمة أوامر البيع الكاملة.
                </div>
              </div>
              <Link
                to="/sales/orders"
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
              >
                عرض قائمة أوامر البيع ←
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
              <EmptyState message="لا توجد فواتير مبيعات لهذا العميل" />
            ) : (
              <Table>
                <thead>
                  <tr><Th>رقم الفاتورة</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>المحصَّل</Th><Th>المستحق</Th><Th>الحالة</Th></tr>
                </thead>
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
                      <Td>
                        <StatusBadge status={inv.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      )}

      {tab === 'receipts' && (
        <Card>
          <div className="p-2">
            {receiptsQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !receiptsQ.data || receiptsQ.data.length === 0 ? (
              <EmptyState message="لا توجد سندات قبض لهذا العميل" />
            ) : (
              <Table>
                <thead>
                  <tr><Th>رقم السند</Th><Th>الفاتورة</Th><Th>التاريخ</Th><Th>المبلغ</Th><Th>طريقة السداد</Th><Th>الحالة</Th></tr>
                </thead>
                <tbody className="divide-y">
                  {receiptsQ.data.map((r) => (
                    <tr key={r.uuid} className="hover:bg-gray-50">
                      <Td className="font-mono text-xs">{r.document_number}</Td>
                      <Td className="font-mono text-xs">{r.invoice_number}</Td>
                      <Td className="text-gray-700">{r.receipt_date}</Td>
                      <Td className="text-green-700 font-medium">{r.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Td>
                      <Td>{r.payment_method}</Td>
                      <Td>
                        <StatusBadge status={r.status} />
                      </Td>
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
                    <thead>
                      <tr><Th>التاريخ</Th><Th>رقم المستند</Th><Th>النوع</Th><Th>مدين</Th><Th>دائن</Th><Th>الرصيد</Th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {statementQ.data.lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <Td className="text-gray-700">{line.posting_date}</Td>
                          <Td className="font-mono text-xs">{line.document_number}</Td>
                          <Td>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                              {line.kind === 'invoice' ? 'فاتورة' : line.kind === 'receipt' ? 'سند قبض' : line.kind}
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
        <Link to="/sales/customers" className="text-sm text-blue-600 hover:underline">
          ← العودة لقائمة العملاء
        </Link>
      </div>
    </div>
  )
}
