import { Link, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../shared/firebase'
import { useAuth } from '../features/auth/AuthContext.jsx'

function TopLink({ to, children }) {
  const location = useLocation()
  const active = location.pathname === to

  return (
    <Link
      to={to}
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        textDecoration: 'none',
        color: '#111827',
        background: active ? '#111827' : 'white',
        colorScheme: 'light',
        ...(active ? { color: 'white', borderColor: '#111827' } : null),
      }}
    >
      {children}
    </Link>
  )
}

export default function TopBar() {
  const { user } = useAuth()

  return (
    <header className="topbar">
      <div className="topbar__left">
        <Link to="/dashboard/reservation" className="brand">
          Cafe Reservation
        </Link>
      </div>

      <div className="topbar__right">
        {!user ? (
          <>
            <TopLink to="/auth/login">Login</TopLink>
            <TopLink to="/auth/signup">Sign-up</TopLink>
          </>
        ) : (
          <>
            <div className="topbar__user">{user.email}</div>
            <button className="btn" onClick={() => signOut(auth)}>
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  )
}
