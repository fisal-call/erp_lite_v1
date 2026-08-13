/**
 * src/auth/LoginPage.tsx
 *
 * Login form posting to POST /security/auth/login (OAuth2 password grant).
 * On success, the auth context stores the JWT in localStorage and the
 * central axios client picks it up for subsequent requests.
 *
 * UX:
 *   - RTL Arabic labels
 *   - Show/hide password toggle (eye icon)
 *   - Loading state with disabled button
 *   - Server error rendered in Arabic via describeError()
 *   - Subtle branded card with the ERP-Lite wordmark
 */
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth-state'
import { describeError } from '../api/client'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="w-full max-w-sm">
        {/* ---------- Brand ---------- */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl shadow-md mb-3">
            <span className="text-white text-2xl font-bold">E</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">ERP Lite</h1>
          <p className="text-xs text-gray-500 mt-1">نظام إدارة موارد المؤسسات</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-4"
        >
          <h2 className="text-base font-semibold text-gray-700 text-center">تسجيل الدخول</h2>

          {error && (
            <div
              className="bg-red-50 text-red-700 text-sm p-3 rounded-md border border-red-200"
              role="alert"
            >
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm mb-1 text-gray-700" htmlFor="username">
              اسم المستخدم
            </label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700" htmlFor="password">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="input pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 left-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                tabIndex={-1}
              >
                {showPassword ? (
                  // eye-off icon
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
                  </svg>
                ) : (
                  // eye icon
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-md py-2 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          © {new Date().getFullYear()} ERP Lite
        </p>
      </div>
    </div>
  )
}
