/**
 * src/auth/AuthContext.tsx
 * Single source of truth for "is the user logged in" across the whole app.
 * Backend contract reminder (BACKEND_ARCHITECTURE.md §5): the JWT carries
 * company_ids + tenant_id — RLS on the server is scoped from THIS token,
 * not from anything the frontend sends explicitly per-request.
 *
 * Non-component exports (context + hook) live in `./auth-state` so this file
 * only exports the Provider component (Fast Refresh friendly).
 */
import { useState, type ReactNode } from 'react'
import { apiClient } from '../api/client'
import { AuthContext, type AuthContextValue } from './auth-state'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('erplite_token'))

  async function login(username: string, password: string) {
    // OAuth2PasswordRequestForm on the backend expects form-encoded, not JSON.
    const form = new URLSearchParams()
    form.set('username', username)
    form.set('password', password)

    const { data } = await apiClient.post<{ access_token: string }>('/security/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    localStorage.setItem('erplite_token', data.access_token)
    setIsAuthenticated(true)
  }

  function logout() {
    localStorage.removeItem('erplite_token')
    setIsAuthenticated(false)
  }

  const value: AuthContextValue = { isAuthenticated, login, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
