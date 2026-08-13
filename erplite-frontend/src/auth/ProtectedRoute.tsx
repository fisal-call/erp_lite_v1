/**
 * src/auth/ProtectedRoute.tsx
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './auth-state'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
