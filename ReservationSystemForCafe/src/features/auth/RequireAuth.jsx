import { useAuth } from './AuthContext'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>
  if (!user) return children

  return children
}
