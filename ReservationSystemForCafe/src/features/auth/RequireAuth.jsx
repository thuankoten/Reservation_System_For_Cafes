import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { Navigate, useLocation } from 'react-router-dom'
import { getUserById } from '../../shared/services/users'

export default function RequireAuth({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (loading) return
      if (!user) {
        if (!cancelled) {
          setAllowed(false)
          setChecking(false)
        }
        return
      }

      if (!allowedRoles || allowedRoles.length === 0) {
        if (!cancelled) {
          setAllowed(true)
          setChecking(false)
        }
        return
      }

      try {
        const doc = await getUserById(user.uid)
        const role = doc?.role
        const ok = role && allowedRoles.includes(role)
        if (!cancelled) setAllowed(Boolean(ok))
      } catch (err) {
        // treat error as not allowed
        // eslint-disable-next-line no-console
        console.error('RequireAuth getUserById error', err)
        if (!cancelled) setAllowed(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [user, loading, allowedRoles])

  if (loading || checking) return <div style={{ padding: 16 }}>Loading...</div>

  if (!user) {
    const adminLogin = allowedRoles && (allowedRoles.includes('admin') || allowedRoles.includes('system-admin'))
    return <Navigate to={adminLogin ? '/auth/admin-login' : '/auth/login'} state={{ from: location }} replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowed) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return children
}
