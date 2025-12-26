import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  return children
}
