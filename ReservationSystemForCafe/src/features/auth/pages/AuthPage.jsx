import { Navigate, Outlet, useLocation } from 'react-router-dom'

export default function AuthPage() {
  const location = useLocation()

  if (location.pathname === '/auth') {
    return <Navigate to="/auth/login" replace />
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <Outlet />
      </div>
    </div>
  )
}
