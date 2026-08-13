/**
 * src/api/client.ts
 * Central API client. Every module's api.ts calls through this — never call
 * fetch/axios directly from a component. Handles: base URL, JWT header,
 * 401 (expired token -> logout+redirect), and translating FastAPI's error
 * shape ({detail: "..."}) into a consistent ApiError with Arabic-friendly
 * messages.
 */
import axios, { AxiosError } from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

/**
 * Map well-known HTTP statuses to user-facing Arabic messages.
 * The backend's `detail` string is preferred when present (it usually carries
 * a Business-Rule ID like "[BR-SAL-009] Customer is suspended"), but if the
 * backend returned no body or a generic error, we fall back to these.
 */
const STATUS_AR: Record<number, string> = {
  400: 'الطلب غير صحيح',
  401: 'انتهت الجلسة — يرجى تسجيل الدخول من جديد',
  403: 'ليس لديك صلاحية للقيام بهذه العملية',
  404: 'العنصر غير موجود',
  409: 'تم تعديل هذا السجل بواسطة مستخدم آخر — يرجى إعادة التحميل قبل الحفظ',
  422: 'البيانات المُرسَلة غير صحيحة',
  500: 'حدث خطأ في الخادم — يرجى المحاولة لاحقاً',
  502: 'الخدمة غير متاحة حالياً',
  503: 'الخدمة غير متاحة حالياً',
  504: 'انتهت مهلة الاتصال بالخادم',
}

export class ApiError extends Error {
  status: number
  ruleId?: string // e.g. "BR-SAL-009" extracted from "[BR-SAL-009] message"

  constructor(status: number, detail: string) {
    const match = detail.match(/^\[([\w-]+)\]\s*(.*)$/)
    const baseMessage = match ? match[2] : detail
    super(baseMessage || STATUS_AR[status] || 'حدث خطأ غير متوقع')
    this.status = status
    this.ruleId = match?.[1]
  }
}

export const apiClient = axios.create({ baseURL: API_BASE })

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('erplite_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    const status = error.response?.status ?? 0
    const rawDetail = error.response?.data?.detail ?? error.message

    if (status === 401) {
      // Token missing/expired/invalid: the only correct move is a full
      // logout — there is no "retry" that makes sense here.
      localStorage.removeItem('erplite_token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(new ApiError(status, rawDetail))
  },
)

/**
 * Convenience helper: convert any thrown value (typically from a mutation) to
 * a user-facing Arabic message. Prefers backend `detail` (which often carries
 * a Business-Rule ID), falls back to status-based Arabic text, then to a
 * generic message.
 */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.ruleId) return err.message // backend already gives a precise rule-bound message
    return STATUS_AR[err.status] ?? err.message ?? 'حدث خطأ غير متوقع'
  }
  if (err instanceof Error) return err.message
  return 'حدث خطأ غير متوقع'
}
