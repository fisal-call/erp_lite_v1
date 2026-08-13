/**
 * src/auth/auth-state.ts
 * All non-component exports for the auth module live here so that
 * `AuthContext.tsx` can be a "components-only" file (satisfies the
 * react/only-export-components rule for Fast Refresh correctness).
 */
import { createContext, useContext } from 'react'

export interface AuthContextValue {
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
